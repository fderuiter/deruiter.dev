import type {
  CardType,
  PopulationType,
  Relic,
  RelicPhase,
  RuleCheckResult,
  ScoreModifier,
} from "../types";

/**
 * SOP relic triggers (#924). Pure: which relics fire in a hand, and what
 * they add, is a function of the rack, the scored cards and their rule
 * results. Relics fire in rack order within each phase.
 */

/** A relic's phase: its trigger's, or ON_HAND_PLAYED without one. */
export function relicPhase(relic: Relic): RelicPhase {
  return relic.trigger?.phase ?? "ON_HAND_PLAYED";
}

/** Each phase as the rack and Run Info label it. */
export const RELIC_PHASE_LABELS: Readonly<Record<RelicPhase, string>> =
  Object.freeze({
    ON_BLIND_START: "Blind start",
    ON_DISCARD: "On discard",
    ON_CARD_SCORED: "Card scored",
    ON_HAND_PLAYED: "Hand played",
  });

/** A scored card, as the relic triggers see it. */
export interface RelicCard {
  id: string;
  cardType: CardType;
  population: PopulationType;
  chips: number;
  mult: number;
  /** Stamped QC ✓: every cell reviewed, no open redline. */
  qcPassed: boolean;
  /** Its score was cancelled (stale, blocked or debuffed): nothing retriggers. */
  cancelled: boolean;
}

/** The hand a relic sees: its scored cards and their rule results. */
export interface RelicHand {
  cards: readonly RelicCard[];
  ruleResults: readonly RuleCheckResult[];
}

/**
 * The id a relic's contribution on one card carries in the ledger and the
 * timeline, like `TLF-PAIR@card` for a rule.
 */
export const relicCardSourceId = (relicId: string, cardId: string) =>
  `${relicId}@${cardId}`;

/** The score modifiers the rack's relics add to a hand, in rack order. */
export function relicModifiers(
  relics: readonly Relic[],
  hand: RelicHand
): ScoreModifier[] {
  const modifiers: ScoreModifier[] = [];
  const redline = hand.ruleResults.some((r) => !r.passed);
  const figure = hand.cards.some((c) => c.cardType === "FIGURE");
  for (const relic of relics) {
    const trigger = relic.trigger;
    if (!trigger) {
      modifiers.push(relic.modifier);
      continue;
    }
    if (trigger.phase === "ON_HAND_PLAYED") {
      const met =
        trigger.requires === "FIGURE_IN_HAND"
          ? figure
          : trigger.requires === "NO_REDLINES"
            ? !redline
            : true;
      if (met) modifiers.push(relic.modifier);
      continue;
    }
    if (trigger.phase !== "ON_CARD_SCORED") continue;
    for (const card of hand.cards) {
      if (trigger.cardType && card.cardType !== trigger.cardType) continue;
      if (trigger.population && card.population !== trigger.population) {
        continue;
      }
      if (trigger.qcPassedOnly && !card.qcPassed) continue;
      if (trigger.retrigger && card.cancelled) continue;
      modifiers.push({
        sourceId: relicCardSourceId(relic.id, card.id),
        label: trigger.retrigger
          ? `${relic.name} retriggers ${card.id}`
          : `${relic.name} on ${card.id}`,
        chips: trigger.retrigger ? card.chips : relic.modifier.chips,
        plusMult: trigger.retrigger ? card.mult : relic.modifier.plusMult,
        xMult: trigger.retrigger ? 1 : relic.modifier.xMult,
      });
    }
  }
  return modifiers;
}

/** Discards each Blind that cost no base CPU, from ON_DISCARD relics. */
export function freeDiscards(relics: readonly Relic[]): number {
  return relics.reduce(
    (n, r) =>
      n + (r.trigger?.phase === "ON_DISCARD" ? r.trigger.freeDiscards : 0),
    0
  );
}

/** Extra CPU each Blind starts with, from ON_BLIND_START relics. */
export function blindStartCpu(relics: readonly Relic[]): number {
  return relics.reduce(
    (n, r) => n + (r.trigger?.phase === "ON_BLIND_START" ? r.trigger.cpu : 0),
    0
  );
}
