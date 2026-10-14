/**
 * The gear bag for Monkey C Mayhem's Training Plan (#1995): what each item
 * does, the rules for using it on the map, and how packed items reach the
 * next workout.
 *
 * - The bag holds up to {@link BAG_SIZE} items. They come from the Recovery
 *   Huts.
 * - A power-up item (Protein Shake, Heat Map, Compression Cape) sets the
 *   starting tier of the next workout. Only one can be packed at a time.
 * - A Runner's High, an Energy Gel and a Pre-Workout are packed for the next
 *   workout too. The Runner's High starts as the GPS locks, the gel refills
 *   Body Battery at the first bonk, and the Pre-Workout holds the pace meter
 *   full for the first {@link PREWORKOUT_MS} of the run, until the first jump.
 * - A Rest Day is used on the map at once: it opens the paths past the next
 *   workout without clearing it.
 * - Packed items go with the next new workout. A practice run and Race Day
 *   leave them packed: Race Day is a race on its own board, and races start
 *   from the Base tier so every board stays fair. Race Mode never reads the
 *   plan at all.
 *
 * The engine never sees the bag. The workout's start state is set here, and
 * {@link stepLoadout} runs after each engine step, which keeps the standalone
 * engine bundle unchanged.
 */

import { BODY_BATTERY_MAX } from "./garmin-body-battery";
import type { GameEngineState, Loadout } from "./garmin-engine";
import {
  BAG_SIZE,
  GEAR_ITEM_NAMES,
  PLAN_NODES,
  isCleared,
  isOpen,
  planNode,
  type GearItem,
  type PlanNodeId,
  type PlanSave,
} from "./garmin-plan";
import { HIGH_MS, type PowerTier } from "./garmin-powerups";

/** How long a Pre-Workout holds the pace meter full after the GPS locks, in ms. */
export const PREWORKOUT_MS = 6000;

/** The starting tier each power-up item gives. */
export const GEAR_ITEM_TIER: Readonly<Partial<Record<GearItem, PowerTier>>> = {
  protein: "buff",
  heatmap: "heatmap",
  cape: "cape",
};

/** What each item does, as the bag lists it. */
export const GEAR_ITEM_EFFECTS: Readonly<Record<GearItem, string>> = {
  protein: "Start the next workout Buff.",
  heatmap: "Start the next workout with the Heat Map: X throws.",
  cape: "Start the next workout in the Compression Cape: X spins.",
  high: "A Runner's High as the GPS locks on the next workout.",
  gel: "Refills Body Battery the first time you bonk on the next workout.",
  preworkout:
    "A full pace meter for the first 6 seconds of the next workout, up to your first jump.",
  restday: "Opens the paths past your next workout without running it.",
};

/** Whether `item` is a power-up that sets the starting tier. */
export function isPowerItem(item: GearItem): boolean {
  return GEAR_ITEM_TIER[item] !== undefined;
}

/**
 * `packed` with each item once, no Rest Day, and at most one power-up (the
 * first). A save read from storage goes through this.
 */
export function packableOnly(packed: readonly GearItem[]): GearItem[] {
  const out: GearItem[] = [];
  for (const item of packed) {
    if (item === "restday" || out.includes(item)) continue;
    if (isPowerItem(item) && out.some(isPowerItem)) continue;
    out.push(item);
  }
  return out;
}

/**
 * The nodes a Rest Day would open: those on the paths out of the first open
 * workout not yet cleared, which are still locked. Empty when there is none.
 */
export function restDayTargets(save: PlanSave): PlanNodeId[] {
  const next = PLAN_NODES.find(
    (n) =>
      n.stage !== null &&
      n.kind !== "raceday" &&
      isOpen(save, n.id) &&
      !isCleared(save, n.id)
  );
  if (!next) return [];
  return next.next.filter((id) => !isOpen(save, id));
}

/** Whether an item can be used now, and why not. */
export interface BagCheck {
  ok: boolean;
  /** Why it can't be used, for the bag to show. Null when it can. */
  reason: string | null;
}

/** Whether `item` can be used from the bag now. */
export function bagCheck(save: PlanSave, item: GearItem): BagCheck {
  if (!save.bag.includes(item)) {
    return { ok: false, reason: "Not in the bag." };
  }
  if (item === "restday") {
    return restDayTargets(save).length > 0
      ? { ok: true, reason: null }
      : { ok: false, reason: "No path is left for a Rest Day to open." };
  }
  if (save.packed.includes(item)) {
    return { ok: false, reason: "Already packed for the next workout." };
  }
  const power = save.packed.find(isPowerItem);
  if (isPowerItem(item) && power) {
    return {
      ok: false,
      reason: `One power-up per workout: the ${GEAR_ITEM_NAMES[power]} is packed.`,
    };
  }
  return { ok: true, reason: null };
}

/** What using an item did. */
export interface BagUse {
  save: PlanSave;
  /** The item was used; false when {@link bagCheck} refused it. */
  used: boolean;
  /** What happened, for the screen reader and the bag. */
  text: string;
}

/** Removes one `item` from `bag`. */
function withoutOne(bag: readonly GearItem[], item: GearItem): GearItem[] {
  const at = bag.indexOf(item);
  return at === -1 ? [...bag] : [...bag.slice(0, at), ...bag.slice(at + 1)];
}

/**
 * Uses `item` from the bag: a Rest Day opens its paths now, and anything
 * else is packed for the next workout. Refused when {@link bagCheck} says no.
 */
export function applyGearItem(save: PlanSave, item: GearItem): BagUse {
  const check = bagCheck(save, item);
  if (!check.ok) return { save, used: false, text: check.reason ?? "" };
  const bag = withoutOne(save.bag, item);
  if (item === "restday") {
    const targets = restDayTargets(save);
    const names = targets.map((id) => planNode(id).name).join(" and ");
    return {
      save: { ...save, bag, unlocked: [...save.unlocked, ...targets] },
      used: true,
      text: `Rest Day taken. ${names} ${targets.length === 1 ? "is" : "are"} open.`,
    };
  }
  return {
    save: { ...save, bag, packed: [...save.packed, item] },
    used: true,
    text: `${GEAR_ITEM_NAMES[item]} packed for your next workout.`,
  };
}

/** Puts a packed `item` back in the bag, when there is room. */
export function unpackGearItem(save: PlanSave, item: GearItem): BagUse {
  if (!save.packed.includes(item)) {
    return { save, used: false, text: "That item isn't packed." };
  }
  // Packed gear counts towards the bag's eight, so it always fits back;
  // this guards a save that says otherwise.
  if (save.bag.length + save.packed.length > BAG_SIZE) {
    return { save, used: false, text: "The gear bag is full." };
  }
  return {
    save: {
      ...save,
      packed: save.packed.filter((p) => p !== item),
      bag: [...save.bag, item],
    },
    used: true,
    text: `${GEAR_ITEM_NAMES[item]} back in the bag.`,
  };
}

/**
 * Whether the packed items go with a run of node `id`: a new workout takes
 * them, while a practice run and Race Day leave them packed.
 */
export function loadoutApplies(id: PlanNodeId, practice: boolean): boolean {
  const node = planNode(id);
  return !practice && node.stage !== null && node.kind !== "raceday";
}

/**
 * A workout's start state with the packed items on it: a power-up sets the
 * tier now, and the rest wait in the loadout for {@link stepLoadout}.
 */
export function startLoadout(
  state: GameEngineState,
  packed: readonly GearItem[]
): GameEngineState {
  const items = packableOnly(packed);
  if (items.length === 0) return state;
  const tier = items.map((item) => GEAR_ITEM_TIER[item]).find(Boolean);
  const loadout: Loadout = {
    high: items.includes("high"),
    gel: items.includes("gel"),
    preworkoutMs: items.includes("preworkout") ? PREWORKOUT_MS : 0,
  };
  return { ...state, ...(tier ? { power: tier } : {}), loadout };
}

/**
 * The packed items at work during a workout, after each engine step: the
 * Runner's High once the GPS locks, the Pre-Workout's full pace meter, and
 * the gel at the first bonk. Each is spent once.
 */
export function stepLoadout(
  prev: GameEngineState,
  next: GameEngineState,
  deltaMs: number
): GameEngineState {
  const held = next.loadout;
  if (!held || next.gameState !== "playing") return next;
  if ((next.gpsMs ?? 0) > 0) return next;
  let loadout = held;
  let state = next;
  if (loadout.high) {
    loadout = { ...loadout, high: false };
    state = {
      ...state,
      starMs: Math.max(state.starMs ?? 0, HIGH_MS),
      banner: { text: "RUNNER'S HIGH!", ttlMs: 1800, tone: "good" },
    };
  }
  if (loadout.preworkoutMs > 0) {
    // The Pre-Workout ends at the first take-off, which leaves with the full
    // meter, or with a lost life, which starts the stage over without it.
    const ended =
      next.isGrounded === false || (next.lives ?? 1) < (prev.lives ?? 1);
    const ms = Number.isFinite(deltaMs) ? Math.max(0, deltaMs) : 0;
    loadout = {
      ...loadout,
      preworkoutMs: ended ? 0 : Math.max(0, loadout.preworkoutMs - ms),
    };
    if (!ended) state = { ...state, paceMeter: 1 };
  }
  if (
    loadout.gel &&
    next.bodyBattery?.bonked === true &&
    prev.bodyBattery?.bonked !== true
  ) {
    loadout = { ...loadout, gel: false };
    state = {
      ...state,
      bodyBattery: { value: BODY_BATTERY_MAX, bonked: false },
      banner: { text: "ENERGY GEL · BATTERY FULL", ttlMs: 1800, tone: "good" },
    };
  }
  const spent = !loadout.high && !loadout.gel && loadout.preworkoutMs <= 0;
  return { ...state, loadout: spent ? null : loadout };
}
