import type { BlindTier, Stake } from "../types";
import { drawInt } from "./rng";
import type { CashOutReport } from "./shop";

/**
 * GCP-audit stakes (#950): the Balatro stakes, as a cumulative ladder of how
 * closely the player's CRO is being watched. Each stake is one data patch
 * over the modifiers below, and stake N folds every patch from 1 to N, so a
 * higher stake keeps every rule of the ones beneath it.
 */

/** Everything a stake can change, folded from its rules. */
export interface StakeModifiers {
  /** Whether a Small Blind's cash-out pays its sponsor milestone payment. */
  smallBlindPays: boolean;
  /** What every SAP rule's redline Mult penalty is multiplied by. */
  redlinePenaltyFactor: number;
  /** $k added to every shop price: single items, packs and rerolls. */
  shopSurcharge: number;
  /** Whether one relic slot is locked each act, drawn from the seeded PRNG. */
  relicSlotLocked: boolean;
  /** Each act's quotas are multiplied by this once more than the last's. */
  actQuotaGrowth: number;
}

/** One rung of the ladder: the rule it adds on top of the ones below. */
export interface StakeLevel {
  stake: Stake;
  id:
    | "ROUTINE_MONITORING"
    | "SPONSOR_AUDIT"
    | "FOR_CAUSE_AUDIT"
    | "REGULATORY_INSPECTION"
    | "FORM_483_ISSUED"
    | "WARNING_LETTER";
  name: string;
  /** The rule this stake adds, in one line. */
  rule: string;
  /** The modifiers this stake sets. */
  modifier: Partial<StakeModifiers>;
}

/** The stake a run has when none is chosen. */
export const DEFAULT_STAKE: Stake = 1;

/** The top of the ladder. */
export const MAX_STAKE: Stake = 6;

/** Routine Monitoring's modifiers: the game as it plays without a stake. */
export const BASE_STAKE_MODIFIERS: Readonly<StakeModifiers> = Object.freeze({
  smallBlindPays: true,
  redlinePenaltyFactor: 1,
  shopSurcharge: 0,
  relicSlotLocked: false,
  actQuotaGrowth: 1,
});

/** The ladder, lowest first. */
export const STAKES: readonly StakeLevel[] = Object.freeze([
  {
    stake: 1,
    id: "ROUTINE_MONITORING",
    name: "Routine Monitoring",
    rule: "The baseline: a monitor visits, reads the logs and leaves.",
    modifier: {},
  },
  {
    stake: 2,
    id: "SPONSOR_AUDIT",
    name: "Sponsor Audit",
    rule: "Small Blinds pay no sponsor milestone payment.",
    modifier: { smallBlindPays: false },
  },
  {
    stake: 3,
    id: "FOR_CAUSE_AUDIT",
    name: "For-Cause Audit",
    rule: "Redline Mult penalties are doubled.",
    modifier: { redlinePenaltyFactor: 2 },
  },
  {
    stake: 4,
    id: "REGULATORY_INSPECTION",
    name: "Regulatory Inspection",
    rule: "Everything in the shop costs $1k more.",
    modifier: { shopSurcharge: 1 },
  },
  {
    stake: 5,
    id: "FORM_483_ISSUED",
    name: "Form 483 Issued",
    rule: "One relic slot is locked each act, chosen by the run seed.",
    modifier: { relicSlotLocked: true },
  },
  {
    stake: 6,
    id: "WARNING_LETTER",
    name: "Warning Letter",
    rule: "Quotas rise ×1.25 more with each act.",
    modifier: { actQuotaGrowth: 1.25 },
  },
]);

/** Throws on a stake off the ladder, a programming error. */
function checkStake(stake: number): asserts stake is Stake {
  if (!Number.isInteger(stake) || stake < 1 || stake > MAX_STAKE) {
    throw new RangeError(
      `A stake is a whole number from 1 to ${MAX_STAKE}, got ${stake}`
    );
  }
}

/** Every rung in force at `stake`: stakes 1 to `stake`, lowest first. */
export function stakeLevels(stake: Stake): StakeLevel[] {
  checkStake(stake);
  return STAKES.slice(0, stake);
}

/** The modifiers in force at `stake`: every rung's patch, folded in order. */
export function stakeModifiers(stake: Stake): StakeModifiers {
  return stakeLevels(stake).reduce<StakeModifiers>(
    (modifiers, level) => ({ ...modifiers, ...level.modifier }),
    { ...BASE_STAKE_MODIFIERS }
  );
}

/**
 * A cash-out under a stake: at Sponsor Audit and above a Small Blind's
 * milestone payment is $0k, while unspent CPU and interest still pay.
 */
export function stakeCashOut(
  report: CashOutReport,
  tier: BlindTier,
  modifiers: StakeModifiers
): CashOutReport {
  if (modifiers.smallBlindPays || tier !== "SMALL_BLIND") return report;
  const lines = report.lines.map((line) =>
    line.id === "BASE"
      ? { ...line, label: `${line.label} (withheld: Sponsor Audit)`, amount: 0 }
      : line
  );
  return { lines, total: lines.reduce((sum, line) => sum + line.amount, 0) };
}

/** The Form 483 stream's seed: the run seed, kept apart from other draws. */
const form483Seed = (seed: string) => `${seed}/form-483`;

/**
 * The relic slot Form 483 locks for an act, from 0: a pure function of the
 * run seed and the act index on a stream of its own, so the lock never
 * shifts the run's Boss, crisis, deviation or shop draws.
 */
export function lockedRelicSlot(
  seed: string,
  actIndex: number,
  slots: number
): number {
  return drawInt(form483Seed(seed), actIndex, slots);
}
