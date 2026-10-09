import { clamp } from "@/lib/game-utils";
import {
  DAY_END,
  HARD_STOP,
  type ActionCost,
  type WorldActionKind,
  type WorldResult,
  type WorldState,
} from "../types";

/**
 * What each kind of action costs. Walking is priced per tile and computed by
 * `actionCost`; the entry here is the cost of one tile's worth of walking at
 * a steady pace (four tiles a minute).
 */
export const ACTION_COSTS: Record<WorldActionKind, ActionCost> = {
  walk: { minutes: 0.25, energy: 0, focus: 0 },
  talk: { minutes: 10, energy: 1, focus: 2 },
  readMail: { minutes: 10, energy: 1, focus: 3 },
  reviewEdc: { minutes: 20, energy: 2, focus: 10 },
  document: { minutes: 20, energy: 2, focus: 8 },
  sponsorCall: { minutes: 45, energy: 6, focus: 8 },
  meeting: { minutes: 45, energy: 5, focus: 5 },
  amendment: { minutes: 60, energy: 6, focus: 25 },
  coffee: { minutes: 5, energy: 0, focus: 0 },
};

/** Energy work past the end of the office day costs, as a multiple. */
export const OVERTIME_ENERGY_FACTOR = 2;
/** Cups after which coffee stops helping and starts costing focus. */
const USEFUL_COFFEES = 4;
/** Most energy a late night can keep from being recovered overnight. */
const MAX_FATIGUE = 40;

/** Minutes of the span from `start` to `end` that fall after the office day. */
export function lateMinutes(start: number, end: number): number {
  const lateFrom = start > DAY_END ? start : DAY_END;
  return end > lateFrom ? end - lateFrom : 0;
}

/** Whole minutes, energy and focus for one action; walking scales by tiles. */
export function actionCost(kind: WorldActionKind, tiles = 0): ActionCost {
  const base = ACTION_COSTS[kind];
  if (kind !== "walk") return base;
  const steps = Math.max(0, tiles);
  return {
    minutes: Math.ceil(steps * base.minutes),
    energy: Math.floor(steps / 40),
    focus: 0,
  };
}

/**
 * Spends the time, energy and focus an action costs. Work that runs past the
 * end of the office day is overtime: it costs double energy and is carried
 * home as fatigue. Refuses when the action would run past the hard stop or
 * the player has no energy left for it.
 */
export function spend(
  world: WorldState,
  kind: WorldActionKind,
  tiles = 0
): WorldResult<{ cost: ActionCost }> {
  if (!(kind in ACTION_COSTS)) return { ok: false, reason: "unknown-action" };
  if (world.study.status !== "running")
    return { ok: false, reason: "study-complete" };
  if (kind === "coffee") return drinkCoffee(world);
  return spendCost(world, actionCost(kind, tiles));
}

/**
 * Spends an arbitrary cost of time, energy and focus, with the same overtime
 * and refusal rules as `spend`. Used by actions that are not one of the
 * standard kinds, such as answering an interruption.
 */
export function spendCost(
  world: WorldState,
  cost: ActionCost
): WorldResult<{ cost: ActionCost }> {
  if (world.study.status !== "running")
    return { ok: false, reason: "study-complete" };
  const end = world.minute + cost.minutes;
  if (end > HARD_STOP) return { ok: false, reason: "too-late" };
  const late = lateMinutes(world.minute, end);
  const share = cost.minutes > 0 ? late / cost.minutes : 0;
  const energy = Math.round(
    cost.energy * (1 + share * (OVERTIME_ENERGY_FACTOR - 1))
  );
  if (energy > world.energy) return { ok: false, reason: "too-tired" };
  return {
    ok: true,
    cost: { ...cost, energy },
    world: {
      ...world,
      minute: end,
      energy: world.energy - energy,
      focus: clamp(world.focus - cost.focus, 0, 100),
      overtime: world.overtime + late,
    },
  };
}

/**
 * Lets some minutes pass doing nothing, such as waiting for someone to move
 * out of a doorway. It costs the minutes and nothing else; time past the end
 * of the day is overtime as for any other action.
 */
export function passTime(
  world: WorldState,
  minutes: number
): WorldResult<{ cost: ActionCost }> {
  return spendCost(world, {
    minutes: clamp(Math.floor(minutes), 1, 60),
    energy: 0,
    focus: 0,
  });
}

/**
 * A cup of coffee. The first four restore energy and focus; after that each
 * cup restores a little energy and costs focus.
 */
export function drinkCoffee(
  world: WorldState
): WorldResult<{ cost: ActionCost }> {
  if (world.study.status !== "running")
    return { ok: false, reason: "study-complete" };
  const minutes = ACTION_COSTS.coffee.minutes;
  if (world.minute + minutes > HARD_STOP)
    return { ok: false, reason: "too-late" };
  const useful = world.coffees < USEFUL_COFFEES;
  const energyGain = useful ? 20 : 5;
  const focusGain = useful ? 10 : -5;
  return {
    ok: true,
    cost: { minutes, energy: -energyGain, focus: -focusGain },
    world: {
      ...world,
      minute: world.minute + minutes,
      energy: clamp(world.energy + energyGain, 0, 100),
      focus: clamp(world.focus + focusGain, 0, 100),
      coffees: world.coffees + 1,
      overtime:
        world.overtime + lateMinutes(world.minute, world.minute + minutes),
    },
  };
}

/** Energy a day's overtime keeps from being recovered overnight. */
export function fatigueFrom(overtimeMinutes: number): number {
  return clamp(Math.round(overtimeMinutes / 6), 0, MAX_FATIGUE);
}

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

/** Study days are working days; day 1 is a Monday. */
export function weekdayFor(day: number): string {
  return WEEKDAYS[(((Math.max(1, day) - 1) % 5) + 5) % 5];
}

/** A clock time such as "10:42 AM" for minutes after midnight. */
export function formatClock(minute: number): string {
  const total = Math.max(0, Math.floor(minute));
  const hours24 = Math.floor(total / 60) % 24;
  const minutes = total % 60;
  const suffix = hours24 < 12 ? "AM" : "PM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${minutes.toString().padStart(2, "0")} ${suffix}`;
}
