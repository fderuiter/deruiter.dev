import type { SapAmendment, SapRule, SapRulebook } from "../types";

/**
 * SAP Amendments (#1086): the rulebook in force once the run has used some.
 * Pure: amending is a fold over the amendments in the order they were used.
 */

/** The rule an amendment changes in a rulebook: its category's, never a fatal one. */
export function amendedRule(
  rulebook: SapRulebook,
  amendment: SapAmendment
): SapRule | null {
  return (
    rulebook.rules.find(
      (rule) =>
        rule.category === amendment.category && rule.severity !== "FATAL"
    ) ?? null
  );
}

/** A rule with one amendment applied. */
function amendRule(rule: SapRule, amendment: SapAmendment): SapRule {
  const correctionMultBonus = rule.correctionMultBonus + amendment.bonusDelta;
  const redlineMultPenalty = rule.redlineMultPenalty + amendment.penaltyDelta;
  return {
    ...rule,
    correctionMultBonus,
    redlineMultPenalty,
    consequence: `${rule.consequence} Amended by ${amendment.name}: correcting it now earns +${correctionMultBonus} Mult, and a standing redline costs −${redlineMultPenalty} Mult.`,
  };
}

/**
 * The rulebook with `amendments` applied in order. Each adds its code to the
 * rulebook's id, so outputs compiled under the old id can be told apart.
 * With none, the rulebook comes back unchanged.
 */
export function amendRulebook(
  rulebook: SapRulebook,
  amendments: readonly SapAmendment[]
): SapRulebook {
  return amendments.reduce<SapRulebook>((book, amendment) => {
    const target = amendedRule(book, amendment);
    if (!target) return book;
    return {
      ...book,
      id: `${book.id}-${amendment.code}`,
      title: `${book.title}, amended (${amendment.name})`,
      rules: book.rules.map((rule) =>
        rule.id === target.id ? amendRule(rule, amendment) : rule
      ),
    };
  }, rulebook);
}
