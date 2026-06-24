import type { Rule } from "../../core/rule.js";
import { resolveModel } from "../../core/model.js";
import { settings } from "../../core/settings.js";
import { reviewRepo } from "./panel.js";

/**
 * The agentic repo-review panel as a registered repo Rule (#72). Like
 * `coverage-agentic`, it's declared `static` and resolves its OWN model when it
 * runs — so it never forces model resolution while disabled, and the orchestrator
 * doesn't treat the whole repo target as model-required.
 *
 * OFF by default (`settings.repoReview.enabled`): this is the expensive judgment
 * tier. When enabled it runs the panel (hand-rolled, or Mastra-orchestrated if
 * `settings.repoReview.useMastra`) and emits the reconciled issues. No model →
 * a clean pass, never a crash.
 */
export const repoReviewPanel: Rule = {
  id: "static/repo-review-panel",
  target: "repo",
  type: "static",
  description: "Agentic expert panel (Architect + Testing-expert) reviewing the whole repo. Opt-in.",
  async run({ path: root }) {
    if (!settings.repoReview.enabled) return { issues: [] };
    const model = await resolveModel("deep");
    if (!model) return { issues: [] };

    if (settings.repoReview.useMastra) {
      // Lazy import so Mastra/AI-SDK only load when the Mastra path is actually used.
      const { reviewRepoWithMastra } = await import("./mastra-panel.js");
      return { issues: await reviewRepoWithMastra(root) };
    }
    return { issues: await reviewRepo(root, model) };
  },
};
