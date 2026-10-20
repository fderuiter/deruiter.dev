import { generateId } from "@/lib/utils";
import { parseFormulaWithError, parseHypotheses } from "./compiler";
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

/** The most custom theorems the Sandbox keeps in browser storage. */
export const MAX_CUSTOM_THEOREMS = 50;

/** A goal the player wrote in the Sandbox formula editor and saved. */
export interface CustomTheorem {
  /** Assigned on save or import; never taken from an imported file. */
  id: string;
  title: string;
  /** Goal formula in infix notation, trimmed. */
  formula: string;
  /** Hypotheses in the editor's notation, trimmed; empty when there are none. */
  hypotheses: string;
}

/** The title, formula and hypotheses of a theorem that is not saved yet. */
export type CustomTheoremDraft = Omit<CustomTheorem, "id">;

/** Outcome of {@link saveCustomTheorem}. */
export interface CustomTheoremSaveResult {
  /** True when a new theorem was added. */
  saved: boolean;
  /** One sentence for the player saying what happened. */
  message: string;
  /** The collection after the save; the input collection when nothing was added. */
  theorems: CustomTheorem[];
}

/** Outcome of {@link importCustomTheorems}. */
export interface CustomTheoremImportResult {
  /** The collection after the import; the input collection when nothing was added. */
  theorems: CustomTheorem[];
  /** How many entries were added. */
  imported: number;
  /** One line per skipped entry: invalid, a duplicate, or over the cap. */
  warnings: string[];
  /** Set when the file as a whole could not be read; nothing is imported then. */
  error?: string;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function theoremKey(
  theorem: Pick<CustomTheorem, "formula" | "hypotheses">
): string {
  return `${theorem.formula.trim()}\u0000${theorem.hypotheses.trim()}`;
}

function draftError(draft: CustomTheoremDraft): string | null {
  if (!draft.formula) return "The goal formula is empty.";
  const goal = parseFormulaWithError(draft.formula, "custom-theorem");
  if (!goal.ast) return `The goal formula does not parse: ${goal.error}`;
  try {
    parseHypotheses(draft.hypotheses, "custom-theorem-hyp");
  } catch (e) {
    return `The hypotheses do not parse: ${e instanceof Error ? e.message : String(e)}`;
  }
  return null;
}

function normalizeDraft(value: unknown): CustomTheoremDraft | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const formula = readString(record.formula);
  return {
    title: readString(record.title) || formula,
    formula,
    hypotheses: readString(record.hypotheses),
  };
}

/**
 * Parse the saved custom theorems without throwing. Malformed JSON, a
 * non-array value and entries without a string id and formula are dropped,
 * and anything past {@link MAX_CUSTOM_THEOREMS} is ignored.
 *
 * @param raw - The stored string, or null when nothing is stored.
 * @returns The saved theorems, oldest first.
 */
export function parseCustomTheorems(raw: string | null): CustomTheorem[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: CustomTheorem[] = [];
  for (const entry of parsed) {
    const draft = normalizeDraft(entry);
    if (!draft?.formula) continue;
    const id = readString((entry as Record<string, unknown>).id);
    if (id) out.push({ id, ...draft });
  }
  return out.slice(0, MAX_CUSTOM_THEOREMS);
}

/**
 * Add a theorem to the collection. A formula or hypotheses that do not
 * parse, a full collection, and a theorem whose trimmed formula and
 * hypotheses are already saved all leave the collection unchanged.
 *
 * @param theorems - The saved collection.
 * @param draft - The theorem to add; an empty title falls back to the formula.
 * @returns Whether it was saved, a message for the player, and the collection.
 */
export function saveCustomTheorem(
  theorems: readonly CustomTheorem[],
  draft: CustomTheoremDraft
): CustomTheoremSaveResult {
  const current = [...theorems];
  const clean = normalizeDraft(draft);
  if (!clean) {
    return { saved: false, message: "Nothing to save.", theorems: current };
  }
  const error = draftError(clean);
  if (error) {
    return { saved: false, message: `Not saved. ${error}`, theorems: current };
  }
  const duplicate = current.find((t) => theoremKey(t) === theoremKey(clean));
  if (duplicate) {
    return {
      saved: false,
      message: `Already saved as "${duplicate.title}". Nothing changed.`,
      theorems: current,
    };
  }
  if (current.length >= MAX_CUSTOM_THEOREMS) {
    return {
      saved: false,
      message: `Not saved. The collection is full (${MAX_CUSTOM_THEOREMS} theorems); delete one first.`,
      theorems: current,
    };
  }
  return {
    saved: true,
    message: `Saved "${clean.title}".`,
    theorems: [...current, { id: generateId("custom-theorem"), ...clean }],
  };
}

/**
 * Remove a theorem from the collection.
 *
 * @param theorems - The saved collection.
 * @param id - The id of the theorem to remove.
 * @returns The collection without that theorem.
 */
export function deleteCustomTheorem(
  theorems: readonly CustomTheorem[],
  id: string
): CustomTheorem[] {
  return theorems.filter((t) => t.id !== id);
}

/**
 * Serialize the collection for download. Ids are left out, because an
 * import always assigns new ones.
 *
 * @param theorems - The saved collection.
 * @returns Pretty-printed JSON with a version and a theorems array.
 */
export function exportCustomTheorems(
  theorems: readonly CustomTheorem[]
): string {
  return JSON.stringify(
    {
      version: 1,
      theorems: theorems.map(({ title, formula, hypotheses }) => ({
        title,
        formula,
        hypotheses,
      })),
    },
    null,
    2
  );
}

/**
 * Merge theorems from an exported JSON file into the collection. The file
 * may be an object with a theorems array or a bare array. Each entry gets a
 * fresh id; ids in the file are ignored. Entries whose formula or
 * hypotheses do not parse, entries whose trimmed formula and hypotheses are
 * already in the collection or earlier in the file, and entries past
 * {@link MAX_CUSTOM_THEOREMS} are skipped with a warning each.
 *
 * @param theorems - The saved collection.
 * @param json - The file contents.
 * @returns The merged collection, the number added and any warnings.
 */
export function importCustomTheorems(
  theorems: readonly CustomTheorem[],
  json: string
): CustomTheoremImportResult {
  const current = [...theorems];
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return {
      theorems: current,
      imported: 0,
      warnings: [],
      error: "The file is not valid JSON.",
    };
  }
  const entries: unknown = Array.isArray(parsed)
    ? parsed
    : (parsed as { theorems?: unknown } | null)?.theorems;
  if (!Array.isArray(entries)) {
    return {
      theorems: current,
      imported: 0,
      warnings: [],
      error: "The file has no theorems array.",
    };
  }

  const warnings: string[] = [];
  const seen = new Set(current.map(theoremKey));
  const merged = [...current];
  entries.forEach((entry, index) => {
    const label = `Entry ${index + 1}`;
    const draft = normalizeDraft(entry);
    if (!draft) {
      warnings.push(`${label} skipped: not a theorem object.`);
      return;
    }
    const error = draftError(draft);
    if (error) {
      warnings.push(`${label} skipped: ${error}`);
      return;
    }
    if (seen.has(theoremKey(draft))) {
      warnings.push(`${label} skipped: "${draft.title}" is already saved.`);
      return;
    }
    if (merged.length >= MAX_CUSTOM_THEOREMS) {
      warnings.push(
        `${label} skipped: the collection is full (${MAX_CUSTOM_THEOREMS} theorems).`
      );
      return;
    }
    seen.add(theoremKey(draft));
    merged.push({ id: generateId("custom-theorem"), ...draft });
  });

  return {
    theorems: merged,
    imported: merged.length - current.length,
    warnings,
  };
}
