// @deterministic score: 98/100  scored: 2026-06-21T08:19:11.655Z
//   static/file-length  100/100  w1  24 lines — within the 300-line soft cap.
//   static/missing-types  100/100  w2  No `any` annotations.
//   static/function-length  100/100  w1  Longest function (run) is 12 lines — within the 50-line cap.
//   llm/intent-legibility  95/100  w3  Clear intent: this is a static analysis rule that penalizes files exceeding 300 lines, with obvious naming, structure, and purpose.
// @deterministic:end
import type { Rule } from "../../core/rule.js";

const SOFT_CAP = 300; // lines

/** Static: long files are hard for humans AND agents to reason about. */
export const fileLength: Rule = {
  id: "static/file-length",
  target: "file",
  type: "static",
  description: `Penalizes files longer than ~${SOFT_CAP} lines.`,
  run({ content }) {
    const lines = (content ?? "").split("\n").length;
    const over = Math.max(0, lines - SOFT_CAP);
    return {
      score: Math.max(0, Math.round(100 - over / 5)),
      weight: 1,
      reasoning:
        over === 0
          ? `${lines} lines — within the ${SOFT_CAP}-line soft cap.`
          : `${lines} lines — ${over} over the ${SOFT_CAP}-line soft cap; consider splitting.`,
    };
  },
};
