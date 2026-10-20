/**
 * Platform policy checks from ADR 0066: the regulatory wording rule and the
 * medallion flow rule. Pure functions, so pages, tests and later stages can
 * all apply the same rule.
 */
import { LAYER_RANK } from "../presets";
import type { LineageEdge, PolicyFinding } from "../types";

/**
 * Disclaimers that name the banned words in order to deny them. They are
 * removed before the text is searched.
 */
const ALLOWED_DISCLAIMERS = [
  /\bnot\s+(?:a\s+)?validated\s+system\b/gi,
  /\bnot\s+(?:a\s+)?compliance\s+claim\b/gi,
];

/** Claims a platform page must never make. `non-compliant` names a finding, not a claim. */
const PROHIBITED_CLAIM = /(?<!non-)\b(compliant|validated)\b/gi;

/**
 * Finds compliance or validation claims in page copy. Platform pages say
 * "designed to these controls"; they never call the platform compliant or
 * validated. The sanctioned disclaimer is allowed.
 *
 * @param text - Copy to check.
 * @returns One finding per prohibited word, in order of appearance.
 */
export function checkRegulatoryWording(text: string): PolicyFinding[] {
  const cleaned = ALLOWED_DISCLAIMERS.reduce(
    (acc, pattern) => acc.replace(pattern, " "),
    text
  );
  return Array.from(cleaned.matchAll(PROHIBITED_CLAIM), (match) => ({
    rule: "regulatory-wording" as const,
    message: `"${match[1]}" makes a claim; say "designed to these controls" instead.`,
  }));
}

/**
 * Checks that a lineage edge flows towards gold. Bronze feeds silver and
 * gold, silver feeds silver and gold, and gold never writes back into a
 * lower layer.
 *
 * @param edge - Column-level lineage edge.
 * @returns A finding when the edge flows backwards, otherwise `null`.
 */
export function checkLayerFlow(edge: LineageEdge): PolicyFinding | null {
  if (LAYER_RANK[edge.to.layer] >= LAYER_RANK[edge.from.layer]) return null;
  return {
    rule: "layer-flow",
    message: `${edge.from.productId}.${edge.from.column} (${edge.from.layer}) cannot feed ${edge.to.productId}.${edge.to.column} (${edge.to.layer}).`,
  };
}
