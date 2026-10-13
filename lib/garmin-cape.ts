/**
 * The pace meter and the Compression Cape for Monkey C Mayhem (#1990).
 *
 * The pace meter is a six-segment bar that fills while the runner sprints on
 * the track and drains while it doesn't; in the air it holds. A full meter
 * gives a higher jump.
 *
 * The Compression Cape is a power tier. Holding jump while falling glides at
 * a capped fall speed. Jumping with a full meter takes off: for
 * {@link CAPE_FLIGHT_MS} each further jump press climbs again. The action key
 * spins the cape, which defeats bugs and watchdogs beside the runner and
 * bumps Sync Blocks from the side.
 *
 * This module answers the rules; the engine in `lib/garmin-engine.ts` applies
 * them to the run.
 */
import { clamp } from "./game-utils";
import type { PowerTier } from "./garmin-powerups";

/** Segments in the pace meter. */
export const PACE_SEGMENTS = 6;
/** Sprinting on the track this long fills the meter from empty. */
export const PACE_FILL_MS = 1200;
/** Not sprinting on the track this long drains the meter from full. */
export const PACE_DRAIN_MS = 1500;
/** Jump speed with a full meter, against the usual -10. */
export const FULL_PACE_JUMP_FORCE = -11.5;
/** Fastest fall while gliding with the cape. */
export const CAPE_GLIDE_VY = 1.4;
/** How long a take-off keeps the runner able to climb. */
export const CAPE_FLIGHT_MS = 4000;
/** Upward speed each jump press gives during flight. */
export const CAPE_FLAP_VY = -5.5;
/** Highest the top of the runner's box goes in flight, in canvas pixels. */
export const CAPE_CEILING_Y = 40;
/** Length of a cape spin. */
export const CAPE_SPIN_MS = 300;
/** Shortest gap between the start of two spins. */
export const CAPE_SPIN_COOLDOWN_MS = 450;
/** How far beyond the runner's sides a spin reaches, in pixels. */
export const CAPE_SPIN_REACH = 12;
/** Points for spinning into a bug or a watchdog. */
export const SPIN_DEFEAT_SCORE = 200;

/** Whether the meter is full. */
export function isPaceFull(meter: number | undefined): boolean {
  return (meter ?? 0) >= 1;
}

/** Lit segments for a meter value, 0 to {@link PACE_SEGMENTS}. */
export function paceSegments(meter: number | undefined): number {
  const value = Number.isFinite(meter) ? (meter as number) : 0;
  return clamp(Math.floor(value * PACE_SEGMENTS + 1e-9), 0, PACE_SEGMENTS);
}

/**
 * The meter after `deltaMs`. Sprinting on the track fills it, running or
 * braking on the track drains it, and in the air it holds. `fillScale`
 * (default 1) slows only the fill, as carrying a medicine ball does (#2024);
 * the drain is untouched.
 */
export function stepPaceMeter(
  meter: number | undefined,
  grounded: boolean,
  sprinting: boolean,
  deltaMs: number,
  fillScale: number = 1
): number {
  const value = Number.isFinite(meter) ? (meter as number) : 0;
  if (!grounded || !Number.isFinite(deltaMs) || deltaMs <= 0) {
    return clamp(value, 0, 1);
  }
  const change = sprinting
    ? (deltaMs / PACE_FILL_MS) * fillScale
    : -deltaMs / PACE_DRAIN_MS;
  return clamp(value + change, 0, 1);
}

/** The jump speed for a take-off: higher with a full meter. */
export function jumpForceFor(meter: number | undefined, base: number): number {
  return isPaceFull(meter) ? FULL_PACE_JUMP_FORCE : base;
}

/** Whether a take-off with this tier and meter starts a flight. */
export function startsFlight(
  power: PowerTier | undefined,
  meter: number | undefined
): boolean {
  return power === "cape" && isPaceFull(meter);
}

/**
 * The fall speed after the glide cap: a Cape runner holding jump falls no
 * faster than {@link CAPE_GLIDE_VY}. Rising is never changed.
 */
export function glideVy(
  vy: number,
  power: PowerTier | undefined,
  jumpHeld: boolean
): number {
  return power === "cape" && jumpHeld && vy > CAPE_GLIDE_VY
    ? CAPE_GLIDE_VY
    : vy;
}

/** Whether a Cape runner can start a spin now. */
export function canSpin(
  power: PowerTier | undefined,
  cooldownMs: number | undefined
): boolean {
  return power === "cape" && (cooldownMs ?? 0) <= 0;
}

/**
 * Whether a box (canvas pixels) is within a spin's reach of the runner's box:
 * level with the body and no more than {@link CAPE_SPIN_REACH} beyond either
 * side.
 */
export function inSpinReach(
  runner: { left: number; right: number; top: number; bottom: number },
  box: { left: number; right: number; top: number; bottom: number }
): boolean {
  return (
    box.right > runner.left - CAPE_SPIN_REACH &&
    box.left < runner.right + CAPE_SPIN_REACH &&
    box.bottom > runner.top &&
    box.top < runner.bottom
  );
}
