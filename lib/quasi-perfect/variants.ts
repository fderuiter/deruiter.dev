import { getLevelPar, LEVEL_REFERENCE_PROOFS } from "./levels";
import { getStartingRam } from "./ram";
import type {
  GameMode,
  GameProgressState,
  PuzzlerLevelDef,
  PuzzlerVariantKind,
  TacticId,
} from "./types";

/** Every variant kind, in the order the picker shows them (#2090). */
export const PUZZLER_VARIANT_KINDS: readonly PuzzlerVariantKind[] = [
  "banned",
  "tight-ram",
  "step-limit",
];

/** One constrained replay of a level, unlocked once it is proved honestly. */
export interface PuzzlerVariantDef {
  kind: PuzzlerVariantKind;
  levelId: number;
  /** Short name for the picker, such as "No linarith". */
  title: string;
  /** The rule in one sentence, as the board states it. */
  rule: string;
  /** The tactic removed from the hand (banned variants only). */
  bannedTactic?: TacticId;
  /** Fixed starting RAM in GB, in either mode (tight RAM only). */
  startingRam?: number;
  /** Most tactics the proof may apply (step limit only). */
  stepLimit?: number;
  /** A proof that clears the variant, checked through the tactic engine. */
  referenceProof: readonly TacticId[];
}

interface BannedRule {
  tactic: TacticId;
  /** The route that still exists without the banned tactic. */
  proof: readonly TacticId[];
  /** A nudge towards that route, shown under the rule. */
  nudge: string;
}

interface LevelVariantRules {
  /**
   * Starting RAM for the Tight RAM variant: what the level's reference proof
   * spends, which is at or below the gold budget (initialRam minus
   * goldRamTarget). There is no room for a failed tactic.
   */
  tightRam: number;
  /**
   * A banned tactic, authored only where the ban removes a tactic the
   * reference proof uses and another honest proof still exists.
   */
  banned?: BannedRule;
}

/**
 * Authored variant rules, keyed by level id. Deterministic data: no
 * randomness, and `__tests__/quasi-puzzler-gold-reachable.test.ts` plays every
 * variant's reference proof through the tactic engine under its constraint.
 */
export const LEVEL_VARIANT_RULES: Readonly<Record<number, LevelVariantRules>> =
  {
    1: { tightRam: 1 },
    2: { tightRam: 2 },
    3: { tightRam: 4 },
    4: { tightRam: 2 },
    5: {
      tightRam: 2,
      banned: {
        tactic: "rw",
        proof: ["simp"],
        nudge: "The broad simplifier knows x + 0 = x, at a price.",
      },
    },
    6: { tightRam: 4 },
    7: { tightRam: 3 },
    8: { tightRam: 4 },
    9: { tightRam: 4 },
    10: { tightRam: 7 },
    11: { tightRam: 8 },
    12: {
      tightRam: 3,
      banned: {
        tactic: "norm_num",
        proof: ["decide"],
        nudge:
          "Both facts are concrete, so a decision procedure can settle them.",
      },
    },
    13: {
      tightRam: 8,
      banned: {
        tactic: "linarith",
        proof: ["omega"],
        nudge: "The bound is Presburger arithmetic over the integers.",
      },
    },
    14: {
      tightRam: 8,
      banned: {
        tactic: "linarith",
        proof: ["omega"],
        nudge: "Integer transitivity is also within omega's reach.",
      },
    },
    15: { tightRam: 2 },
    16: {
      tightRam: 10,
      banned: {
        tactic: "rw",
        proof: ["linarith"],
        nudge:
          "linarith can use h_def as a linear fact without rewriting first.",
      },
    },
    17: { tightRam: 6 },
    18: { tightRam: 6 },
    // Act 2 (#2091)
    19: {
      tightRam: 3,
      banned: {
        tactic: "exact",
        proof: ["intro", "rw"],
        nudge:
          "add_zero can rewrite n + 0 instead of closing the goal outright.",
      },
    },
    20: {
      tightRam: 5,
      banned: {
        tactic: "norm_num",
        proof: ["use", "decide"],
        nudge: "Once the witness is in, the claim is concrete and decidable.",
      },
    },
    21: { tightRam: 4 },
    22: { tightRam: 11 },
    23: { tightRam: 20 },
    24: { tightRam: 15 },
    25: {
      tightRam: 5,
      banned: {
        tactic: "trans",
        proof: ["linarith"],
        nudge: "A linear arithmetic solver can add the three rungs at once.",
      },
    },
    26: {
      tightRam: 5,
      banned: {
        tactic: "exact",
        proof: ["trans", "trans", "rw"],
        nudge:
          "Chain from both ends; a rewrite that leaves c ≤ c closes itself.",
      },
    },
    27: {
      tightRam: 5,
      banned: {
        tactic: "gcongr",
        proof: ["linarith"],
        nudge: "linarith can combine h1 and h2 without cancelling the + 1.",
      },
    },
    28: {
      tightRam: 7,
      banned: {
        tactic: "norm_num",
        proof: ["use", "rw", "decide"],
        nudge: "25 ≤ 28 is concrete, so a decision procedure settles it.",
      },
    },
    29: { tightRam: 7 },
    30: {
      tightRam: 16,
      banned: {
        tactic: "norm_num",
        proof: ["induction", "rw", "simp", "rw", "rw", "rw"],
        nudge:
          "The base case is arithmetic the simplifier can fold, at a price.",
      },
    },
  };

/**
 * The variants a level offers, in picker order. A level without a par has
 * no step-limit variant; a level without an authored ban has no banned one.
 *
 * @param level - The level, or anything carrying its id.
 * @returns The level's variants; empty for a level without authored rules.
 */
export function getLevelVariants(
  level: Pick<PuzzlerLevelDef, "id">
): PuzzlerVariantDef[] {
  const levelId = Number(level.id);
  const rules = LEVEL_VARIANT_RULES[levelId];
  if (!rules) return [];
  const reference = LEVEL_REFERENCE_PROOFS[levelId] ?? [];
  const out: PuzzlerVariantDef[] = [];
  if (rules.banned) {
    out.push({
      kind: "banned",
      levelId,
      title: `No ${rules.banned.tactic}`,
      rule: `The ${rules.banned.tactic} card is banned. ${rules.banned.nudge}`,
      bannedTactic: rules.banned.tactic,
      referenceProof: rules.banned.proof,
    });
  }
  out.push({
    kind: "tight-ram",
    levelId,
    title: "Tight RAM",
    rule: `Start with ${rules.tightRam} GB in either mode, exactly what the cheapest proof spends. A single failed tactic leaves too little to finish.`,
    startingRam: rules.tightRam,
    referenceProof: reference,
  });
  const par = getLevelPar(level);
  if (par !== null) {
    out.push({
      kind: "step-limit",
      levelId,
      title: "Step limit",
      rule: `Finish in at most ${par} tactic${par === 1 ? "" : "s"}. The run fails on the step after that.`,
      stepLimit: par,
      referenceProof: reference,
    });
  }
  return out;
}

/**
 * Look up one variant of a level.
 *
 * @param level - The level, or anything carrying its id.
 * @param kind - The variant kind, or null for the base level.
 * @returns The variant, or null for the base level or a kind the level lacks.
 */
export function getLevelVariant(
  level: Pick<PuzzlerLevelDef, "id">,
  kind: PuzzlerVariantKind | null | undefined
): PuzzlerVariantDef | null {
  if (!kind) return null;
  return getLevelVariants(level).find((v) => v.kind === kind) ?? null;
}

/**
 * Whether a level's variants are open: the base level has been proved
 * honestly, with no `sorry`.
 *
 * @param progress - Parsed campaign progress.
 * @param levelId - The level's id.
 * @returns True once the base level has an honest clear.
 */
export function areVariantsUnlocked(
  progress: Pick<GameProgressState, "completedLevels"> | null | undefined,
  levelId: string | number
): boolean {
  const score = progress?.completedLevels?.[levelId];
  return !!score && score.completed === true && score.usedSorry !== true;
}

/**
 * RAM a run starts with. The Tight RAM variant replaces the mode budget with
 * its fixed allowance; every other run uses the mode's normal budget.
 *
 * @param level - The level being played.
 * @param mode - Story or Hacker mode.
 * @param variant - The active variant, or null for the base level.
 * @returns Starting RAM in GB.
 */
export function getRunStartingRam(
  level: Pick<PuzzlerLevelDef, "initialRam">,
  mode: GameMode,
  variant: Pick<PuzzlerVariantDef, "startingRam"> | null | undefined
): number {
  const base = getStartingRam(level, mode);
  return variant?.startingRam !== undefined
    ? Math.min(base, variant.startingRam)
    : base;
}

/**
 * Whether the active variant bans a tactic.
 *
 * @param variant - The active variant, or null for the base level.
 * @param tacticId - The tactic to check.
 * @returns True when the card cannot be played in this run.
 */
export function isTacticBanned(
  variant: Pick<PuzzlerVariantDef, "bannedTactic"> | null | undefined,
  tacticId: TacticId
): boolean {
  return !!variant?.bannedTactic && variant.bannedTactic === tacticId;
}

/**
 * Whether a step-limit run has failed: it has used every allowed tactic and
 * the proof is still open, so the next tactic would be over the limit.
 *
 * @param variant - The active variant, or null for the base level.
 * @param steps - Tactics applied so far.
 * @param solved - Whether the proof is complete.
 * @returns True when the run is over and must be reset.
 */
export function isStepLimitReached(
  variant: Pick<PuzzlerVariantDef, "stepLimit"> | null | undefined,
  steps: number,
  solved: boolean
): boolean {
  return (
    !solved && variant?.stepLimit !== undefined && steps >= variant.stepLimit
  );
}

/**
 * Whether a finished run clears its variant: an honest proof inside the
 * variant's limits.
 *
 * @param variant - The variant the run was played under.
 * @param steps - Tactics the run applied.
 * @param usedSorry - Whether the run admitted any goal with `sorry`.
 * @returns True when the variant counts as cleared.
 */
export function isVariantRunCleared(
  variant: Pick<PuzzlerVariantDef, "stepLimit">,
  steps: number,
  usedSorry: boolean
): boolean {
  if (usedSorry) return false;
  return variant.stepLimit === undefined || steps <= variant.stepLimit;
}

/**
 * Whether a variant has been cleared in saved progress.
 *
 * @param progress - Parsed campaign progress.
 * @param levelId - The level's id.
 * @param kind - The variant kind.
 * @returns True when it was cleared before.
 */
export function isVariantCleared(
  progress: Pick<GameProgressState, "clearedVariants"> | null | undefined,
  levelId: string | number,
  kind: PuzzlerVariantKind
): boolean {
  return progress?.clearedVariants?.[levelId]?.includes(kind) === true;
}

/**
 * Record a cleared variant. The base level's score is left untouched, so a
 * variant never changes its stars, Golfed badge or steps.
 *
 * @param progress - Current campaign progress.
 * @param levelId - The level's id.
 * @param kind - The variant just cleared.
 * @returns New progress with the variant recorded, in picker order.
 */
export function recordClearedVariant(
  progress: GameProgressState,
  levelId: string | number,
  kind: PuzzlerVariantKind
): GameProgressState {
  const existing = progress.clearedVariants?.[levelId] ?? [];
  if (existing.includes(kind)) return progress;
  const next = PUZZLER_VARIANT_KINDS.filter(
    (k) => k === kind || existing.includes(k)
  );
  return {
    ...progress,
    clearedVariants: { ...progress.clearedVariants, [levelId]: next },
  };
}

/**
 * Clean a stored `clearedVariants` value: anything that is not an object of
 * arrays becomes empty, and unknown or repeated kinds are dropped.
 *
 * @param raw - The stored value, possibly missing or malformed.
 * @returns A safe map from level id to cleared kinds.
 */
export function normalizeClearedVariants(
  raw: unknown
): Record<string, PuzzlerVariantKind[]> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, PuzzlerVariantKind[]> = {};
  for (const [id, kinds] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(kinds)) continue;
    const clean = PUZZLER_VARIANT_KINDS.filter((k) => kinds.includes(k));
    if (clean.length > 0) out[id] = clean;
  }
  return out;
}
