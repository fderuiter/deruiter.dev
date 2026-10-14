import type { ASTNode, TacticId } from "./types";

/** One ready-made Sandbox goal with RAM targets to chase (#2059). */
export interface SandboxPreset {
  /** Stable key for saved progress; never rename an existing one. */
  id: string;
  name: string;
  description: string;
  /** Gold: prove the goal spending at most this much simulated RAM, in GB. */
  goldRamBudget: number;
  /** Silver: prove the goal spending at most this much simulated RAM, in GB. */
  silverRamBudget: number;
  /**
   * A proof that meets the gold budget, one tactic per step, each applied to
   * the root goal. The Sandbox tests play it through the tactic engine.
   */
  referenceProof: readonly TacticId[];
  goal: ASTNode;
  hypotheses: ASTNode[];
}

/** The Sandbox presets, in the order their buttons appear. */
export const SANDBOX_PRESETS: readonly SandboxPreset[] = [
  {
    id: "binomial",
    name: "Binomial Expansion (a + b)²",
    description: "Verify polynomial identity using ring.",
    goldRamBudget: 4,
    silverRamBudget: 6,
    referenceProof: ["ring"],
    goal: {
      id: "sb-goal-1",
      type: "Equality",
      value: "=",
      children: [
        {
          id: "sb-pow",
          type: "Operator",
          value: "^",
          children: [
            {
              id: "sb-add",
              type: "Operator",
              value: "+",
              children: [
                { id: "sb-a", type: "Variable", value: "a" },
                { id: "sb-b", type: "Variable", value: "b" },
              ],
            },
            { id: "sb-2", type: "Constant", value: 2 },
          ],
        },
        {
          id: "sb-exp",
          type: "Operator",
          value: "+",
          children: [
            {
              id: "sb-a2",
              type: "Operator",
              value: "^",
              children: [
                { id: "sb-a-r", type: "Variable", value: "a" },
                { id: "sb-2-r", type: "Constant", value: 2 },
              ],
            },
            {
              id: "sb-mid",
              type: "Operator",
              value: "+",
              children: [
                {
                  id: "sb-2ab",
                  type: "Operator",
                  value: "*",
                  children: [
                    {
                      id: "sb-2a",
                      type: "Operator",
                      value: "*",
                      children: [
                        { id: "sb-c2", type: "Constant", value: 2 },
                        { id: "sb-va", type: "Variable", value: "a" },
                      ],
                    },
                    { id: "sb-vb", type: "Variable", value: "b" },
                  ],
                },
                {
                  id: "sb-b2",
                  type: "Operator",
                  value: "^",
                  children: [
                    { id: "sb-b-r", type: "Variable", value: "b" },
                    { id: "sb-2-r2", type: "Constant", value: 2 },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    hypotheses: [],
  },
  {
    id: "tautology",
    name: "Tautology P → P",
    description: "Practice intro and exact logic tactics.",
    goldRamBudget: 3,
    silverRamBudget: 5,
    referenceProof: ["intro", "exact"],
    goal: {
      id: "sb-goal-2",
      type: "Implication",
      value: "→",
      children: [
        { id: "sb-P1", type: "Variable", value: "P" },
        { id: "sb-P2", type: "Variable", value: "P" },
      ],
    },
    hypotheses: [],
  },
  {
    id: "decidable",
    name: "Arithmetic Decidability (3 + 7 = 10)",
    description: "Verify concrete numerical evaluation with decide / norm_num.",
    goldRamBudget: 3,
    silverRamBudget: 4,
    referenceProof: ["norm_num"],
    goal: {
      id: "sb-goal-3",
      type: "Equality",
      value: "=",
      children: [
        {
          id: "sb-add37",
          type: "Operator",
          value: "+",
          children: [
            { id: "c3", type: "Constant", value: 3 },
            { id: "c7", type: "Constant", value: 7 },
          ],
        },
        { id: "c10", type: "Constant", value: 10 },
      ],
    },
    hypotheses: [],
  },
];

/** Medal for an honest Sandbox proof, graded by RAM spent. */
export type SandboxMedal = "gold" | "silver" | "bronze";

/**
 * Grade a Sandbox proof against a preset's RAM targets.
 *
 * @param preset - The preset's gold and silver budgets.
 * @param ramUsed - Simulated RAM the proof spent, failed tactics included.
 * @param usedSorry - Whether the goal was admitted with `sorry`.
 * @returns The medal, or null for a proof admitted with `sorry`.
 */
export function gradeSandboxRun(
  preset: Pick<SandboxPreset, "goldRamBudget" | "silverRamBudget">,
  ramUsed: number,
  usedSorry: boolean
): SandboxMedal | null {
  if (usedSorry || !Number.isFinite(ramUsed) || ramUsed < 0) return null;
  if (ramUsed <= preset.goldRamBudget) return "gold";
  if (ramUsed <= preset.silverRamBudget) return "silver";
  return "bronze";
}

/** What the Sandbox remembers about one preset. */
export interface SandboxPresetRecord {
  /** The preset has been proved honestly at least once. */
  verified: true;
  /** The least RAM, in GB, any honest proof of it has spent. */
  bestRamUsed: number;
}

/** Saved Sandbox progress, keyed by preset id. */
export type SandboxProgress = Record<string, SandboxPresetRecord>;

/**
 * Parse saved Sandbox progress without throwing. Malformed JSON, a
 * non-object value and any entry that is not a verified record with a
 * finite, non-negative best are dropped.
 *
 * @param raw - The stored string, or null when nothing is stored.
 * @returns Progress that is safe to read and to spread into a new save.
 */
export function parseSandboxProgress(raw: string | null): SandboxProgress {
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {};
  }
  const out: SandboxProgress = {};
  for (const [id, entry] of Object.entries(parsed as Record<string, unknown>)) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const best = record.bestRamUsed;
    if (
      record.verified === true &&
      typeof best === "number" &&
      Number.isFinite(best) &&
      best >= 0
    ) {
      out[id] = { verified: true, bestRamUsed: best };
    }
  }
  return out;
}

/**
 * Record an honest Sandbox proof, keeping the lowest RAM spent so far.
 *
 * @param progress - Saved Sandbox progress.
 * @param presetId - The preset that was proved.
 * @param ramUsed - Simulated RAM this proof spent.
 * @returns The updated progress, or the same object when nothing improved.
 */
export function recordSandboxProof(
  progress: SandboxProgress,
  presetId: string,
  ramUsed: number
): SandboxProgress {
  if (!Number.isFinite(ramUsed) || ramUsed < 0) return progress;
  const existing = progress[presetId];
  if (existing && existing.bestRamUsed <= ramUsed) return progress;
  return { ...progress, [presetId]: { verified: true, bestRamUsed: ramUsed } };
}
