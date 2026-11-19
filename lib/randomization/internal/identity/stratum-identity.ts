import type { StructuralStratumKey } from "../../types";

const COMPARISON_PREFIX = /^(<=|>=|<|>)/;

/**
 * Serializes an ordered structural stratum key (factorId + levelId pairs) into
 * an unambiguous canonical string that never collides on human labels,
 * punctuation, or delimiter-shaped IDs.
 */
export function serializeStructuralStratumKey(
  entries: StructuralStratumKey
): string {
  return JSON.stringify(
    entries.map((entry) => [entry.factorId, entry.levelId])
  );
}

/**
 * Formats an ordered list of human-readable level labels for display or
 * `{STRATUM}` token substitution only. Comparison-prefixed values (`<`, `<=`,
 * `>`, `>=`) remain intact; other values use their uppercase first three
 * non-empty characters. Never use this output as an authoritative stratum key.
 */
export function formatStratumHumanCode(labels: readonly string[]): string {
  if (labels.length === 0) return "ALL";
  return labels
    .map((raw) => {
      const trimmed = raw.trim();
      if (COMPARISON_PREFIX.test(trimmed)) {
        return trimmed;
      }
      return trimmed.slice(0, 3).toUpperCase();
    })
    .join("-");
}
