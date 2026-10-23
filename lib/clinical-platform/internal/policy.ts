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
 * Phrases that claim compliance, validation, readiness or tamper-proofing for
 * a clinical tool. Unlike the single-word rule above, these are wrong in any
 * context, so they can be searched for across whole source files, comments
 * included.
 */
const CLINICAL_CLAIM_PHRASES: readonly { pattern: RegExp; label: string }[] = [
  {
    pattern:
      /\b(?:CDISC|CDASH(?:IG)?|SDTM(?:IG)?|ODM|FDA|GxP|Part\s*11|21\s*CFR|regulatory)\b[\w .&;/()-]{0,30}?[\s-]compliant\b/gi,
    label: 'a standard or regulation followed by "compliant"',
  },
  {
    pattern:
      /\b100\s*%\s*[\w .&;-]{0,30}?\b(?:compliant|conformance verified)\b/gi,
    label: "a 100% compliance score",
  },
  {
    pattern:
      /\bcompl(?:y|ies)\s+with\b[^.\n]{0,80}?\b(?:CDISC|CDASH|SDTM|Part\s*11|21\s*CFR|regulatory)\b/gi,
    label: '"comply with" a standard or regulation',
  },
  {
    pattern: /\bimmutable\s+(?:chronological\s+)?(?:audit|trail|log)\b/gi,
    label: "an immutable audit trail",
  },
  { pattern: /\bGxP[\s-]+ready\b/gi, label: "GxP readiness" },
  { pattern: /\bPart\s*11\s*:\s*valid\b/gi, label: "a Part 11 pass" },
  { pattern: /\bPart\s*11\s+conformance\b/gi, label: "Part 11 conformance" },
  {
    pattern: /\bsatisfying\s+(?:FDA\s+)?21\s*CFR\b/gi,
    label: "satisfying 21 CFR",
  },
  { pattern: /\bLive\s+21\s*CFR\b/gi, label: "a live 21 CFR system" },
  { pattern: /\bconforms?\s+strictly\b/gi, label: "strict conformance" },
];

/**
 * Finds clinical compliance claims that no synthetic demo can make, such as
 * "CDASH 2.2 compliant", "100% Compliant" or "immutable audit trail". The
 * sanctioned disclaimers are removed first, as in `checkRegulatoryWording`.
 *
 * @param text - Copy or source text to check.
 * @returns One finding per matched phrase, grouped by phrase rule.
 */
export function findClinicalClaims(text: string): PolicyFinding[] {
  const cleaned = ALLOWED_DISCLAIMERS.reduce(
    (acc, pattern) => acc.replace(pattern, " "),
    text
  );
  return CLINICAL_CLAIM_PHRASES.flatMap(({ pattern, label }) =>
    Array.from(cleaned.matchAll(pattern), (match) => ({
      rule: "regulatory-wording" as const,
      message: `"${match[0]}" claims ${label}; describe what is implemented instead.`,
    }))
  );
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
