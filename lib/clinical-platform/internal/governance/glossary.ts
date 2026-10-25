/**
 * The business glossary (#2638): the clinical and operations terms the
 * governed metrics are defined in, read from the site's one glossary,
 * `CANONICAL_GLOSSARY`, rather than kept as a second copy.
 */
import { CANONICAL_GLOSSARY, type TermDefinition } from "@/lib/term-glossary";
import type { BusinessGlossaryEntry, MetricDefinition } from "../../types";
import { METRIC_REGISTRY } from "../semantic/registry";

/**
 * Terms the business glossary lists although no metric links them: the
 * standards the platform's data follows, randomisation, which a metric gap
 * needs, and treatment-emergent adverse events, which the study data flags.
 */
export const BUSINESS_GLOSSARY_EXTRA_TERMS: readonly string[] = Object.freeze([
  "cdisc-term",
  "sdtm-term",
  "ecrf-term",
  "randomisation-term",
  "teae-term",
]);

/** What `businessGlossary` reads; both default to the platform's own. */
export interface BusinessGlossaryOptions {
  readonly metrics?: readonly MetricDefinition[];
  readonly glossary?: readonly TermDefinition[];
}

/**
 * The business glossary: every term a metric links, and the terms in
 * `BUSINESS_GLOSSARY_EXTRA_TERMS`, each with the metrics that link it.
 *
 * @param options - The metrics and the glossary to read.
 * @returns The entries, by term name ignoring case.
 * @throws Error when a metric or the extra list names a term the glossary
 *   does not hold.
 */
export function businessGlossary(
  options: BusinessGlossaryOptions = {}
): BusinessGlossaryEntry[] {
  const metrics = options.metrics ?? METRIC_REGISTRY;
  const glossary = options.glossary ?? CANONICAL_GLOSSARY;
  const terms = new Map(glossary.map((t) => [t.key, t]));
  const users = new Map<string, string[]>();
  for (const key of BUSINESS_GLOSSARY_EXTRA_TERMS) users.set(key, []);
  for (const metric of metrics) {
    if (metric.glossaryTerm === null) continue;
    users.set(metric.glossaryTerm, [
      ...(users.get(metric.glossaryTerm) ?? []),
      metric.id,
    ]);
  }
  return [...users]
    .map(([key, ids]): BusinessGlossaryEntry => {
      const term = terms.get(key);
      if (term === undefined) {
        throw new Error(`the glossary has no term ${key}`);
      }
      return {
        key,
        term: term.canonical,
        definition: term.definition,
        synonyms: term.aliases ?? [],
        source: term.source ?? null,
        metrics: ids,
      };
    })
    .sort((a, b) =>
      a.term.localeCompare(b.term, "en", { sensitivity: "base" })
    );
}

/** Lower-case words of a search. */
export function searchWords(text: string): string[] {
  return text.toLowerCase().split(/\s+/).filter(Boolean);
}

/**
 * Searches the business glossary. Every word of `text` must appear in the
 * term, a synonym, the definition, the source or the id of a metric that
 * links it, ignoring case. An empty search matches every entry.
 *
 * @param entries - Entries from `businessGlossary`.
 * @param text - The search.
 * @returns The matching entries, in their glossary order.
 */
export function searchBusinessGlossary(
  entries: readonly BusinessGlossaryEntry[],
  text: string
): BusinessGlossaryEntry[] {
  const wanted = searchWords(text);
  return entries.filter((entry) => {
    const haystack = [
      entry.term,
      ...entry.synonyms,
      entry.definition,
      entry.source ?? "",
      ...entry.metrics,
    ]
      .join(" ")
      .toLowerCase();
    return wanted.every((word) => haystack.includes(word));
  });
}
