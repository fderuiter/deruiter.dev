/**
 * Body Battery for Monkey C Mayhem (#2010).
 *
 * Body Battery is the Garmin wellness gauge the runner carries. Running on
 * footing drains it, sprinting drains it faster wherever the runner is, in
 * the air or in the water too, and braking on footing recharges it. Hits cost charge, while Kudos, power-ups and stage clears
 * refill it. A runner whose battery reaches 0 bonks: it cannot sprint, and
 * recharges at a steady pace or a jog, until the battery climbs back to
 * {@link BONK_RECOVER_AT}. The run never ends from Body Battery.
 *
 * This module answers the rules; the engine in `lib/garmin-engine.ts` applies
 * them to the run. Every function returns a new state and never mutates its
 * input.
 */
import { clamp } from "./game-utils";

/** Full Body Battery. */
export const BODY_BATTERY_MAX = 100;
/** Charge lost per second running on footing. */
export const BODY_BATTERY_RUN_DRAIN_PER_S = 0.35;
/** Charge lost per second sprinting on footing. */
export const BODY_BATTERY_SPRINT_DRAIN_PER_S = 1.8;
/** Charge gained per second braking (easy jog) on footing. */
export const BODY_BATTERY_REST_GAIN_PER_S = 0.8;
/** Charge lost to a hit. */
export const BODY_BATTERY_HIT_COST = 15;
/** Charge gained from a Kudos pickup. */
export const BODY_BATTERY_KUDOS_GAIN = 2;
/** Charge gained from a power-up or a stage clear. */
export const BODY_BATTERY_POWER_GAIN = 25;
/** A bonked runner recovers, and the bonk ends, once the value reaches this. */
export const BONK_RECOVER_AT = 25;

/** The runner's Body Battery: charge from 0 to {@link BODY_BATTERY_MAX}, and whether it is bonked. */
export interface BodyBattery {
  value: number;
  bonked: boolean;
}

/** A fresh, full, unbonked Body Battery. */
export const FRESH_BODY_BATTERY: BodyBattery = {
  value: BODY_BATTERY_MAX,
  bonked: false,
};

/** Reads a battery into a clamped value with the bonk rules applied. Never mutates. */
function normalize(bb: BodyBattery | undefined): BodyBattery {
  const value = Number.isFinite(bb?.value)
    ? clamp(bb?.value as number, 0, BODY_BATTERY_MAX)
    : BODY_BATTERY_MAX;
  return applyBonk(value, bb?.bonked === true);
}

/** Applies the bonk rules to a clamped value: 0 bonks, and recovery at {@link BONK_RECOVER_AT} clears it. */
function applyBonk(value: number, bonked: boolean): BodyBattery {
  if (value <= 0) {
    return { value: 0, bonked: true };
  }
  if (bonked && value < BONK_RECOVER_AT) {
    return { value, bonked: true };
  }
  return { value, bonked: false };
}

/** Narrows a run input to 1, 0 or -1, treating anything else as a run. */
function runInput(input: -1 | 0 | 1 | undefined): -1 | 0 | 1 {
  if (input === 1 || input === -1) {
    return input;
  }
  return 0;
}

/** input: 1 sprint, 0 run, -1 brake (the engine's run input). In the air only a sprint changes it: a sprint costs charge wherever the runner is (#2022). Hitting 0 sets bonked. Recovering to >= BONK_RECOVER_AT clears it. While bonked, a steady pace recharges like braking. */
export function stepBodyBattery(
  bb: BodyBattery | undefined,
  input: -1 | 0 | 1 | undefined,
  grounded: boolean,
  deltaMs: number
): BodyBattery {
  const current = normalize(bb);
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) {
    return current;
  }
  const seconds = deltaMs / 1000;
  const mode = runInput(input);
  const sprinting = mode === 1 && !current.bonked;
  if (!grounded && !sprinting) {
    return current;
  }
  // A bonked runner can't sprint, and recharges at an easy or steady pace.
  const resting = mode === -1 || (current.bonked && mode === 0);
  const value = resting
    ? current.value + BODY_BATTERY_REST_GAIN_PER_S * seconds
    : current.value -
      (sprinting
        ? BODY_BATTERY_SPRINT_DRAIN_PER_S
        : BODY_BATTERY_RUN_DRAIN_PER_S) *
        seconds;
  return applyBonk(clamp(value, 0, BODY_BATTERY_MAX), current.bonked);
}

/** Adds (or with a negative amount, removes) charge, clamped to 0..MAX, applying the same bonk rules. */
export function adjustBodyBattery(
  bb: BodyBattery | undefined,
  amount: number
): BodyBattery {
  const current = normalize(bb);
  if (!Number.isFinite(amount)) {
    return current;
  }
  return applyBonk(
    clamp(current.value + amount, 0, BODY_BATTERY_MAX),
    current.bonked
  );
}

/** The run input actually used: while bonked, a sprint (1) becomes a steady run (0). */
export function effectiveRunInput(
  bb: BodyBattery | undefined,
  input: -1 | 0 | 1 | undefined
): -1 | 0 | 1 {
  const mode = runInput(input);
  return normalize(bb).bonked && mode === 1 ? 0 : mode;
}

/** 0..1 for the HUD gauge. */
export function bodyBatteryFraction(bb: BodyBattery | undefined): number {
  return clamp(normalize(bb).value / BODY_BATTERY_MAX, 0, 1);
}

/** Garmin-style label for the HUD: "HIGH" (>=75), "MED" (>=40), "LOW" (>0), "BONK" when bonked. */
export function bodyBatteryLabel(
  bb: BodyBattery | undefined
): "HIGH" | "MED" | "LOW" | "BONK" {
  const current = normalize(bb);
  if (current.bonked) {
    return "BONK";
  }
  if (current.value >= 75) {
    return "HIGH";
  }
  if (current.value >= 40) {
    return "MED";
  }
  return "LOW";
}
