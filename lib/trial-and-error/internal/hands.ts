import {
  HandTypeSchema,
  type HandBaseScore,
  type HandClassification,
  type HandLevels,
  type HandType,
  type TlfCard,
} from "../types";

/** Base Chips and +Mult per hand, as pinned by the governing map (#890). */
export const HAND_BASE_SCORES: Readonly<Record<HandType, HandBaseScore>> =
  Object.freeze({
    HIGH_TABLE: {
      handType: "HIGH_TABLE",
      baseChips: 15,
      baseMult: 1,
      description: "Single validated output",
    },
    TLF_PAIR: {
      handType: "TLF_PAIR",
      baseChips: 30,
      baseMult: 2,
      description: "Table plus its supporting Listing",
    },
    TLF_TWO_PAIR: {
      handType: "TLF_TWO_PAIR",
      baseChips: 60,
      baseMult: 4,
      description: "Two Tables plus two supporting Listings",
    },
    POPULATION_FLUSH: {
      handType: "POPULATION_FLUSH",
      baseChips: 100,
      baseMult: 7,
      description: "Five outputs sharing one population snapshot",
    },
    CSR_STRAIGHT: {
      handType: "CSR_STRAIGHT",
      baseChips: 140,
      baseMult: 10,
      description:
        "Disposition, Baseline, Primary Efficacy, Safety AE, Patient Listing",
    },
    EFFICACY_FULL_HOUSE: {
      handType: "EFFICACY_FULL_HOUSE",
      baseChips: 160,
      baseMult: 14,
      description: "Three Tables plus two dependent Figures",
    },
    MEDDRA_FIVE_OF_A_KIND: {
      handType: "MEDDRA_FIVE_OF_A_KIND",
      baseChips: 200,
      baseMult: 18,
      description: "Five distinct MedDRA System Organ Class tables",
    },
  });

/** Display names for each hand type. */
export const HAND_NAMES: Readonly<Record<HandType, string>> = Object.freeze({
  HIGH_TABLE: "High Table",
  TLF_PAIR: "TLF Pair",
  TLF_TWO_PAIR: "TLF Two Pair",
  POPULATION_FLUSH: "Population Flush",
  CSR_STRAIGHT: "CSR Straight",
  EFFICACY_FULL_HOUSE: "Efficacy Full House",
  MEDDRA_FIVE_OF_A_KIND: "MedDRA Five of a Kind",
});

/**
 * One worked example of each hand, in the game's own output numbers, for the
 * hand cheat sheet (#1081). Kept beside `HAND_NAMES` so hand wording has one
 * source.
 */
export const HAND_EXAMPLES: Readonly<Record<HandType, string>> = Object.freeze({
  HIGH_TABLE: "Table 14.1.1 played on its own",
  TLF_PAIR: "Table 14.3.1 + Listing 16.2.7",
  TLF_TWO_PAIR:
    "Table 14.3.1 + Listing 16.2.7, and Table 14.1.1 + Listing 16.2.4",
  POPULATION_FLUSH: "Five Safety outputs compiled on the same snapshot",
  CSR_STRAIGHT:
    "Disposition, Baseline, Primary Efficacy and Safety AE Tables + a patient Listing",
  EFFICACY_FULL_HOUSE:
    "Three Tables + Figures 14.3.1 and 14.3.3, each drawn from a Table in the hand",
  MEDDRA_FIVE_OF_A_KIND:
    "Five SOC tables, such as Table 14.3.2.1 (Cardiac Disorders)",
});

/**
 * What each level above 1 adds to a hand's base, balanced in T&E-UX-05
 * (#947). A hand at level `n` scores its base plus `n - 1` bonuses.
 */
export const HAND_LEVEL_BONUS: Readonly<
  Record<HandType, { chips: number; mult: number }>
> = Object.freeze({
  HIGH_TABLE: { chips: 10, mult: 1 },
  TLF_PAIR: { chips: 15, mult: 1 },
  TLF_TWO_PAIR: { chips: 20, mult: 2 },
  POPULATION_FLUSH: { chips: 25, mult: 2 },
  CSR_STRAIGHT: { chips: 30, mult: 3 },
  EFFICACY_FULL_HOUSE: { chips: 35, mult: 3 },
  MEDDRA_FIVE_OF_A_KIND: { chips: 35, mult: 3 },
});

/**
 * A hand's base Chips and +Mult at a level: `HAND_BASE_SCORES` plus the
 * level bonus. Levels below 1 (or not whole) count as level 1. Pure.
 */
export function leveledBase(handType: HandType, level = 1): HandBaseScore {
  const base = HAND_BASE_SCORES[handType];
  const bonus = HAND_LEVEL_BONUS[handType];
  const extra = Number.isInteger(level) && level > 1 ? level - 1 : 0;
  return {
    ...base,
    baseChips: base.baseChips + extra * bonus.chips,
    baseMult: base.baseMult + extra * bonus.mult,
  };
}

/** Every hand at level 1, never played: the start of a run. */
export function initialHandLevels(): HandLevels {
  return Object.fromEntries(
    HandTypeSchema.options.map((handType) => [
      handType,
      { level: 1, playedCount: 0 },
    ])
  ) as HandLevels;
}

/** One row of the hand table in Run Info and the hand cheat sheet. */
export interface HandLevelRow {
  handType: HandType;
  name: string;
  level: number;
  /** Base Chips at this level. */
  chips: number;
  /** Base +Mult at this level. */
  mult: number;
  playedCount: number;
  /** What the hand is made of, from `HAND_BASE_SCORES`. */
  description: string;
  /** A worked example, from `HAND_EXAMPLES`. */
  example: string;
}

/**
 * The run's hand table, weakest hand first, with each hand's base at its
 * current level. The UI renders it and never adds a bonus itself. Pure.
 */
export function handLevelTable(levels: HandLevels): HandLevelRow[] {
  return HandTypeSchema.options.map((handType) => {
    const { level, playedCount } = levels[handType];
    const base = leveledBase(handType, level);
    return {
      handType,
      name: HAND_NAMES[handType],
      level,
      chips: base.baseChips,
      mult: base.baseMult,
      playedCount,
      description: HAND_BASE_SCORES[handType].description,
      example: HAND_EXAMPLES[handType],
    };
  });
}

/**
 * The card fields hand detection reads. `stale` marks an output compiled
 * against a population snapshot that has since changed; it cannot make a
 * Population Flush.
 */
export type ClassifiableCard = Pick<
  TlfCard,
  "id" | "cardType" | "population" | "chips" | "topic" | "csrStage" | "soc"
> & { stale?: boolean };

const MAX_HAND = 5;

function isSupportingPair(a: ClassifiableCard, b: ClassifiableCard): boolean {
  const table = a.cardType === "TABLE" ? a : b.cardType === "TABLE" ? b : null;
  const listing =
    a.cardType === "LISTING" ? a : b.cardType === "LISTING" ? b : null;
  return table !== null && listing !== null && table.topic === listing.topic;
}

const byType = (
  cards: readonly ClassifiableCard[],
  type: TlfCard["cardType"]
) => cards.filter((card) => card.cardType === type);

/** Whether a set of cards forms exactly the given hand. */
const MATCHERS: Readonly<
  Record<HandType, (cards: readonly ClassifiableCard[]) => boolean>
> = {
  MEDDRA_FIVE_OF_A_KIND: (cards) =>
    cards.length === 5 &&
    cards.every((c) => c.cardType === "TABLE" && c.soc !== undefined) &&
    new Set(cards.map((c) => c.soc)).size === 5,
  EFFICACY_FULL_HOUSE: (cards) => {
    if (cards.length !== 5) return false;
    const tables = byType(cards, "TABLE");
    const figures = byType(cards, "FIGURE");
    const topics = new Set(tables.map((t) => t.topic));
    return (
      tables.length === 3 &&
      figures.length === 2 &&
      figures.every((f) => topics.has(f.topic))
    );
  },
  CSR_STRAIGHT: (cards) =>
    cards.length === 5 &&
    new Set(cards.map((c) => c.csrStage).filter((s) => s !== undefined))
      .size === 5,
  POPULATION_FLUSH: (cards) =>
    cards.length === 5 &&
    cards.every(
      (c) =>
        c.cardType !== "SUBJECT_TOKEN" &&
        !c.stale &&
        c.population === cards[0].population
    ),
  TLF_TWO_PAIR: (cards) => {
    if (cards.length !== 4) return false;
    const [t1, t2] = byType(cards, "TABLE");
    const [l1, l2] = byType(cards, "LISTING");
    if (!t1 || !t2 || !l1 || !l2 || t1.topic === t2.topic) return false;
    return (
      (isSupportingPair(t1, l1) && isSupportingPair(t2, l2)) ||
      (isSupportingPair(t1, l2) && isSupportingPair(t2, l1))
    );
  },
  TLF_PAIR: (cards) =>
    cards.length === 2 && isSupportingPair(cards[0], cards[1]),
  HIGH_TABLE: (cards) => cards.length === 1,
};

/** Every non-empty subset of up to five indices, in increasing index order. */
function subsets(size: number): number[][] {
  const result: number[][] = [];
  const walk = (start: number, current: number[]) => {
    if (current.length > 0) result.push(current);
    if (current.length === MAX_HAND) return;
    for (let i = start; i < size; i++) walk(i + 1, [...current, i]);
  };
  walk(0, []);
  return result;
}

/** More Chips first; then the subset whose cards were selected earliest. */
function betterSubset(
  a: number[],
  b: number[],
  cards: readonly ClassifiableCard[]
): boolean {
  const chips = (s: number[]) => s.reduce((sum, i) => sum + cards[i].chips, 0);
  const diff = chips(a) - chips(b);
  if (diff !== 0) return diff > 0;
  for (let k = 0; k < Math.min(a.length, b.length); k++) {
    if (a[k] !== b[k]) return a[k] < b[k];
  }
  return a.length < b.length;
}

/**
 * Detects the best hand a selection makes and which cards score. The player
 * never declares a hand: every subset of up to five cards is considered, the
 * highest-ranked hand wins, and ties go to the subset with more Chips, then to
 * the earliest-selected cards. Cards outside the winning subset are kickers
 * and do not score. Returns `null` for an empty selection. Pure.
 *
 * With `allowed`, only those hand types are considered, so a staged Boss
 * that accepts a lower hand is not shadowed by a higher one it refuses
 * (#1077). When no allowed hand matches, the unrestricted result is
 * returned, so a refusal can still say what the selection is.
 */
export function classifyHand(
  cards: readonly ClassifiableCard[],
  allowed?: readonly HandType[]
): HandClassification | null {
  if (cards.length === 0) return null;
  if (allowed) {
    const restricted = bestHand(cards, allowed);
    if (restricted) return restricted;
  }
  return bestHand(cards, HandTypeSchema.options);
}

/** The highest-ranked of `handTypes` the cards make, or null. */
function bestHand(
  cards: readonly ClassifiableCard[],
  handTypes: readonly HandType[]
): HandClassification | null {
  const candidates = subsets(cards.length);
  const ranked = [...HandTypeSchema.options]
    .reverse()
    .filter((handType) => handTypes.includes(handType));
  for (const handType of ranked) {
    let best: number[] | null = null;
    for (const subset of candidates) {
      if (!MATCHERS[handType](subset.map((i) => cards[i]))) continue;
      if (best === null || betterSubset(subset, best, cards)) best = subset;
    }
    if (best !== null) {
      return { handType, scoringCardIds: best.map((i) => cards[i].id) };
    }
  }
  return null;
}
