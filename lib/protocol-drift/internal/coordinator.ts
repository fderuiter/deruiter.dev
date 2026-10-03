/**
 * The coordinator cognitive model: attention depletion per eCRF field,
 * fatigue keying errors, goodwill dynamics, response latency and the
 * rubber-stamp failure mode. Coefficients are game tuning, not empirical.
 */
import { ENTRY_FIELD_SPECS, SCRIPTED_TRANSPOSITIONS } from "../presets";
import type {
  AttentionStep,
  EntryFieldSpec,
  SubmissionFixture,
} from "../types";
import { seededDraw } from "./rng";

/** Attention a fresh entry session starts with. */
export const ATTENTION_START = 100;
/** Attention below which fatigue keying errors become possible. */
export const FATIGUE_THRESHOLD = 40;
/** Extra attention a hard-stop validation error costs. */
export const HARD_STOP_ATTENTION_COST = 6;
/** Goodwill rules. */
export const GOODWILL_RULES = {
  distinctQuery: -1,
  duplicateQuery: -3,
  hardStop: -2,
  resolvedDiscrepancy: 1,
} as const;

function clamp(value: number, low: number, high: number): number {
  if (value < low) return low;
  if (value > high) return high;
  return value;
}

/** Base attention cost of a field type. */
export function baseFieldCost(type: EntryFieldSpec["type"]): number {
  switch (type) {
    case "date":
      return 2;
    case "freetext":
      return 3;
    default:
      return 1;
  }
}

/**
 * c_f = base(type) + floor(max(0, options - 1) / 8) + nesting, plus 6 when
 * the field throws a hard-stop error during entry.
 */
export function fieldCost(spec: EntryFieldSpec): number {
  const options = spec.options ?? 0;
  const extra = Math.floor((options > 1 ? options - 1 : 0) / 8);
  return (
    baseFieldCost(spec.type) +
    extra +
    (spec.nesting ?? 0) +
    (spec.hardStop ? HARD_STOP_ATTENTION_COST : 0)
  );
}

/** p_err = min(0.25, (40 - A) / 160) when A < 40, else 0. */
export function fatigueErrorProbability(attention: number): number {
  if (attention >= FATIGUE_THRESHOLD) return 0;
  return clamp((FATIGUE_THRESHOLD - attention) / 160, 0, 0.25);
}

/** T_latency = ceil(base_hours * (1 + (100 - G) / 25)) hours. */
export function responseLatencyHours(
  baseHours: number,
  goodwill: number
): number {
  return Math.ceil(baseHours * (1 + (100 - goodwill) / 25));
}

/** p_stamp = (40 - G) / 100, clamped to [0, 1]. */
export function rubberStampProbability(goodwill: number): number {
  return clamp((40 - goodwill) / 100, 0, 1);
}

/** Clamps goodwill into [0, cap]. */
export function clampGoodwill(goodwill: number, cap = 100): number {
  return clamp(goodwill, 0, cap);
}

/** Swaps the first two digits of a numeric value: 120 becomes 210. */
export function transposeDigits(value: number): number {
  const text = String(value);
  if (text.length < 2) return value;
  return Number(`${text[1]}${text[0]}${text.slice(2)}`);
}

/** Result of keying one session of submissions. */
export interface EntrySessionResult {
  entered: Map<string, Record<string, unknown>>;
  steps: AttentionStep[];
  finalAttention: number;
}

/**
 * Keys a session of submissions field by field. Attention starts at 100 and
 * depletes by c_f; a designated numeric fixture is transposed when attention
 * is below 40 and either it is scripted or a seeded draw falls below p_err.
 */
export function simulateEntrySession(
  submissions: readonly SubmissionFixture[],
  seed: number
): EntrySessionResult {
  let attention = ATTENTION_START;
  const entered = new Map<string, Record<string, unknown>>();
  const steps: AttentionStep[] = [];
  for (const sub of submissions) {
    const payload: Record<string, unknown> = {};
    for (const [field, value] of Object.entries(sub.payload)) {
      const spec = ENTRY_FIELD_SPECS[field];
      const before = attention;
      let next = value;
      const p = fatigueErrorProbability(attention);
      let transposed = false;
      const designated = SCRIPTED_TRANSPOSITIONS.find(
        (t) => t.submissionId === sub.submissionId && t.payloadKey === field
      );
      if (designated && typeof value === "number" && p > 0) {
        const draw = seededDraw(
          seed,
          `${sub.siteId}|${sub.subjectId}|${sub.visitDay}|${field}|fatigue`
        );
        if (designated.scripted || draw < p) {
          next = transposeDigits(value);
          transposed = next !== value;
        }
      }
      const cost = spec ? fieldCost(spec) : 0;
      attention = clamp(attention - cost, 0, 100);
      if (spec) {
        steps.push({
          submissionId: sub.submissionId,
          field,
          cost,
          attentionBefore: before,
          attentionAfter: attention,
          errorProbability: p,
          transposed,
        });
      }
      payload[field] = next;
    }
    entered.set(sub.submissionId, payload);
  }
  return { entered, steps, finalAttention: attention };
}
