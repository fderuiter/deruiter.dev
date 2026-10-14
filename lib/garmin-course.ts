/**
 * The Monkey C Mayhem course (#1950): the run is a 5K of five 1 km stages,
 * each a seeded layout of track gaps, one-way ledges, Sync Blocks, Kudos and
 * a finish pole. Positions are world pixels along the track; the camera sits
 * at ten pixels per metre run, so a feature is on screen at
 * `x - distanceMeters * 10`.
 *
 * This module only lays the course out and answers geometry questions about
 * it. The engine in `lib/garmin-engine.ts` moves the runner through it.
 */
import type { SecondWindKind } from "./garmin-second-wind";
import { clamp } from "./game-utils";
import { isWaterTheme, type StageTheme } from "./garmin-themes";

/** World pixels per metre of run, matching the engine's lane markers. */
export const PX_PER_METER = 10;
/** Length of one stage in metres. */
export const STAGE_LENGTH_METERS = 1000;
/** Stages in the full course; clearing the last one completes the run. */
export const STAGE_COUNT = 5;
/** Edge length of a Sync Block or brick, in pixels. */
export const BLOCK_SIZE = 14;
/** Thickness of a one-way ledge, in pixels. */
export const LEDGE_THICKNESS = 5;
/** Radius of a Kudos coin, in pixels. */
export const KUDOS_RADIUS = 5;
/** Height of the finish pole above the lane, in pixels. */
export const POLE_HEIGHT = 110;
/**
 * The runner's Base box height. Mirrors BASE_HEIGHT in `lib/garmin-powerups.ts`,
 * which imports this module, so it cannot be imported here without a cycle.
 */
const RUNNER_BASE_HEIGHT = 24;
/** Clear space between a Basement Gym rack's underside and the runner's top. */
const CEILING_HEAD_ROOM = 3;
/** Basement Gym rack width: from the minimum, plus up to the range. */
const CEILING_MIN_WIDTH = 96;
const CEILING_WIDTH_RANGE = 45;
/** Racks per Basement Gym stage, at most. */
const CEILING_COUNT = 3;
/** Open Water zones per stage, at least and at most. */
const CURRENT_MIN_COUNT = 2;
const CURRENT_COUNT_RANGE = 2;
/** Open Water zone width range, in pixels. */
const CURRENT_MIN_WIDTH = 160;
const CURRENT_WIDTH_RANGE = 101;
/**
 * Current speed in metres per 60 Hz frame. Mirrors CURRENT_FLOW in the swim
 * constants; the engine reads that one.
 */
const CURRENT_SPEED = 0.09;
/** Clear space that keeps a rack or current away from its neighbours, in pixels. */
const FEATURE_CLEARANCE = 40;
/** Flat run kept clear at the start of a stage and before its pole. */
const SPOT_LEAD_IN = 450;
const SPOT_TAIL = 400;
/** Reach of the finish pole in the clearance check, in pixels. */
const POLE_REACH = 20;

/** A missing stretch of track; the runner falls through it. */
export interface CourseGap {
  x: number;
  width: number;
}

/** A one-way ledge: the runner lands on it from above and jumps up through it. */
export interface CourseLedge {
  x: number;
  /** Top surface. */
  y: number;
  width: number;
}

/**
 * A block floating over the lane. Bumping a Sync Block from below pops its
 * contents once: Kudos, a power-up (a Protein Shake for a Base runner, then
 * a Heat Map from a power block or a Compression Cape from a cape block), or
 * a Runner's High, or on some land stages a Running Buddy (#2024). A brick is
 * plain solid footing.
 */
export interface CourseBlock {
  id: number;
  x: number;
  /** Top surface. */
  y: number;
  kind: "sync" | "brick";
  contents:
    "kudos" | "power" | "cape" | "high" | "suit" | "buddy" | "medal" | "wind";
  used: boolean;
  /**
   * Id of the Finisher Medal a PR Board hides, found by breaking it (#2025),
   * or that a Second Wind block pays out when its goal is met (#2026).
   */
  medalId?: number;
  /** The event a Second Wind block starts (#2026). */
  windKind?: SecondWindKind;
  /** A Kudos turned into a brick by a Rest Day (#1992); it turns back after. */
  fromKudos?: boolean;
}

/** A Kudos coin. */
export interface CourseKudos {
  id: number;
  /** Centre. */
  x: number;
  y: number;
  /** A brick turned into a Kudos by a Rest Day (#1992); it turns back after. */
  fromBrick?: boolean;
}

/** The finish pole that ends a stage. */
export interface CoursePole {
  x: number;
  stage: number;
  /** Height on the pole the runner grabbed, 0 (bottom) to 1 (top), once touched. */
  grabbed?: number;
  /** A secret exit's pole, hidden in a bonus room (#2025). */
  secret?: boolean;
}

/**
 * A Finisher Medal out on the course (#2025). Three hide on every stage; one
 * may sit in a PR Board or a bonus room instead. `x`, `y` are the world-pixel
 * top-left of a {@link MEDAL_SIZE} box.
 */
export interface CourseMedal {
  id: number;
  stage: number;
  x: number;
  y: number;
}

/** An Aid Station checkpoint at a stage's halfway point (#2025). */
export interface CourseCheckpoint {
  /** World x the runner restarts at, and touches it at. */
  x: number;
  stage: number;
}

/** Edge length of a Finisher Medal, in px (#2025). */
export const MEDAL_SIZE = 10;

/**
 * A low bar in the Basement Gym, such as a squat rack. `x` is the world-pixel
 * left edge; `bottom` is the bar's underside in canvas pixels.
 */
export interface CourseCeiling {
  id: number;
  x: number;
  width: number;
  bottom: number;
}

/**
 * An Open Water current. `flow` is metres per 60 Hz frame added to the
 * swimmer's progress: positive with the current, negative against it.
 */
export interface CourseCurrent {
  id: number;
  x: number;
  width: number;
  flow: number;
}

/**
 * A medicine ball resting on the course (#2024). `x` is the world-pixel left
 * edge and `y` the top; its rules live in `lib/garmin-medball.ts`.
 */
export interface CourseMedBall {
  id: number;
  x: number;
  y: number;
}

/** Every live feature of the course, across the current and previous stage. */
export interface CourseLayout {
  gaps: CourseGap[];
  ledges: CourseLedge[];
  blocks: CourseBlock[];
  kudos: CourseKudos[];
  poles: CoursePole[];
  /** Basement Gym racks; absent on other themes. */
  ceilings?: CourseCeiling[];
  /** Open Water currents; absent on other themes. */
  currents?: CourseCurrent[];
  /** Medicine balls resting on the lane (#2024); absent on water stages. */
  medBalls?: CourseMedBall[];
  /** Finisher Medals out on the course (#2025). */
  medals?: CourseMedal[];
  /** Aid Station checkpoints (#2025). */
  checkpoints?: CourseCheckpoint[];
}

/** An empty course, for idle watches and states built before #1950. */
export const EMPTY_COURSE: CourseLayout = {
  gaps: [],
  ledges: [],
  blocks: [],
  kudos: [],
  poles: [],
};

/**
 * A small deterministic random source (mulberry32), so a seed always lays out
 * the same course.
 */
export function courseRandom(seed: number): () => number {
  let a = Math.floor(Number.isFinite(seed) ? seed : 0) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** World x where `stage` (1-based) starts. */
export function stageStartX(stage: number): number {
  return (Math.max(1, stage) - 1) * STAGE_LENGTH_METERS * PX_PER_METER;
}

/** World x of `stage`'s finish pole. */
export function stagePoleX(stage: number): number {
  return stageStartX(stage + 1) - 60;
}

/**
 * True when a spot of `width` at x comes within FEATURE_CLEARANCE of `span`,
 * measured horizontally.
 */
function nearSpan(
  span: { left: number; right: number },
  x: number,
  width: number
): boolean {
  return (
    span.left < x + width + FEATURE_CLEARANCE &&
    span.right > x - FEATURE_CLEARANCE
  );
}

/**
 * Finds the first x in [from, to) where a `width` wide spot passes `ok`: a
 * random scan first, then a dense fallback so a spot is missed only when the
 * span is full.
 */
function findSpot(
  from: number,
  to: number,
  width: number,
  rand: () => number,
  ok: (x: number) => boolean
): number | null {
  let t = from;
  while (t + width <= to) {
    const c = Math.round(t);
    if (c + width <= to && ok(c)) return c;
    t += 60 + rand() * 160;
  }
  for (let c = Math.round(from); c + width <= to; c += 10) {
    if (ok(c)) return c;
  }
  return null;
}

/**
 * Basement Gym racks: up to three low bars, each at least 40 px clear of every
 * gap, ledge, block, Kudos and the pole, and of each other. Drawn from their
 * own random stream so they never shift the stage's layout.
 */
function placeCeilings(
  layout: CourseLayout,
  s: number,
  seed: number,
  groundY: number
): CourseCeiling[] {
  const rand = courseRandom(seed * 89 + s * 6151 + 5);
  const lo = stageStartX(s) + SPOT_LEAD_IN;
  const hi = stagePoleX(s) - SPOT_TAIL;
  const spans: { left: number; right: number }[] = [
    ...layout.gaps.map((g) => ({ left: g.x, right: g.x + g.width })),
    ...layout.ledges.map((l) => ({ left: l.x, right: l.x + l.width })),
    ...layout.blocks.map((b) => ({ left: b.x, right: b.x + BLOCK_SIZE })),
    ...layout.kudos.map((k) => ({
      left: k.x - KUDOS_RADIUS,
      right: k.x + KUDOS_RADIUS,
    })),
    ...layout.poles.map((p) => ({ left: p.x, right: p.x + POLE_REACH })),
  ];
  const ceilings: CourseCeiling[] = [];
  const bottom = groundY - RUNNER_BASE_HEIGHT - CEILING_HEAD_ROOM;
  let nextId = s * 10000 + 7000;
  for (let i = 0; i < CEILING_COUNT; i++) {
    const width = CEILING_MIN_WIDTH + Math.floor(rand() * CEILING_WIDTH_RANGE);
    const fits = (c: number): boolean =>
      spans.every((sp) => !nearSpan(sp, c, width)) &&
      ceilings.every(
        (o) => !nearSpan({ left: o.x, right: o.x + o.width }, c, width)
      );
    const segment = (hi - lo) / CEILING_COUNT;
    const from = lo + i * segment;
    const x =
      findSpot(from, Math.min(from + segment, hi), width, rand, fits) ??
      findSpot(lo, hi, width, rand, fits);
    if (x === null) continue;
    ceilings.push({ id: nextId++, x, width, bottom });
  }
  return ceilings;
}

/**
 * Open Water currents: two or three zones, alternating with the flow first
 * positive, each 160 to 260 px wide and kept 40 px apart, clear of the pole.
 * Drawn from their own random stream.
 */
function placeCurrents(s: number, seed: number): CourseCurrent[] {
  const rand = courseRandom(seed * 97 + s * 4099 + 11);
  const lo = stageStartX(s) + SPOT_LEAD_IN;
  const hi = stagePoleX(s) - SPOT_TAIL;
  const count = CURRENT_MIN_COUNT + Math.floor(rand() * CURRENT_COUNT_RANGE);
  const segment = (hi - lo) / count;
  const currents: CourseCurrent[] = [];
  let nextId = s * 10000 + 8000;
  for (let i = 0; i < count; i++) {
    const width = CURRENT_MIN_WIDTH + Math.floor(rand() * CURRENT_WIDTH_RANGE);
    const fits = (c: number): boolean =>
      currents.every(
        (o) => !nearSpan({ left: o.x, right: o.x + o.width }, c, width)
      );
    const from = lo + i * segment;
    const x =
      findSpot(from, Math.min(from + segment, hi), width, rand, fits) ??
      findSpot(lo, hi, width, rand, fits);
    if (x === null) continue;
    const sign = currents.length % 2 === 0 ? 1 : -1;
    currents.push({
      id: nextId++,
      x,
      width,
      flow: sign * CURRENT_SPEED,
    });
  }
  return currents;
}

/**
 * Lays out one stage. Layouts get harder by stage: wider gaps, more of them,
 * fewer gentle stretches. `groundY` is the lane's top edge. The theme only
 * changes what a water stage's second power block holds (a Compression Suit,
 * not a Cape), and adds Basement Gym racks or Open Water currents. The track
 * path draws the same random numbers as before the theme existed.
 */
export function generateStage(
  stage: number,
  seed: number,
  groundY: number,
  theme: StageTheme = "track"
): CourseLayout {
  const rand = courseRandom(seed * 31 + stage * 7919);
  const s = clamp(
    Math.floor(Number.isFinite(stage) ? stage : 1),
    1,
    STAGE_COUNT
  );
  const water = isWaterTheme(theme);
  const hard = (s - 1) / (STAGE_COUNT - 1);
  const start = stageStartX(s);
  const pole = stagePoleX(s);
  const layout: CourseLayout = {
    gaps: [],
    ledges: [],
    blocks: [],
    kudos: [],
    poles: [{ x: pole, stage: s }],
  };
  let nextId = s * 10000;
  const blockTop = groundY - 72;
  const addKudos = (x: number, y: number) =>
    layout.kudos.push({ id: nextId++, x, y });

  // The opening 450 px of every stage is flat track, so a stage never opens
  // under the runner's feet, and the last 360 px run clear to the pole.
  let x = start + 450;
  // Up to two power blocks a stage, the second holding a cape, and on some
  // stages one Runner's High.
  let powerLeft = 2;
  let highLeft = rand() < 0.35 ? 1 : 0;
  const end = pole - 360;
  while (x < end) {
    const roll = rand();
    if (roll < 0.28 + 0.12 * hard) {
      // A gap: a short hop at first, up to a full sprint jump on stage 5.
      const width = Math.round(30 + rand() * (18 + 26 * hard));
      layout.gaps.push({ x, width });
      addKudos(x + width / 2, groundY - 58);
      x += width;
    } else if (roll < 0.46 + 0.1 * hard) {
      // A wide gap with a ledge to stop on halfway.
      const width = Math.round(96 + rand() * 24);
      layout.gaps.push({ x, width });
      const ledgeW = 34;
      const ledgeX = x + (width - ledgeW) / 2;
      layout.ledges.push({ x: ledgeX, y: groundY - 40, width: ledgeW });
      addKudos(ledgeX + ledgeW / 2, groundY - 58);
      x += width;
    } else if (roll < 0.7) {
      // A row of blocks; the middle one is a Sync Block.
      const count = 3;
      for (let i = 0; i < count; i++) {
        const isSync = i === 1;
        let contents: CourseBlock["contents"] = "kudos";
        if (isSync && highLeft > 0 && rand() < 0.3) {
          contents = "high";
          highLeft--;
        } else if (isSync && powerLeft > 0 && rand() < 0.55) {
          if (powerLeft === 2) contents = "power";
          else contents = water ? "suit" : "cape";
          powerLeft--;
        }
        layout.blocks.push({
          id: nextId++,
          x: x + i * BLOCK_SIZE,
          y: blockTop,
          kind: isSync ? "sync" : "brick",
          contents,
          used: false,
        });
      }
      addKudos(x + BLOCK_SIZE * 1.5, blockTop - 14);
      x += count * BLOCK_SIZE;
    } else if (roll < 0.85) {
      // Two ledges stepping up, with Kudos on top.
      layout.ledges.push({ x, y: groundY - 34, width: 36 });
      layout.ledges.push({ x: x + 50, y: groundY - 66, width: 36 });
      addKudos(x + 68, groundY - 80);
      addKudos(x + 18, groundY - 48);
      x += 86;
    } else {
      // A Kudos arc over open track.
      for (let i = 0; i < 5; i++) {
        const lift = Math.sin((i / 4) * Math.PI) * 30;
        addKudos(x + i * 14, groundY - 30 - lift);
      }
      x += 70;
    }
    // Breathing room between features, tighter on later stages.
    x += Math.round(200 - 70 * hard + rand() * 120);
  }
  if (theme === "basement-gym") {
    layout.ceilings = placeCeilings(layout, s, seed, groundY);
  } else if (theme === "open-water") {
    layout.currents = placeCurrents(s, seed);
  }
  if (!water) placeLandExtras(layout, s, seed, groundY, start + 450, end);
  return layout;
}

/** Edge length of a medicine ball, in px (#2024). */
export const MEDBALL_SIZE = 10;

/**
 * Adds the land-stage extras of #2024 from their own random stream, so the
 * main layout draws are untouched: on about half the stages one Sync Block
 * that held Kudos hatches a Running Buddy instead, and one or two medicine
 * balls rest on open lane between `from` and `to`.
 */
function placeLandExtras(
  layout: CourseLayout,
  stage: number,
  seed: number,
  groundY: number,
  from: number,
  to: number
): void {
  // Salted apart from the props stream in lib/garmin-props.ts.
  const rand = courseRandom(seed * 67 + stage * 130153 + 29);
  const plain = layout.blocks.filter(
    (b) => b.kind === "sync" && b.contents === "kudos"
  );
  if (plain.length > 0 && rand() < 0.5) {
    plain[Math.floor(rand() * plain.length)].contents = "buddy";
  }
  const balls: CourseMedBall[] = [];
  const count = rand() < 0.5 ? 1 : 2;
  let id = 1;
  for (let tries = 0; tries < 12 && balls.length < count; tries++) {
    const x = Math.round(from + rand() * Math.max(0, to - from - MEDBALL_SIZE));
    const clear =
      !layout.gaps.some(
        (g) => x + MEDBALL_SIZE + 30 > g.x && x - 30 < g.x + g.width
      ) &&
      !(layout.ceilings ?? []).some(
        (c) => x + MEDBALL_SIZE + 8 > c.x && x - 8 < c.x + c.width
      ) &&
      !balls.some((b) => Math.abs(b.x - x) < 120);
    if (clear) {
      balls.push({ id: stage * 100 + id++, x, y: groundY - MEDBALL_SIZE });
    }
  }
  layout.medBalls = balls;
}

/** True when world x lies over a gap in the track. */
export function isOverGap(course: CourseLayout, worldX: number): boolean {
  return course.gaps.some((g) => worldX > g.x && worldX < g.x + g.width);
}

/**
 * True when the runner's feet, spanning `left` to `right` in world x, have
 * no track under them at all. A foot still on the edge keeps them up.
 */
export function isFootingOverGap(
  course: CourseLayout,
  left: number,
  right: number
): boolean {
  return course.gaps.some((g) => left >= g.x && right <= g.x + g.width);
}

/** Drops every feature that has scrolled fully behind `cameraX`. */
export function pruneCourse(
  course: CourseLayout,
  cameraX: number
): CourseLayout {
  const behind = cameraX - 40;
  const gaps = course.gaps.filter((g) => g.x + g.width > behind);
  const ledges = course.ledges.filter((l) => l.x + l.width > behind);
  const blocks = course.blocks.filter((b) => b.x + BLOCK_SIZE > behind);
  const kudos = course.kudos.filter((k) => k.x + KUDOS_RADIUS > behind);
  const poles = course.poles.filter((p) => p.x + POLE_REACH > behind);
  const ceilings = course.ceilings?.filter((c) => c.x + c.width > behind);
  const currents = course.currents?.filter((c) => c.x + c.width > behind);
  const medBalls = course.medBalls?.filter((b) => b.x + MEDBALL_SIZE > behind);
  const medals = course.medals?.filter((m) => m.x + MEDAL_SIZE > behind);
  const checkpoints = course.checkpoints?.filter((c) => c.x + 40 > behind);
  if (
    gaps.length === course.gaps.length &&
    ledges.length === course.ledges.length &&
    blocks.length === course.blocks.length &&
    kudos.length === course.kudos.length &&
    poles.length === course.poles.length &&
    (ceilings?.length ?? 0) === (course.ceilings?.length ?? 0) &&
    (currents?.length ?? 0) === (course.currents?.length ?? 0) &&
    (medBalls?.length ?? 0) === (course.medBalls?.length ?? 0) &&
    (medals?.length ?? 0) === (course.medals?.length ?? 0) &&
    (checkpoints?.length ?? 0) === (course.checkpoints?.length ?? 0)
  ) {
    return course;
  }
  const pruned: CourseLayout = { gaps, ledges, blocks, kudos, poles };
  if (ceilings) pruned.ceilings = ceilings;
  if (currents) pruned.currents = currents;
  if (medBalls) pruned.medBalls = medBalls;
  if (medals) pruned.medals = medals;
  if (checkpoints) pruned.checkpoints = checkpoints;
  return pruned;
}

/**
 * Adds `next` onto `course`, keeping what is still live. The optional
 * ceilings, currents, medicine ball, medal and checkpoint keys are carried only when either
 * side has them.
 */
export function appendCourse(
  course: CourseLayout,
  next: CourseLayout
): CourseLayout {
  const joined: CourseLayout = {
    gaps: [...course.gaps, ...next.gaps],
    ledges: [...course.ledges, ...next.ledges],
    blocks: [...course.blocks, ...next.blocks],
    kudos: [...course.kudos, ...next.kudos],
    poles: [...course.poles, ...next.poles],
  };
  if (course.ceilings || next.ceilings) {
    joined.ceilings = [...(course.ceilings ?? []), ...(next.ceilings ?? [])];
  }
  if (course.currents || next.currents) {
    joined.currents = [...(course.currents ?? []), ...(next.currents ?? [])];
  }
  if (course.medBalls || next.medBalls) {
    joined.medBalls = [...(course.medBalls ?? []), ...(next.medBalls ?? [])];
  }
  if (course.medals || next.medals) {
    joined.medals = [...(course.medals ?? []), ...(next.medals ?? [])];
  }
  if (course.checkpoints || next.checkpoints) {
    joined.checkpoints = [
      ...(course.checkpoints ?? []),
      ...(next.checkpoints ?? []),
    ];
  }
  return joined;
}

/**
 * Bonus for grabbing the finish pole at `height` (0 bottom to 1 top): 100 at
 * the foot, 2000 near the top, in five steps. A full jump timed to peak at
 * the pole reaches the top step.
 */
export function poleBonus(height: number): number {
  const h = Number.isFinite(height) ? clamp(height, 0, 1) : 0;
  if (h >= 0.9) return 2000;
  if (h >= 0.65) return 1000;
  if (h >= 0.4) return 500;
  if (h >= 0.2) return 200;
  return 100;
}
