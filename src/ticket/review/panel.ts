import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { ModelClient, Rule, RuleIssue, Severity } from "../../core/rule.js";
import { RuleIssueSchema } from "../../core/rule.js";
import { settings } from "../../core/settings.js";
import { resolveModel, tierConfigured } from "../../core/model.js";
import { withSpan } from "../../core/tracing.js";
import { inGitRepo, listSourceFiles } from "../../core/git.js";
import { resolveBlastRadius } from "../scout.js";
import { PANEL_REVIEWERS, buildReviewerPrompt, buildGatePrompt, buildDefenderPrompt, type Reviewer } from "./reviewers.js";

type BlastFile = { path: string; content: string };
const AppliesSchema = z.object({ applies: z.boolean() });
const RefutedSchema = z.object({ refuted: z.boolean() });
// The gate and Defender answer a single boolean. `json` forces the model to emit
// that JSON directly (no preamble ramble — gemma4 otherwise writes ~336 tokens for
// a boolean), and the small cap is a safe backstop since the valid output is tiny.
const GATE_CALL = { maxTokens: 64, json: true, label: "gate" } as const;
const DEFENDER_CALL = { maxTokens: 64, json: true, label: "defender" } as const;

/**
 * The agentic ticket-review panel (spec 004) as ONE `Rule` (`target: ticket`).
 *
 * Slice 1 (#76): the scaffold + file-grounding, with a single reviewer
 * (Architect) end-to-end. It reads the CONTENT of the Scout's blast-radius files
 * and asks each reviewer for material, file-grounded gaps — composing into the
 * same `base − penalties` model as every other rule. The full funnel (a separate
 * applicability gate, the adversarial Defender, the synthesizer) lands in #77–#79.
 *
 * Opt-in (`settings.review.enabled`, default off) — it's the most expensive tier,
 * so it runs only when explicitly enabled on an on-demand `score ticket`.
 */

const IssuesSchema = z.object({ issues: z.array(RuleIssueSchema) });

/** Tolerantly pull {issues:[...]} out of model output (same approach as llm-rule). */
function parseIssues(raw: string): RuleIssue[] | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = IssuesSchema.safeParse(JSON.parse(match[0]));
    return parsed.success ? parsed.data.issues : null;
  } catch {
    return null;
  }
}

/** Panel issues are nudges, not blockers — cap to minor (info stays info). */
function capSeverity(s: Severity): Severity {
  return s === "info" ? "info" : "minor";
}

const SEV_RANK: Record<Severity, number> = { info: 0, minor: 1, major: 2, critical: 3 };
// Two issues are "the same gap" if their wording is very similar (HIGH), or if
// they share a code anchor (a cited identifier/file) AND are moderately similar
// (ANCHORED) — the latter catches same-gap issues two reviewers phrase differently
// (#88), without merging unrelated issues that just share common words.
const DEDUP_HIGH = 0.5;
const DEDUP_ANCHORED = 0.3;
const STOP = /^\[([^\]]+)\]\s*/; // the "[Reviewer] " attribution prefix

/** Split "[Architect] body" → { reviewer, body }. */
function splitTag(problem: string): { reviewer: string; body: string } {
  const m = problem.match(STOP);
  return m ? { reviewer: m[1]!, body: problem.slice(m[0].length) } : { reviewer: "", body: problem };
}

/** Significant tokens (letters, length ≥ 4) for similarity — ignores the reviewer tag. */
function tokens(text: string): Set<string> {
  return new Set((text.toLowerCase().match(/\p{L}{4,}/gu) ?? []));
}

/** Code anchors: cited identifiers/filenames (camelCase, file.ext, kebab/snake) — the "what it's about". */
function anchors(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(/[\w.-]{4,}/g)) {
    const t = m[0];
    if (/[a-z][A-Z]/.test(t) || /\.[a-z]{1,4}\b/.test(t) || /[_-]/.test(t)) out.add(t.toLowerCase());
  }
  return out;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  return shared / (a.size + b.size - shared);
}

function sharesAny(a: Set<string>, b: Set<string>): boolean {
  for (const t of a) if (b.has(t)) return true;
  return false;
}

/**
 * Synthesizer (spec 004, FR-007): pool every reviewer's survivors, collapse
 * cross-reviewer near-duplicates (e.g. Architect + PM both flag "no rollback")
 * into ONE issue — merging attribution and keeping the worst severity — and bias
 * toward fewer. Deterministic (token-overlap, no model). Empty in → empty out, so
 * the panel contributes no penalty when nothing survives.
 */
export function synthesize(issues: RuleIssue[]): RuleIssue[] {
  const groups: { sig: Set<string>; anch: Set<string>; issue: RuleIssue; reviewers: string[] }[] = [];
  for (const raw of issues) {
    const { reviewer, body } = splitTag(raw.problem);
    const text = `${body} ${raw.fix}`;
    const sig = tokens(text);
    const anch = anchors(text);
    const dup = groups.find(
      (g) => jaccard(g.sig, sig) >= DEDUP_HIGH || (sharesAny(g.anch, anch) && jaccard(g.sig, sig) >= DEDUP_ANCHORED),
    );
    if (dup) {
      if (reviewer && !dup.reviewers.includes(reviewer)) dup.reviewers.push(reviewer);
      for (const a of anch) dup.anch.add(a);
      if (SEV_RANK[raw.severity] > SEV_RANK[dup.issue.severity]) dup.issue = raw; // keep the worst
    } else {
      groups.push({ sig, anch, issue: raw, reviewers: reviewer ? [reviewer] : [] });
    }
  }
  return groups.map((g) => {
    const { body } = splitTag(g.issue.problem);
    const tag = g.reviewers.length ? `[${g.reviewers.join(", ")}] ` : "";
    return { problem: `${tag}${body}`, fix: g.issue.fix, severity: g.issue.severity };
  });
}

/** Applicability gate (FR-004): does this reviewer's concern apply at all? */
async function applies(reviewer: Reviewer, ticket: string, blastRadius: string, model: ModelClient): Promise<boolean> {
  const match = (await model.complete(buildGatePrompt(reviewer, ticket, blastRadius), GATE_CALL)).match(/\{[\s\S]*\}/);
  if (!match) return true; // unparseable → don't silently skip a real concern
  try {
    const parsed = AppliesSchema.safeParse(JSON.parse(match[0]));
    return parsed.success ? parsed.data.applies : true;
  } catch {
    return true;
  }
}

/**
 * Evidence gate (FR-005): an issue must be grounded in a blast-radius file —
 * by naming the file (path/basename) OR by citing a code identifier that appears
 * in that file (e.g. `loadIndex`). The identifier match matters: reviewers often
 * cite the symbol, not the filename, in the structured problem/fix — matching only
 * the filename silently dropped real findings (and starved the Defender).
 */
function citesBlastRadius(issue: RuleIssue, files: BlastFile[]): boolean {
  const text = `${issue.problem} ${issue.fix}`;
  const hay = text.toLowerCase();
  const issueAnchors = anchors(text);
  return files.some(
    (f) =>
      hay.includes(f.path.toLowerCase()) ||
      hay.includes(path.posix.basename(f.path).toLowerCase()) ||
      sharesAny(issueAnchors, anchors(f.content)),
  );
}

/** Adversarial Defender (FR-006): keep an issue only if it survives a refutation attempt. */
async function survivesDefender(
  issue: RuleIssue,
  ticket: string,
  blastRadius: string,
  model: ModelClient,
  grounding: "file" | "ticket",
): Promise<boolean> {
  const strict = settings.review.defender !== "lenient";
  const match = (await model.complete(buildDefenderPrompt(issue.problem, issue.fix, ticket, blastRadius, strict, grounding), DEFENDER_CALL)).match(/\{[\s\S]*\}/);
  if (!match) return true; // unparseable → keep (don't drop an already-vetted issue on a parse error)
  try {
    const parsed = RefutedSchema.safeParse(JSON.parse(match[0]));
    return parsed.success ? !parsed.data.refuted : true;
  } catch {
    return true;
  }
}

/** Read the content of the ticket's blast-radius files, bounded by settings. */
/** Either the whole-file blast radius, or a signal that it's too big to review in one pass. */
type BlastResult = { files: BlastFile[] } | { tooLarge: string };

/**
 * Gather the blast-radius files WHOLE (no truncation — a half-function reads as
 * broken code, #87). If the radius exceeds the single-pass limits, return a
 * `tooLarge` signal instead of truncating or blowing the context window; the
 * caller turns that into a "split the ticket" finding. Chunked multi-pass review
 * for large radii is a follow-up.
 */
async function gatherBlastRadius(ticket: string): Promise<BlastResult> {
  if (!inGitRepo()) return { files: [] };
  let paths: string[];
  try {
    paths = resolveBlastRadius(ticket, listSourceFiles());
  } catch {
    return { files: [] };
  }
  if (paths.length > settings.review.maxFiles) return { tooLarge: `${paths.length} files` };

  const files: BlastFile[] = [];
  let total = 0;
  for (const path of paths) {
    let content: string;
    try {
      content = await fs.readFile(path, "utf8"); // whole file — never truncated
    } catch {
      continue; // unreadable (deleted, binary, race) — skip; never fabricate grounding
    }
    total += Buffer.byteLength(content);
    if (total > settings.review.maxTotalBytes) return { tooLarge: `${Math.round(total / 1024)} KB+` };
    files.push({ path, content });
  }
  return { files };
}

/** Panel-level error (not a reviewer finding): the change is too broad to review in one pass. */
function blastTooLarge(size: string): RuleIssue {
  return {
    problem: `[Panel] this ticket's blast radius is too large to review in one pass (${size}) — the change is too broad`,
    fix: "split this ticket into smaller, focused changes, each touching a small related set of files",
    severity: "major",
  };
}

/**
 * Run one reviewer through the funnel: applicability gate → draft → evidence
 * filter → Defender → cap + attribute. Most proposed issues die in the gate, the
 * filter, or the Defender. Exported so the funnel can be unit-tested on a single
 * reviewer (immune to how many reviewers the panel runs).
 */
export async function runReviewer(
  reviewer: Reviewer,
  ticket: string,
  blastRadius: string,
  files: BlastFile[],
  model: ModelClient,
  gateModel: ModelClient = model,
): Promise<RuleIssue[]> {
  // 1. applicability gate — a boolean, so it runs on the cheap TINY-tier model
  //    (#86); skip the (larger) draft entirely if the concern is N/A.
  if (!(await applies(reviewer, ticket, blastRadius, gateModel))) return [];

  // 2. draft (one retry on a malformed response).
  let issues: RuleIssue[] | null = null;
  for (let attempt = 0; attempt <= 1 && !issues; attempt++) {
    issues = parseIssues(await model.complete(buildReviewerPrompt(reviewer, ticket, blastRadius), { label: "draft" }));
  }
  if (!issues) return []; // unparseable after retry → don't fabricate (Principle VI)

  // 3. evidence filter — file-grounded reviewers must cite a blast-radius file;
  //    ticket-grounded reviewers (scope/readiness, e.g. PM) are exempt.
  const relevant = reviewer.grounding === "file" ? issues.filter((i) => citesBlastRadius(i, files)) : issues;

  // 4. adversarial Defender — each surviving issue must beat a refutation.
  const survivors =
    settings.review.defender === "off"
      ? relevant
      : (
          await Promise.all(
            relevant.map(async (i) => ((await survivesDefender(i, ticket, blastRadius, model, reviewer.grounding)) ? i : null)),
          )
        ).filter((i): i is RuleIssue => i !== null);

  // 5. cap severity + attribute to the reviewer.
  return survivors.map((i) => ({ problem: `[${reviewer.name}] ${i.problem}`, fix: i.fix, severity: capSeverity(i.severity) }));
}

export const reviewPanel: Rule = {
  id: "agentic/ticket-review",
  target: "ticket",
  type: "llm",
  description:
    "Agentic reviewer panel: expert personas read the ticket + its blast-radius files and flag material, file-grounded gaps (spec 004).",
  async run({ content, model }) {
    if (!settings.review.enabled) return { issues: [] }; // opt-in; the expensive tier
    if (!model) return { issues: [] }; // defensive: orchestrator requires a model for llm rules

    const ticket = content ?? "";
    const blast = await gatherBlastRadius(ticket);
    if ("tooLarge" in blast) return { issues: [blastTooLarge(blast.tooLarge)] }; // #87: error, don't truncate
    const files = blast.files;
    if (files.length === 0) return { issues: [] }; // FR-008: no grounding → stay silent

    const blastRadius = files.map((f) => `=== ${f.path} ===\n${f.content}`).join("\n\n");
    // Tier routing (#86): the gate is a boolean → TINY; the drafts/defender are
    // code-grounded judgment → DEEP. Only resolve a separate client when a tier is
    // actually configured — otherwise reuse the injected base model unchanged.
    const gateModel = tierConfigured("tiny") ? ((await resolveModel("tiny")) ?? model) : model;
    const deepModel = tierConfigured("deep") ? ((await resolveModel("deep")) ?? model) : model;
    // Each reviewer is its own span (#90) so the dev trace nests run → reviewer → call.
    const perReviewer = await Promise.all(
      PANEL_REVIEWERS.map((r) => withSpan(r.name, () => runReviewer(r, ticket, blastRadius, files, deepModel, gateModel))),
    );
    return { issues: synthesize(perReviewer.flat()) };
  },
};
