import type {
  CardType,
  PopulationType,
  Relic,
  RelicPhase,
  RelicRarity,
  RelicScale,
  RuleCheckResult,
  ScoreModifier,
} from "../types";
import { POPULATION_LABELS } from "../types";

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

/**
 * What scaling relics count (#2083), as the Blind stands when the hand is
 * scored. Every count is of something the player did or holds this Blind.
 */
export interface RelicCounts {
  /** Outputs in hand that are stale: compiled on a superseded snapshot or SAP. */
  staleInHand: number;
  /** Redlines corrected this Blind, in Inspect or on a figure. */
  redlinesFixed: number;
  /** Discards made this Blind. */
  discards: number;
  /** Hands played this Blind before this one. */
  handsPlayed: number;
}

/** No counts: a hand before anything has happened this Blind. */
const NO_RELIC_COUNTS: Readonly<RelicCounts> = Object.freeze({
  staleInHand: 0,
  redlinesFixed: 0,
  discards: 0,
  handsPlayed: 0,
});

/** The hand a relic sees: its scored cards and their rule results. */
export interface RelicHand {
  cards: readonly RelicCard[];
  ruleResults: readonly RuleCheckResult[];
  /** What scaling relics count; absent counts nothing. */
  counts?: RelicCounts;
}

/** Each rarity as the shop and Codex print it. */
export const RELIC_RARITY_LABELS: Readonly<Record<RelicRarity, string>> =
  Object.freeze({ COMMON: "Common", UNCOMMON: "Uncommon", RARE: "Rare" });

/**
 * A relic's rarity: its own, or common without one (#2083). Boss rewards
 * and older relics carry none.
 */
export function relicRarity(relic: Relic): RelicRarity {
  return relic.rarity ?? "COMMON";
}

/** What each scale counts, as a relic's ledger line names it. */
const SCALE_NOUNS: Readonly<Record<RelicScale, [string, string]>> =
  Object.freeze({
    STALE_IN_HAND: ["stale output in hand", "stale outputs in hand"],
    REDLINES_FIXED: ["redline fixed", "redlines fixed"],
    HANDS_PLAYED: ["hand played before", "hands played before"],
  });

const scaleCount = (scale: RelicScale, counts: RelicCounts) =>
  scale === "STALE_IN_HAND"
    ? counts.staleInHand
    : scale === "REDLINES_FIXED"
      ? counts.redlinesFixed
      : counts.handsPlayed;

const plural = (n: number, [one, many]: [string, string]) =>
  `${n} ${n === 1 ? one : many}`;

/**
 * A relic's modifier taken `count` times: Chips and +Mult add up, and ×Mult
 * grows by its step each time (×1.1 three times is ×1.3), so stacking never
 * compounds out of reach.
 */
function scaledModifier(
  relic: Relic,
  count: number,
  label: string
): ScoreModifier {
  const { chips, plusMult, xMult } = relic.modifier;
  return {
    sourceId: relic.modifier.sourceId,
    label,
    chips: chips * count,
    plusMult: plusMult * count,
    xMult: Math.round((1 + (xMult - 1) * count) * 1000) / 1000,
  };
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
  const counts = hand.counts ?? NO_RELIC_COUNTS;
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
      if (!met) continue;
      if (!trigger.scale) {
        modifiers.push(relic.modifier);
        continue;
      }
      const n = scaleCount(trigger.scale, counts);
      if (n > 0) {
        modifiers.push(
          scaledModifier(
            relic,
            n,
            `${relic.name} (${plural(n, SCALE_NOUNS[trigger.scale])})`
          )
        );
      }
      continue;
    }
    if (trigger.phase === "ON_DISCARD") {
      if (trigger.stacks && counts.discards > 0) {
        modifiers.push(
          scaledModifier(
            relic,
            counts.discards,
            `${relic.name} (${plural(counts.discards, ["discard", "discards"])})`
          )
        );
      }
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
      n +
      (r.trigger?.phase === "ON_DISCARD" ? (r.trigger.freeDiscards ?? 0) : 0),
    0
  );
}

/**
 * Extra CPU each Blind starts with, from ON_BLIND_START relics. `act` is the
 * run's act, from 0: a relic with `cpuPerAct` adds that much more per act
 * past the first.
 */
export function blindStartCpu(relics: readonly Relic[], act = 0): number {
  const acts = Math.max(0, Math.trunc(act));
  return relics.reduce(
    (n, r) =>
      n +
      (r.trigger?.phase === "ON_BLIND_START"
        ? r.trigger.cpu + (r.trigger.cpuPerAct ?? 0) * acts
        : 0),
    0
  );
}

/** A modifier's bonus in words, e.g. "+15 Chips and +2 Mult". */
function bonusText(modifier: ScoreModifier): string {
  const parts: string[] = [];
  if (modifier.chips) parts.push(`+${modifier.chips} Chips`);
  if (modifier.plusMult) parts.push(`+${modifier.plusMult} Mult`);
  if (modifier.xMult !== 1) parts.push(`×${modifier.xMult} Mult`);
  return parts.length > 0 ? parts.join(" and ") : "nothing";
}

/** Each card type as a trigger line names it. */
const CARD_TYPE_NOUNS: Readonly<Record<CardType, string>> = Object.freeze({
  TABLE: "Table",
  LISTING: "Listing",
  FIGURE: "Figure",
  SUBJECT_TOKEN: "subject token",
});

/** What a scaling relic counts, in the trigger line. */
const SCALE_EACH: Readonly<Record<RelicScale, string>> = Object.freeze({
  STALE_IN_HAND: "each stale output in hand",
  REDLINES_FIXED: "each redline fixed this Blind",
  HANDS_PLAYED: "each hand already played this Blind",
});

/**
 * A relic's trigger in one plain sentence, for the Codex (#2083): when it
 * fires, on what, and what it scales with.
 */
export function describeRelicTrigger(relic: Relic): string {
  const trigger = relic.trigger;
  const bonus = bonusText(relic.modifier);
  if (!trigger) return `Every hand: ${bonus}.`;
  if (trigger.phase === "ON_HAND_PLAYED") {
    const when =
      trigger.requires === "FIGURE_IN_HAND"
        ? "When the hand holds a Figure"
        : trigger.requires === "NO_REDLINES"
          ? "When the hand has no redline"
          : "Every hand";
    return trigger.scale
      ? `${when}: ${bonus} for ${SCALE_EACH[trigger.scale]}.`
      : `${when}: ${bonus}.`;
  }
  if (trigger.phase === "ON_CARD_SCORED") {
    const what = [
      trigger.qcPassedOnly ? "QC ✓" : null,
      trigger.population ? POPULATION_LABELS[trigger.population] : null,
      trigger.cardType ? CARD_TYPE_NOUNS[trigger.cardType] : "output",
    ]
      .filter(Boolean)
      .join(" ");
    return trigger.retrigger
      ? `Each ${what} scored scores its own Chips and Mult again.`
      : `Each ${what} scored: ${bonus}.`;
  }
  if (trigger.phase === "ON_DISCARD") {
    const parts: string[] = [];
    if (trigger.freeDiscards) {
      parts.push(
        `The first ${trigger.freeDiscards === 1 ? "discard" : `${trigger.freeDiscards} discards`} of each Blind cost${trigger.freeDiscards === 1 ? "s" : ""} no base CPU.`
      );
    }
    if (trigger.stacks) {
      parts.push(`Each discard this Blind adds ${bonus} to every later hand.`);
    }
    return parts.join(" ");
  }
  return trigger.cpuPerAct
    ? `Each Blind starts with +${trigger.cpu} CPU, and +${trigger.cpuPerAct} more for each act after the first.`
    : `Each Blind starts with +${trigger.cpu} CPU.`;
}
