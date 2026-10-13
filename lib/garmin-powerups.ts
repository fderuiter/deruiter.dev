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
 *
 * A Buff runner who bumps a power block gets a Heat Map (#1989). At the Heat
 * Map tier the action key throws heat bolts that bounce along the course and
 * defeat bugs and watchdogs. A cape block gives a Buff runner the Compression
 * Cape instead (#1990), whose rules live in `lib/garmin-cape.ts`. A suit
 * block holds the Tri Suit (#1993), which swims a water stage at full pace
 * and sinks slowly; its swim rules live in `lib/garmin-swim.ts`.
 */
import { clamp } from "./game-utils";
import {
  BLOCK_SIZE,
  type CourseBlock,
  type CourseLayout,
  isFootingOverGap,
} from "./garmin-course";

/** The runner's power tier, from weakest to strongest. */
export type PowerTier = "base" | "buff" | "heatmap" | "cape" | "trisuit";

/** What a pickup grants when touched. */
export type PickupKind = "shake" | "high" | "heatmap" | "cape" | "suit";

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

/**
 * A heat bolt thrown by a Heat Map runner. Positions are world pixels; `x`
 * is the left edge and `y` the top of a {@link BOLT_SIZE} square.
 */
export interface Bolt {
  id: number;
  x: number;
  y: number;
  /** World pixels per 60 Hz frame. */
  vx: number;
  vy: number;
}

/** Edge length of a heat bolt, in pixels. */
export const BOLT_SIZE = 6;
/** Most heat bolts on the face at once. */
export const MAX_BOLTS = 2;
/** Shortest gap between two throws. */
export const BOLT_COOLDOWN_MS = 250;
/** A bolt's forward speed in world pixels per frame, faster than a sprint. */
export const BOLT_SPEED = 7;
/** Downward speed a bolt is thrown with. */
export const BOLT_THROW_VY = 1;
/** Upward speed a bolt bounces with on landing. */
export const BOLT_BOUNCE_VY = -3.5;
/** Points for a bolt defeating a bug or a watchdog. */
export const BOLT_DEFEAT_SCORE = 200;
const BOLT_GRAVITY = 0.45;
const BOLT_MAX_FALL = 6;

/**
 * Height of the runner's box for a tier. The Tri Suit is Base height, so it
 * walks under the Basement Gym's racks.
 */
export function playerHeightFor(power: PowerTier | undefined): number {
  return power === undefined || power === "base" || power === "trisuit"
    ? BASE_HEIGHT
    : BUFF_HEIGHT;
}

/**
 * What a Sync Block gives when bumped. A power block gives a Protein Shake
 * to a Base runner and a Heat Map to a stronger one; a cape block gives a
 * Protein Shake to a Base runner and a Compression Cape to a stronger one. A
 * suit block always gives the Tri Suit. A Runner's High block always gives a
 * Runner's High.
 */
export function blockReward(
  contents: CourseBlock["contents"],
  power: PowerTier | undefined
): PickupKind | "kudos" {
  if (contents === "high") return "high";
  if (contents === "suit") return "suit";
  if (contents === "power" || contents === "cape") {
    if ((power ?? "base") === "base") return "shake";
    return contents === "cape" ? "cape" : "heatmap";
  }
  return "kudos";
}

/**
 * The tier after collecting a pickup. A Protein Shake makes a Base runner
 * Buff and leaves a stronger one as it is; a Heat Map makes any runner a
 * Heat Map runner, and a Compression Cape any runner a Cape runner. A Tri
 * Suit makes a Base or Buff runner a Tri Suit runner and leaves a Heat Map or
 * Cape runner as it is. A Runner's High leaves the tier alone.
 */
export function collectTier(
  power: PowerTier | undefined,
  kind: PickupKind
): PowerTier {
  const current = power ?? "base";
  if (kind === "heatmap" || kind === "cape") return kind;
  if (kind === "shake" && current === "base") return "buff";
  if (kind === "suit") {
    return current === "base" || current === "buff" ? "trisuit" : current;
  }
  return current;
}

/**
 * Height a Tri Suit pickup floats up to: the swim surface (SWIM_SURFACE_Y in
 * lib/garmin-swim.ts, which imports this module, so it is mirrored here).
 */
export const SUIT_FLOAT_Y = 96;
/** How fast a Tri Suit pickup floats up, in pixels per frame. */
export const SUIT_FLOAT_SPEED = 0.6;

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
    // A Heat Map, a Cape and a Tri Suit stay on their block; the rest run off.
    vx: kind === "high" ? HIGH_SPEED : kind === "shake" ? SHAKE_SPEED : 0,
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
 * The tier left after a hit. Any powered-up runner drops to Base and
 * survives; a Base runner does not.
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
    // A Tri Suit floats up through the water to the surface and waits
    // there for a swimmer, rather than sitting on its block.
    if (p.kind === "suit") {
      next.push({
        ...p,
        vy: 0,
        y: Math.max(SUIT_FLOAT_Y, p.y - SUIT_FLOAT_SPEED * dtRatio),
      });
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

/**
 * Whether a runner can throw a heat bolt now: Heat Map tier, the cooldown
 * spent, and fewer than {@link MAX_BOLTS} on the face.
 */
export function canThrowBolt(
  power: PowerTier | undefined,
  bolts: readonly Bolt[] | undefined,
  cooldownMs: number | undefined
): boolean {
  return (
    power === "heatmap" &&
    (bolts?.length ?? 0) < MAX_BOLTS &&
    (cooldownMs ?? 0) <= 0
  );
}

/** A bolt leaving the runner's front edge at hand height. */
export function spawnBolt(id: number, frontX: number, handY: number): Bolt {
  return {
    id,
    x: frontX,
    y: handY - BOLT_SIZE / 2,
    vx: BOLT_SPEED,
    vy: BOLT_THROW_VY,
  };
}

/**
 * Moves heat bolts one tick. A bolt falls, bounces off the lane, ledges and
 * block tops, and is gone when it drops into a gap and off the face, runs
 * into the side of a block, or leaves the face ahead of `cameraX`.
 */
export function stepBolts(
  bolts: readonly Bolt[],
  course: CourseLayout,
  groundY: number,
  cameraX: number,
  canvasSize: number,
  deltaMs: number
): Bolt[] {
  if (bolts.length === 0) return [];
  const dtRatio = deltaMs / 16.666;
  const next: Bolt[] = [];
  for (const b of bolts) {
    const x = b.x + b.vx * dtRatio;
    let vy = Math.min(BOLT_MAX_FALL, b.vy + BOLT_GRAVITY * dtRatio);
    let y = b.y + vy * dtRatio;
    const prevBottom = b.y + BOLT_SIZE;
    const nextBottom = y + BOLT_SIZE;
    let landedOn: CourseBlock | null = null;
    if (vy >= 0) {
      let landing = Infinity;
      let landingBlock: CourseBlock | null = null;
      const consider = (top: number, block: CourseBlock | null) => {
        if (prevBottom <= top + 1 && nextBottom >= top && top < landing) {
          landing = top;
          landingBlock = block;
        }
      };
      if (
        prevBottom <= groundY + 1 &&
        !isFootingOverGap(course, x + 1, x + BOLT_SIZE - 1)
      ) {
        consider(groundY, null);
      }
      for (const l of course.ledges) {
        if (x + BOLT_SIZE > l.x && x < l.x + l.width) consider(l.y, null);
      }
      for (const k of course.blocks) {
        if (x + BOLT_SIZE > k.x && x < k.x + BLOCK_SIZE) consider(k.y, k);
      }
      if (landing !== Infinity) {
        y = landing - BOLT_SIZE;
        vy = BOLT_BOUNCE_VY;
        landedOn = landingBlock;
      }
    }
    // Running into the side or underside of a block puts the bolt out.
    const hitWall = course.blocks.some(
      (k) =>
        k !== landedOn &&
        x + BOLT_SIZE > k.x &&
        x < k.x + BLOCK_SIZE &&
        y + BOLT_SIZE > k.y + 1 &&
        y < k.y + BLOCK_SIZE
    );
    if (hitWall) continue;
    if (y > canvasSize || x > cameraX + canvasSize) continue;
    next.push({ ...b, x, y, vy });
  }
  return next;
}

/** Whether a bolt overlaps a box given in world pixels. */
export function boltHits(
  bolt: Bolt,
  left: number,
  top: number,
  right: number,
  bottom: number
): boolean {
  return (
    bolt.x + BOLT_SIZE > left &&
    bolt.x < right &&
    bolt.y + BOLT_SIZE > top &&
    bolt.y < bottom
  );
}
