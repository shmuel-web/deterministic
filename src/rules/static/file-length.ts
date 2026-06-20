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
