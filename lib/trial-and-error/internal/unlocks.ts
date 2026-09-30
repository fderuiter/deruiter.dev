import { z } from "zod";
import type { SponsorId, Stake } from "../types";
import { SponsorIdSchema, StakeSchema } from "../types";
import type { RunChoice } from "./run-rules";
import { DEFAULT_SPONSOR_ID, SPONSORS, type Sponsor } from "./sponsors";
import { DEFAULT_STAKE, MAX_STAKE, STAKES, type StakeLevel } from "./stakes";

/**
 * Sponsor and stake unlocks (#950). Pure: the Codex keeps the record, and
 * these functions only read it, grow it after a win and describe it for the
 * New Run picker.
 *
 * The record maps each unlocked sponsor to the highest stake unlocked for
 * it. Virtual Biotech at stake 1 is always open, so a missing or unreadable
 * record plays exactly as a first visit does. Winning a run with a sponsor
 * unlocks the next sponsor in New Run order at stake 1, and winning at a
 * stake unlocks the next stake for that sponsor.
 */

/** Each unlocked sponsor and the highest stake unlocked for it. */
export const UnlocksSchema = z.partialRecord(SponsorIdSchema, StakeSchema);
/** Each unlocked sponsor and the highest stake unlocked for it. */
export type Unlocks = z.infer<typeof UnlocksSchema>;

/** The sponsors in New Run order: each win unlocks the one after it. */
export const SPONSOR_ORDER: readonly SponsorId[] = Object.freeze(
  Object.keys(SPONSORS) as SponsorId[]
);

/** A first visit's unlocks: Virtual Biotech at stake 1, nothing else. */
export function defaultUnlocks(): Unlocks {
  return { [DEFAULT_SPONSOR_ID]: DEFAULT_STAKE };
}

/**
 * The highest stake unlocked for a sponsor, or null while the sponsor is
 * locked. Virtual Biotech is always open at stake 1 at least.
 */
export function unlockedStake(
  unlocks: Unlocks,
  sponsorId: SponsorId
): Stake | null {
  const stake = unlocks[sponsorId] ?? null;
  if (sponsorId !== DEFAULT_SPONSOR_ID) return stake;
  return Math.max(stake ?? DEFAULT_STAKE, DEFAULT_STAKE);
}

/** Whether a sponsor and stake may be picked in New Run. */
export function isChoiceUnlocked(unlocks: Unlocks, choice: RunChoice): boolean {
  const top = unlockedStake(unlocks, choice.sponsorId);
  return top !== null && choice.stake <= top;
}

/**
 * The unlocks after winning a run under `choice`: the sponsor is open up to
 * the next stake, and the next sponsor is open at stake 1. Returns the same
 * object when the win unlocks nothing new.
 */
export function unlockAfterWin(unlocks: Unlocks, choice: RunChoice): Unlocks {
  const grants: [SponsorId, Stake][] = [
    [choice.sponsorId, Math.min(choice.stake + 1, MAX_STAKE)],
  ];
  const next = SPONSOR_ORDER[SPONSOR_ORDER.indexOf(choice.sponsorId) + 1];
  if (next) grants.push([next, DEFAULT_STAKE]);
  let result: Unlocks | null = null;
  for (const [sponsorId, stake] of grants) {
    const current = unlockedStake(result ?? unlocks, sponsorId);
    if (current !== null && current >= stake) continue;
    result = { ...(result ?? unlocks), [sponsorId]: stake };
  }
  return result ?? unlocks;
}

/** One sponsor as the New Run picker offers it. */
export interface SponsorOption {
  sponsor: Sponsor;
  unlocked: boolean;
  /** How to unlock it, while it is locked; null once it is open. */
  lockedReason: string | null;
}

/** One stake as the New Run picker offers it, for one sponsor. */
export interface StakeOption {
  level: StakeLevel;
  unlocked: boolean;
  /** How to unlock it, while it is locked; null once it is open. */
  lockedReason: string | null;
}

/** Every sponsor in New Run order, open or locked with how to unlock it. */
export function sponsorOptions(unlocks: Unlocks): SponsorOption[] {
  return SPONSOR_ORDER.map((id, index) => {
    const unlocked = unlockedStake(unlocks, id) !== null;
    const previous = index > 0 ? SPONSORS[SPONSOR_ORDER[index - 1]] : null;
    return {
      sponsor: SPONSORS[id],
      unlocked,
      lockedReason:
        unlocked || !previous
          ? null
          : `Win a run with ${previous.name} to unlock.`,
    };
  });
}

/** Every stake for one sponsor, open or locked with how to unlock it. */
export function stakeOptions(
  unlocks: Unlocks,
  sponsorId: SponsorId
): StakeOption[] {
  const top = unlockedStake(unlocks, sponsorId);
  const sponsor = SPONSORS[sponsorId];
  return STAKES.map((level, index) => {
    const unlocked = top !== null && level.stake <= top;
    let lockedReason: string | null = null;
    if (!unlocked) {
      lockedReason =
        top === null
          ? `Unlock ${sponsor.name} first.`
          : `Win at stake ${level.stake - 1} (${STAKES[index - 1].name}) with ${sponsor.name} to unlock.`;
    }
    return { level, unlocked, lockedReason };
  });
}
