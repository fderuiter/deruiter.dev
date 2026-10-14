/**
 * Training Plan save for Monkey C Mayhem (#1994): map progress, lives,
 * continues, score and the gear bag, kept in localStorage. Kept apart from
 * the pure lib/garmin-plan.ts and from the engine bundle. Every read and write
 * is guarded: unreadable storage or a corrupt save reads as a fresh plan, and
 * malformed fields fall back one by one.
 */

import {
  BAG_SIZE,
  GEAR_ITEMS,
  PLAN_NODES,
  START_CONTINUES,
  isPlanNodeId,
  newPlan,
  type GearItem,
  type PlanNodeId,
  type PlanSave,
} from "./garmin-plan";
import { packableOnly } from "./garmin-bag";
import { cardsOf } from "./garmin-finisher";
import { START_LIVES } from "./garmin-powerups";
import { safeGetRawItem, safeRemoveItem, safeSetRawItem } from "./safe-storage";

/** localStorage key holding the Training Plan save, as JSON. */
export const PLAN_STORAGE_KEY = "garmin_training_plan";

/** The save format; a save in another format reads as a fresh plan. */
export const PLAN_SAVE_VERSION = 1;

function isGearItem(value: unknown): value is GearItem {
  return GEAR_ITEMS.some((item) => item === value);
}

/**
 * A stored item as today's item: the first plans kept a Foam Roller, which
 * became the Rest Day (#1995). Anything else unknown is dropped.
 */
function gearItemOf(value: unknown): GearItem | null {
  if (value === "foamroller") return "restday";
  return isGearItem(value) ? value : null;
}

/** The stored items that are still items, in order. */
function gearItemsOf(value: unknown): GearItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(gearItemOf)
    .filter((item): item is GearItem => item !== null);
}

/** Nodes stored in `value`, in map order, each once. */
function nodeIdsOf(value: unknown): PlanNodeId[] {
  if (!Array.isArray(value)) return [];
  return PLAN_NODES.map((n) => n.id).filter((id) =>
    (value as unknown[]).includes(id)
  );
}

/** A whole number in `[min, max]`, or `fallback`. */
function wholeIn(
  value: unknown,
  min: number,
  max: number,
  fallback: number
): number {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= min &&
    value <= max
    ? value
    : fallback;
}

/**
 * A save read back from storage: each field is checked and replaced by the
 * fresh plan's value when it is missing or malformed. Unknown nodes and items
 * are dropped, so a save can never open a node its paths don't reach.
 */
export function normalizePlan(value: unknown): PlanSave | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const raw = value as Record<string, unknown>;
  if (raw.v !== PLAN_SAVE_VERSION) return null;
  const fresh = newPlan(wholeIn(raw.seed, 0, 0xffffffff, 0));
  const cleared = nodeIdsOf(raw.cleared);
  const huts: Partial<Record<PlanNodeId, GearItem>> = {};
  if (typeof raw.huts === "object" && raw.huts !== null) {
    for (const [id, item] of Object.entries(raw.huts)) {
      const gear = gearItemOf(item);
      if (isPlanNodeId(id) && gear) huts[id] = gear;
    }
  }
  // Packed items are each packed once, and a Rest Day is never packed.
  // Packed gear counts towards the bag's eight.
  const packed = packableOnly(gearItemsOf(raw.packed)).slice(0, BAG_SIZE);
  const bag = gearItemsOf(raw.bag).slice(0, BAG_SIZE - packed.length);
  return {
    ...fresh,
    cleared,
    huts,
    cursor: isPlanNodeId(raw.cursor) ? raw.cursor : fresh.cursor,
    lives: wholeIn(raw.lives, 1, 99, START_LIVES),
    continues: wholeIn(raw.continues, 0, START_CONTINUES, START_CONTINUES),
    score: wholeIn(raw.score, 0, Number.MAX_SAFE_INTEGER, 0),
    bag,
    packed,
    unlocked: nodeIdsOf(raw.unlocked),
    cards: cardsOf(raw.cards),
    finished: raw.finished === true,
    dnfs: wholeIn(raw.dnfs, 0, 999, 0),
    lastTe:
      typeof raw.lastTe === "number" &&
      Number.isFinite(raw.lastTe) &&
      raw.lastTe >= 0 &&
      raw.lastTe <= 5
        ? raw.lastTe
        : null,
  };
}

/** The stored plan, or null when there is none or it can't be read. Never throws. */
export function loadPlan(): PlanSave | null {
  try {
    const raw = safeGetRawItem(PLAN_STORAGE_KEY);
    if (raw === null) return null;
    return normalizePlan(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Saves `plan`. Returns whether it reached storage. Never throws. */
export function savePlan(plan: PlanSave): boolean {
  try {
    return safeSetRawItem(
      PLAN_STORAGE_KEY,
      JSON.stringify({ v: PLAN_SAVE_VERSION, ...plan })
    );
  } catch {
    return false;
  }
}

/** Deletes the stored plan, for "New plan". Never throws. */
export function clearPlan(): void {
  try {
    safeRemoveItem(PLAN_STORAGE_KEY);
  } catch {
    // Nothing stored is the same as a cleared plan.
  }
}
