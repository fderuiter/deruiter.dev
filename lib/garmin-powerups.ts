/**
 * Power-ups and lives for Monkey C Mayhem (#1988).
 *
 * The runner has a power tier. Base is the starting monkey; a Protein Shake
 * makes it Buff, which is taller and survives one hit by dropping back to
 * Base. A Runner's High is a short spell of invincibility. Lives replace the
 * old one-shot run: a fall or an enemy hit at Base costs a life and restarts
 * the stage, and every {@link KUDOS_PER_LIFE} Kudos earns one back.
 *
 * Power-ups pop out of Sync Blocks and travel the course as pickups. This
 * module moves them and answers the tier rules; the engine in
 * `lib/garmin-engine.ts` collects them and applies the results.
 */
import { clamp } from "./game-utils";
import {
  BLOCK_SIZE,
  type CourseBlock,
  type CourseLayout,
  isFootingOverGap,
} from "./garmin-course";

/** The runner's power tier, from weakest to strongest. */
export type PowerTier = "base" | "buff";

/** What a pickup grants when touched. */
export type PickupKind = "shake" | "high";

/**
 * A power-up travelling the course. Positions are world pixels, like the
 * course features; `x` is the left edge and `y` the top.
 */
export interface Pickup {
  id: number;
  kind: PickupKind;
  x: number;
  y: number;
  /** World pixels per 60 Hz frame; positive moves away from the runner. */
  vx: number;
  vy: number;
  /** Time left rising out of its block; it doesn't move or fall until 0. */
  emergeMs: number;
}

/** Height of the runner's box at Base, in pixels. */
export const BASE_HEIGHT = 24;
/** Height of the runner's box when Buff, in pixels. */
export const BUFF_HEIGHT = 32;
/** Edge length of a pickup, in pixels. */
export const PICKUP_SIZE = 12;
/** Lives at the start of a run. */
export const START_LIVES = 3;
/** Most lives the counter holds. */
export const MAX_LIVES = 99;
/** Kudos per extra life. */
export const KUDOS_PER_LIFE = 100;
/** Points for collecting a power-up. */
export const POWERUP_SCORE = 1000;
/** Points for running into an enemy during a Runner's High. */
export const HIGH_DEFEAT_SCORE = 200;
/** Length of a Runner's High. */
export const HIGH_MS = 8000;
/** Hit immunity after dropping a tier or losing a life. */
export const DAMAGE_GRACE_MS = 1500;
/** Time a pickup takes to rise out of its block. */
export const PICKUP_EMERGE_MS = 400;
/** A Protein Shake's travel speed. */
export const SHAKE_SPEED = 1.2;
/** A Runner's High's travel speed; it bounces as it goes. */
export const HIGH_SPEED = 1.6;
/** Upward speed a Runner's High bounces with on landing. */
export const HIGH_BOUNCE_VY = -6;
const PICKUP_GRAVITY = 0.6;
const PICKUP_MAX_FALL = 9;

/** Height of the runner's box for a tier. */
export function playerHeightFor(power: PowerTier | undefined): number {
  return power === "buff" ? BUFF_HEIGHT : BASE_HEIGHT;
}

/**
 * What a Sync Block gives when bumped. A power block gives a Protein Shake
 * to a Base runner, and Kudos once the runner is already Buff; a Runner's
 * High block always gives a Runner's High.
 */
export function blockReward(
  contents: CourseBlock["contents"],
  power: PowerTier | undefined
): PickupKind | "kudos" {
  if (contents === "high") return "high";
  if (contents === "power")
    return (power ?? "base") === "base" ? "shake" : "kudos";
  return "kudos";
}

/** A pickup just bumped out of `block`, still inside it. */
export function emergePickup(
  kind: PickupKind,
  block: CourseBlock,
  id: number
): Pickup {
  return {
    id,
    kind,
    x: block.x + (BLOCK_SIZE - PICKUP_SIZE) / 2,
    y: block.y,
    vx: kind === "high" ? HIGH_SPEED : SHAKE_SPEED,
    vy: 0,
    emergeMs: PICKUP_EMERGE_MS,
  };
}

/**
 * Extra lives earned by the Kudos count going from `before` to `after`:
 * one for every multiple of {@link KUDOS_PER_LIFE} crossed.
 */
export function livesEarned(before: number, after: number): number {
  if (!Number.isFinite(before) || !Number.isFinite(after) || after <= before) {
    return 0;
  }
  return (
    Math.floor(after / KUDOS_PER_LIFE) -
    Math.floor(Math.max(0, before) / KUDOS_PER_LIFE)
  );
}

/** Lives after adding `earned`, capped at {@link MAX_LIVES}. */
export function addLives(lives: number | undefined, earned: number): number {
  return clamp((lives ?? 1) + Math.max(0, earned), 0, MAX_LIVES);
}

/**
 * The tier left after a hit. A Buff runner drops to Base and survives; a
 * Base runner does not.
 */
export function damageTier(power: PowerTier | undefined): {
  power: PowerTier;
  survived: boolean;
} {
  return (power ?? "base") === "base"
    ? { power: "base", survived: false }
    : { power: "base", survived: true };
}

/**
 * Moves pickups one tick: emerging ones rise out of their block, the rest
 * travel, fall under gravity, land on the lane, ledges and blocks, and drop
 * through gaps. A Runner's High bounces on landing. Pickups that fall off
 * the face or scroll behind `cameraX` are dropped.
 */
export function stepPickups(
  pickups: readonly Pickup[],
  course: CourseLayout,
  groundY: number,
  cameraX: number,
  canvasSize: number,
  deltaMs: number
): Pickup[] {
  if (pickups.length === 0) return [];
  const dtRatio = deltaMs / 16.666;
  const next: Pickup[] = [];
  for (const p of pickups) {
    if (p.emergeMs > 0) {
      const emergeMs = Math.max(0, p.emergeMs - deltaMs);
      const rise =
        (PICKUP_SIZE * Math.min(deltaMs, p.emergeMs)) / PICKUP_EMERGE_MS;
      next.push({ ...p, emergeMs, y: p.y - rise });
      continue;
    }
    const x = p.x + p.vx * dtRatio;
    let vy = Math.min(PICKUP_MAX_FALL, p.vy + PICKUP_GRAVITY * dtRatio);
    let y = p.y + vy * dtRatio;
    const prevBottom = p.y + PICKUP_SIZE;
    const nextBottom = y + PICKUP_SIZE;
    if (vy >= 0) {
      let landing = Infinity;
      const consider = (top: number) => {
        if (prevBottom <= top + 1 && nextBottom >= top && top < landing) {
          landing = top;
        }
      };
      if (!isFootingOverGap(course, x + 2, x + PICKUP_SIZE - 2)) {
        consider(groundY);
      }
      for (const l of course.ledges) {
        if (x + PICKUP_SIZE > l.x && x < l.x + l.width) consider(l.y);
      }
      for (const b of course.blocks) {
        if (x + PICKUP_SIZE > b.x && x < b.x + BLOCK_SIZE) consider(b.y);
      }
      if (landing !== Infinity) {
        y = landing - PICKUP_SIZE;
        vy = p.kind === "high" ? HIGH_BOUNCE_VY : 0;
      }
    }
    if (y > canvasSize || x + PICKUP_SIZE < cameraX - 40) continue;
    next.push({ ...p, x, y, vy });
  }
  return next;
}
