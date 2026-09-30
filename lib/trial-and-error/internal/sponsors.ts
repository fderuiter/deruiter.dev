import type {
  CardType,
  HandLevels,
  HandType,
  PopulationType,
  SponsorId,
} from "../types";
import { initialHandLevels } from "./hands";

/**
 * Starter sponsors (#950): the Balatro "decks". The sponsor is the client
 * whose compound the player's CRO develops across the run. Each one is data:
 * a starting kit and a rule twist the run reducer applies, never code.
 */

/** Extra Chips a sponsor's deck gives every card that matches. */
export interface CardChipBonus {
  /** Only cards of this kind; any kind without it. */
  cardType?: CardType;
  /** Only cards on this analysis set; any set without it. */
  population?: PopulationType;
  chips: number;
}

/** A sponsor, as modifiers the run reducer knows how to apply. */
export interface Sponsor {
  id: SponsorId;
  name: string;
  /** Who the client is, in one line. */
  description: string;
  /** The rule twist in one line, or null for none. */
  twist: string | null;
  /** A shop relic the run starts with in its rack, by id. */
  startingRelicId: string | null;
  /** The study budget the run starts with, in $k. */
  startingBudget: number;
  /** Hand levels above 1 the run starts with. */
  startingHandLevels: Partial<Record<HandType, number>>;
  /** Cards added to every Blind's hand size. */
  handSizeBonus: number;
  /** Every Blind's quota is multiplied by this, rounded up to the next 100. */
  quotaFactor: number;
  /** The deck's weighting: extra Chips for the cards the client favours. */
  cardChips: readonly CardChipBonus[];
}

/** The sponsor a run has when none is chosen. */
export const DEFAULT_SPONSOR_ID: SponsorId = "VIRTUAL_BIOTECH";

/** The most cards a hand can hold, as the scenario schema allows. */
const MAX_HAND_SIZE = 12;

/** Every sponsor, in New Run order, by id. */
export const SPONSORS: Readonly<Record<SponsorId, Sponsor>> = Object.freeze({
  VIRTUAL_BIOTECH: {
    id: "VIRTUAL_BIOTECH",
    name: "Virtual Biotech",
    description:
      "A small client with no in-house biometrics: a balanced deck, and every call is yours.",
    twist: null,
    startingRelicId: null,
    startingBudget: 0,
    startingHandLevels: {},
    handSizeBonus: 0,
    quotaFactor: 1,
    cardChips: [],
  },
  ONCOLOGY_PHARMA: {
    id: "ONCOLOGY_PHARMA",
    name: "Oncology Pharma",
    description:
      "Survival endpoints and waterfall plots: Figures, KM curves included, score +10 Chips.",
    twist:
      "Starts with Senior Medical Writer; Efficacy Full House starts at Lv.2.",
    startingRelicId: "REL-SENIOR-MEDICAL-WRITER",
    startingBudget: 0,
    startingHandLevels: { EFFICACY_FULL_HOUSE: 2 },
    handSizeBonus: 0,
    quotaFactor: 1,
    cardChips: [{ cardType: "FIGURE", chips: 10 }],
  },
  CARDIO_MEGA_TRIAL: {
    id: "CARDIO_MEGA_TRIAL",
    name: "Cardio Mega-Trial",
    description:
      "Thousands of subjects on a large Safety population: Safety outputs score +10 Chips.",
    twist: "+1 hand size, and every quota ×1.1.",
    startingRelicId: null,
    startingBudget: 0,
    startingHandLevels: {},
    handSizeBonus: 1,
    quotaFactor: 1.1,
    cardChips: [{ population: "SAFETY", chips: 10 }],
  },
  RARE_DISEASE_BIOTECH: {
    id: "RARE_DISEASE_BIOTECH",
    name: "Rare Disease Biotech",
    description:
      "A small N, where every subject counts: every output scores +5 Chips.",
    twist: "Starts with $10k of study budget.",
    startingRelicId: null,
    startingBudget: 10,
    startingHandLevels: {},
    handSizeBonus: 0,
    quotaFactor: 1,
    cardChips: [{ chips: 5 }],
  },
});

/** The sponsor with `id`. Throws on an unknown id, a programming error. */
export function sponsorById(id: SponsorId): Sponsor {
  const sponsor = (SPONSORS as Record<string, Sponsor | undefined>)[id];
  if (!sponsor) throw new RangeError(`Unknown sponsor ${String(id)}`);
  return sponsor;
}

/** The extra Chips a sponsor's deck gives one card: every match, summed. */
export function sponsorCardChips(
  sponsor: Sponsor,
  card: { cardType: CardType; population: PopulationType }
): number {
  return sponsor.cardChips.reduce(
    (sum, bonus) =>
      (bonus.cardType === undefined || bonus.cardType === card.cardType) &&
      (bonus.population === undefined || bonus.population === card.population)
        ? sum + bonus.chips
        : sum,
    0
  );
}

/** A Blind's hand size under a sponsor, capped at the schema's maximum. */
export function sponsorHandSize(sponsor: Sponsor, handSize: number): number {
  return Math.min(MAX_HAND_SIZE, handSize + sponsor.handSizeBonus);
}

/** The hand levels a run starts with under a sponsor. */
export function sponsorHandLevels(sponsor: Sponsor): HandLevels {
  const levels = initialHandLevels();
  for (const [handType, level] of Object.entries(sponsor.startingHandLevels)) {
    const type = handType as HandType;
    levels[type] = { ...levels[type], level: level ?? 1 };
  }
  return levels;
}
