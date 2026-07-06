import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveModel } from "../../src/core/model.js";
import { loadFixtures, runVariant, renderTable, VARIANTS } from "./llm-tuning.js";

/**
 * #64 bench runner: `npm run bench:llm`. Measures recall (issues found on bad
 * files), false positives (issues on clean files), parse failures (truncation),
 * and latency for each tuning variant against the legibility fixture corpus.
 *
 * No model available → prints how to connect one and exits 0 (this is the
 * "prepared, connect later" state, not a failure). With Ollama up it prints the
 * before/after table that #64 asks for.
 */

const here = path.dirname(fileURLToPath(import.meta.url));

const model = await resolveModel("scoped");
if (!model) {
  console.log(
    [
      "",
      "  No LLM available — the harness is ready, the model is not.",
      "  Connect one and re-run `npm run bench:llm`:",
      "    • local:  start Ollama (OLLAMA_HOST, default http://localhost:11434) with the gemma4 model",
      "    • or API: set DETERMINISTIC_LLM_API_URL + DETERMINISTIC_LLM_API_KEY",
      "",
      "  For the parallel-speedup measurement, also set OLLAMA_NUM_PARALLEL to match",
      "  DETERMINISTIC_CONCURRENCY (see docs/llm-tuning.md).",
      "",
    ].join("\n"),
  );
  process.exit(0);
}

const fixtures = await loadFixtures(path.join(here, "fixtures", "legibility"));
console.log(`\n  Running ${VARIANTS.length} variant(s) over ${fixtures.length} fixture file(s)…`);

const results = [];
for (const variant of VARIANTS) {
  console.log(`  • ${variant.name}…`);
  results.push(await runVariant(model, variant, fixtures));
}

console.log(renderTable(results));
console.log("  Ship a variant ONLY if its recall matches baseline (no regression) AND parseFail is 0.\n");
