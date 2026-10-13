/**
 * Gym and race props on the Monkey C Mayhem course (#1992): Water Stations
 * with bonus rooms, Plyo Boxes, the Rest Day Switch, Treadmill Belts and PR
 * Boards. Positions are world pixels, like the rest of `lib/garmin-course.ts`.
 *
 * This module lays out the props and answers rules questions about them. It
 * reads the course layout and its random source from `lib/garmin-course.ts`,
 * which never imports this module, so there is no cycle. The engine in
 * `lib/garmin-engine.ts` moves the runner through both.
 */
import { clamp } from "./game-utils";
import {
  BLOCK_SIZE,
  MEDBALL_SIZE,
  STAGE_COUNT,
  courseRandom,
  stagePoleX,
  stageStartX,
} from "./garmin-course";
import type {
  CourseBlock,
  CourseKudos,
  CourseLayout,
  CourseLedge,
} from "./garmin-course";
import { BUOY_Y } from "./garmin-swim";
import { isWaterTheme, type StageTheme } from "./garmin-themes";

/**
 * A Water Station: a solid aid-station table standing on the lane. The
 * runner lands on its top and is blocked by its sides. An enterable one
 * opens a bonus room when the runner presses Down while standing on it.
 */
export interface CourseStation {
  id: number;
  x: number;
  width: number;
  /** Height of the table top above the lane, in pixels. */
  height: number;
  enterable: boolean;
  /** World x the runner comes out at after the bonus room. */
  exitX: number;
  /** Set once its bonus room has been used. */
  used?: boolean;
  /** Id of the Finisher Medal hidden in its bonus room (#2025). */
  medalId?: number;
  /** Its bonus room ends at a secret exit's pole (#2025). */
  secretExit?: boolean;
}

/** A Plyo Box: a low box on the lane that springs the runner up on landing. */
export interface CoursePlyo {
  id: number;
  x: number;
  width: number;
  /** Height of the box top above the lane, in pixels. */
  height: number;
}

/**
 * A Treadmill Belt: a platform that slides back and forth along one axis
 * over a gap, carrying a runner who stands on it.
 */
export interface CourseBelt {
  id: number;
  /** Left edge at the start of its travel. */
  x: number;
  /** Top surface at the start of its travel. */
  y: number;
  width: number;
  axis: "x" | "y";
  /** How far it travels from its start, in pixels (positive is right or down). */
  range: number;
  /** Time for one full there-and-back cycle, in ms. */
  periodMs: number;
  /** An Open Water buoy: a bobbing marker on the water, not a rig part. */
  buoy?: true;
}

/** The Rest Day Switch: a button on the lane; stomping it starts a rest day. */
export interface CourseSwitch {
  id: number;
  x: number;
  pressed: boolean;
}

/** All the props on the course, kept beside the course layout. */
export interface CourseProps {
  stations: CourseStation[];
  plyos: CoursePlyo[];
  belts: CourseBelt[];
  switches: CourseSwitch[];
}

/** No props, for idle watches and states built before #1992. */
export const EMPTY_PROPS: CourseProps = {
  stations: [],
  plyos: [],
  belts: [],
  switches: [],
};

/** Width of a Water Station table, in pixels. */
export const STATION_WIDTH = 30;
/** Width of a Plyo Box, in pixels. */
export const PLYO_WIDTH = 22;
/** Height of a Plyo Box above the lane, in pixels. */
export const PLYO_HEIGHT = 12;
/** Width of the Rest Day Switch, in pixels. */
export const SWITCH_WIDTH = 16;
/** Height of the Rest Day Switch above the lane, in pixels. */
export const SWITCH_HEIGHT = 8;
/** Width of a Treadmill Belt, in pixels. */
export const BELT_WIDTH = 30;
/** Thickness of a Treadmill Belt, in pixels. */
export const BELT_THICKNESS = 6;
/** Launch speed off a Plyo Box: a tap, and holding jump. Negative is up. */
export const PLYO_LAUNCH_VY = -11;
export const PLYO_HELD_VY = -14;
/** Width of an Open Water buoy, in pixels. */
export const BUOY_WIDTH = 30;
/** Bob distance of a buoy up and down, in pixels. */
export const BUOY_RANGE = 8;
/** Time for one full buoy bob, in ms. */
export const BUOY_PERIOD_MS = 2400;
/** Buoys per Open Water stage, at least and at most. */
const BUOY_MIN_COUNT = 2;
const BUOY_COUNT_RANGE = 3;
/** Length of a Rest Day, in ms. */
export const REST_DAY_MS = 8000;
/** Length of a Water Station bonus room, in pixels. */
export const BONUS_ROOM_LENGTH = 640;
/** Score for touching a PR Board. */
export const PR_BOARD_SCORE = 150;

/** Gap in pixels that a prop must keep from every feature around it. */
const PROP_MARGIN = 40;
/** Width of the clear spot a station's bonus room exits onto, in pixels. */
const EXIT_WIDTH = 40;
/** Shortest and longest run from a station to its exit, in pixels. */
const EXIT_MIN = 700;
const EXIT_MAX = 1100;
/** Flat run kept clear at the start of a stage and before its pole. */
const STAGE_LEAD_IN = 450;
const STAGE_TAIL = 400;
/** Shortest and longest Water Station table, in pixels. */
const STATION_MIN_HEIGHT = 18;
const STATION_HEIGHT_RANGE = 17;

/**
 * Launch speed for a Plyo Box bounce: the held speed when jump is down, else
 * the tap speed.
 */
export function plyoLaunchVy(jumpHeld: boolean): number {
  return jumpHeld ? PLYO_HELD_VY : PLYO_LAUNCH_VY;
}

/**
 * Belt offset at clockMs: a triangle wave from 0 out to `range` and back over
 * periodMs, starting at 0 when clockMs=0. Non-finite clock or periodMs <= 0 or
 * non-finite gives {dx:0, dy:0}. Axis "x" moves dx, axis "y" moves dy.
 */
export function beltOffset(
  belt: CourseBelt,
  clockMs: number
): { dx: number; dy: number } {
  const none = { dx: 0, dy: 0 };
  if (
    !Number.isFinite(clockMs) ||
    !Number.isFinite(belt.periodMs) ||
    belt.periodMs <= 0 ||
    !Number.isFinite(belt.range)
  ) {
    return none;
  }
  const period = belt.periodMs;
  const phase = (((clockMs % period) + period) % period) / period;
  const wave = phase < 0.5 ? phase * 2 : (1 - phase) * 2;
  const offset = belt.range * wave;
  return belt.axis === "x" ? { dx: offset, dy: 0 } : { dx: 0, dy: offset };
}

/** One surface the runner can stand on. left/right are world x, top is world y. */
export interface PropFooting {
  kind: "station" | "plyo" | "belt" | "switch";
  id: number;
  left: number;
  right: number;
  top: number;
}

/**
 * Every standable surface at clockMs: station tops (groundY - height), plyo
 * tops (groundY - height), belt tops at their current offset (belt.x+dx ..
 * +width, top belt.y+dy), and unpressed switch tops (groundY - SWITCH_HEIGHT,
 * width SWITCH_WIDTH). Pressed switches are omitted.
 */
export function propFootings(
  props: CourseProps,
  clockMs: number,
  groundY: number
): PropFooting[] {
  const out: PropFooting[] = [];
  for (const st of props.stations) {
    out.push({
      kind: "station",
      id: st.id,
      left: st.x,
      right: st.x + st.width,
      top: groundY - st.height,
    });
  }
  for (const p of props.plyos) {
    out.push({
      kind: "plyo",
      id: p.id,
      left: p.x,
      right: p.x + p.width,
      top: groundY - p.height,
    });
  }
  for (const belt of props.belts) {
    const { dx, dy } = beltOffset(belt, clockMs);
    const left = belt.x + dx;
    out.push({
      kind: "belt",
      id: belt.id,
      left,
      right: left + belt.width,
      top: belt.y + dy,
    });
  }
  for (const sw of props.switches) {
    if (sw.pressed) continue;
    out.push({
      kind: "switch",
      id: sw.id,
      left: sw.x,
      right: sw.x + SWITCH_WIDTH,
      top: groundY - SWITCH_HEIGHT,
    });
  }
  return out;
}

/**
 * Solid sides: stations and plyo boxes block a runner whose feet are below
 * their top. Returns the smallest box left edge x such that feetBottom > top
 * + 1 and prevRight <= x + 0.5 and nextRight > x; else null.
 */
export function wallAhead(
  props: CourseProps,
  groundY: number,
  prevRight: number,
  nextRight: number,
  feetBottom: number
): number | null {
  let best: number | null = null;
  const consider = (box: { x: number; height: number }) => {
    const top = groundY - box.height;
    if (!(feetBottom > top + 1)) return;
    if (!(prevRight <= box.x + 0.5 && nextRight > box.x)) return;
    if (best === null || box.x < best) best = box.x;
  };
  for (const st of props.stations) consider(st);
  for (const p of props.plyos) consider(p);
  return best;
}

/**
 * The enterable, unused station the runner stands on: feet overlap [x, x+width]
 * and |feetBottom - (groundY - height)| <= 1. Else null.
 */
export function stationUnderFeet(
  props: CourseProps,
  footLeft: number,
  footRight: number,
  feetBottom: number,
  groundY: number
): CourseStation | null {
  for (const st of props.stations) {
    if (!st.enterable || st.used) continue;
    if (footRight < st.x || footLeft > st.x + st.width) continue;
    if (Math.abs(feetBottom - (groundY - st.height)) > 1) continue;
    return st;
  }
  return null;
}

/** A candidate x for a prop, true when the spot is usable. */
type SpotCheck = (x: number) => boolean;

/**
 * Scans from `from` to `to` with random steps and returns the first integer x
 * that passes `ok`, or null.
 */
function findSpot(
  from: number,
  to: number,
  width: number,
  rand: () => number,
  ok: SpotCheck
): number | null {
  let x = from;
  while (x + width <= to) {
    const c = Math.round(x);
    if (c + width <= to && ok(c)) return c;
    x += 60 + rand() * 160;
  }
  return null;
}

/** Scans every 10 px from `from` to `to`, a fixed fallback that never misses a free spot. */
function findDense(
  from: number,
  to: number,
  width: number,
  ok: SpotCheck
): number | null {
  for (let x = Math.round(from); x + width <= to; x += 10) {
    if (ok(x)) return x;
  }
  return null;
}

/**
 * Lays out a stage's props, deterministic for (stage, seed). Returns the props
 * and the layout with any ledge a belt replaces removed (everything else in
 * the layout unchanged). Water stages keep no belts over gaps and gain buoys
 * on open water; every spot clears the layout's Basement Gym racks too.
 */
export function generateStageProps(
  stage: number,
  seed: number,
  groundY: number,
  layout: CourseLayout,
  theme: StageTheme = "track"
): { props: CourseProps; layout: CourseLayout } {
  const s = clamp(
    Math.floor(Number.isFinite(stage) ? stage : 1),
    1,
    STAGE_COUNT
  );
  const rand = courseRandom(seed * 53 + s * 104729);
  const lo = stageStartX(s) + STAGE_LEAD_IN;
  const hi = stagePoleX(s) - STAGE_TAIL;
  const occupied: { left: number; right: number }[] = [];
  let nextId = s * 10000 + 5000;

  // A spot is clear when no gap, ledge, block or kudos sits within the margin
  // and no prop or station exit already claims it.
  const isClear = (x: number, width: number): boolean => {
    const a = x - PROP_MARGIN;
    const b = x + width + PROP_MARGIN;
    if (layout.gaps.some((g) => g.x < b && g.x + g.width > a)) return false;
    if (layout.ledges.some((l) => l.x < b && l.x + l.width > a)) return false;
    if (layout.blocks.some((bl) => bl.x < b && bl.x + BLOCK_SIZE > a)) {
      return false;
    }
    if (layout.kudos.some((k) => k.x >= a && k.x <= b)) return false;
    if ((layout.ceilings ?? []).some((c) => c.x < b && c.x + c.width > a)) {
      return false;
    }
    return occupied.every((o) => !(o.left < b && o.right > a));
  };

  const findExit = (x: number): number | null => {
    const exitEnd = x + EXIT_MAX + EXIT_WIDTH;
    const to = exitEnd < hi ? exitEnd : hi;
    return findDense(x + EXIT_MIN, to, EXIT_WIDTH, (e) =>
      isClear(e, EXIT_WIDTH)
    );
  };

  // Tries a random scan of one segment, then the whole span, then a dense
  // scan of the whole span, so a placement only fails when the span is full.
  const place = (
    from: number,
    to: number,
    width: number,
    ok: SpotCheck
  ): number | null =>
    findSpot(from, to, width, rand, ok) ??
    findSpot(lo, hi, width, rand, ok) ??
    findDense(lo, hi, width, ok);

  const stations: CourseStation[] = [];
  const stationCount = 2 + Math.floor(rand() * 2);
  const stationSegment = (hi - lo) / stationCount;
  for (let i = 0; i < stationCount; i++) {
    const height =
      STATION_MIN_HEIGHT + Math.floor(rand() * STATION_HEIGHT_RANGE);
    const first = i === 0;
    const wantEnterable = first || rand() < 0.25;
    const from = lo + i * stationSegment;
    const to = Math.min(from + stationSegment, hi);
    const spot =
      (requireExit: boolean): SpotCheck =>
      (x) =>
        isClear(x, STATION_WIDTH) && (!requireExit || findExit(x) !== null);
    const x =
      place(from, to, STATION_WIDTH, spot(wantEnterable)) ??
      (first ? null : place(from, to, STATION_WIDTH, spot(false)));
    if (x === null) continue;
    const exit = wantEnterable ? findExit(x) : null;
    stations.push({
      id: nextId++,
      x,
      width: STATION_WIDTH,
      height,
      enterable: exit !== null,
      exitX: exit ?? x,
    });
    occupied.push({ left: x, right: x + STATION_WIDTH });
    if (exit !== null) occupied.push({ left: exit, right: exit + EXIT_WIDTH });
  }

  const plyos: CoursePlyo[] = [];
  const plyoCount = 2 + Math.floor(rand() * 2);
  const plyoSegment = (hi - lo) / plyoCount;
  for (let i = 0; i < plyoCount; i++) {
    const from = lo + i * plyoSegment;
    const to = Math.min(from + plyoSegment, hi);
    const x = place(from, to, PLYO_WIDTH, (c) => isClear(c, PLYO_WIDTH));
    if (x === null) continue;
    plyos.push({ id: nextId++, x, width: PLYO_WIDTH, height: PLYO_HEIGHT });
    occupied.push({ left: x, right: x + PLYO_WIDTH });
  }

  const switches: CourseSwitch[] = [];
  if (s >= 2) {
    const x = place(lo, hi, SWITCH_WIDTH, (c) => isClear(c, SWITCH_WIDTH));
    if (x !== null) {
      switches.push({ id: nextId++, x, pressed: false });
      occupied.push({ left: x, right: x + SWITCH_WIDTH });
    }
  }

  // Treadmill Belts replace the ledge inside up to two wide gaps. Water stages
  // keep their gaps as they are, so no belt is laid over one.
  const belts: CourseBelt[] = [];
  const removed = new Set<CourseLedge>();
  const beltGaps = isWaterTheme(theme) ? [] : layout.gaps;
  for (const gap of beltGaps) {
    if (belts.length >= 2) break;
    if (gap.width < 90) continue;
    const ledge = layout.ledges.find(
      (l) =>
        !removed.has(l) && l.x >= gap.x && l.x + l.width <= gap.x + gap.width
    );
    if (!ledge) continue;
    if (rand() >= 0.6) continue;
    removed.add(ledge);
    const flatRange = gap.width - BELT_WIDTH - 8;
    const flat: Omit<CourseBelt, "id"> = {
      x: gap.x + 4,
      y: groundY - 30,
      width: BELT_WIDTH,
      axis: "x",
      range: flatRange,
      periodMs: 2600,
    };
    const vertical = s >= 3 && rand() < 0.4;
    const belt: Omit<CourseBelt, "id"> = vertical
      ? {
          x: gap.x + (gap.width - BELT_WIDTH) / 2,
          y: groundY - 64,
          width: BELT_WIDTH,
          axis: "y",
          range: 34,
          periodMs: 3000,
        }
      : flat;
    belts.push({ id: nextId++, ...belt });
  }

  // Open Water buoys: bobbing markers spread along the stage.
  if (theme === "open-water") {
    const buoyCount = BUOY_MIN_COUNT + Math.floor(rand() * BUOY_COUNT_RANGE);
    const buoySegment = (hi - lo) / buoyCount;
    for (let i = 0; i < buoyCount; i++) {
      const from = lo + i * buoySegment;
      const to = Math.min(from + buoySegment, hi);
      const x = place(from, to, BUOY_WIDTH, (c) => isClear(c, BUOY_WIDTH));
      if (x === null) continue;
      occupied.push({ left: x, right: x + BUOY_WIDTH });
      belts.push({
        id: nextId++,
        x,
        y: BUOY_Y,
        width: BUOY_WIDTH,
        axis: "y",
        range: BUOY_RANGE,
        periodMs: BUOY_PERIOD_MS,
        buoy: true,
      });
    }
  }

  const trimmed: CourseLayout = {
    ...layout,
    ledges: layout.ledges.filter((l) => !removed.has(l)),
  };
  // Medicine balls (#2024) are placed before the props; any that a station,
  // plyo box or switch now stands on are dropped, so every ball is reachable.
  if (layout.medBalls) {
    const spans = [
      ...stations.map((p) => [p.x, p.x + p.width]),
      ...plyos.map((p) => [p.x, p.x + p.width]),
      ...switches.map((p) => [p.x, p.x + SWITCH_WIDTH]),
    ];
    trimmed.medBalls = layout.medBalls.filter(
      (m) => !spans.some(([a, b]) => m.x - 4 < b && m.x + MEDBALL_SIZE + 4 > a)
    );
  }
  return {
    props: { stations, plyos, belts, switches },
    layout: trimmed,
  };
}

/** Adds `b` onto `a`, keeping every prop. */
export function appendProps(a: CourseProps, b: CourseProps): CourseProps {
  return {
    stations: [...a.stations, ...b.stations],
    plyos: [...a.plyos, ...b.plyos],
    belts: [...a.belts, ...b.belts],
    switches: [...a.switches, ...b.switches],
  };
}

/**
 * Drops props fully behind cameraX - 40 (belts count their full travel on
 * axis x). Returns the same object when nothing was dropped.
 */
export function pruneProps(props: CourseProps, cameraX: number): CourseProps {
  const behind = cameraX - 40;
  const stations = props.stations.filter((st) => st.x + st.width > behind);
  const plyos = props.plyos.filter((p) => p.x + p.width > behind);
  const belts = props.belts.filter((belt) => {
    const travel = belt.axis === "x" ? belt.range : 0;
    return belt.x + travel + belt.width > behind;
  });
  const switches = props.switches.filter((sw) => sw.x + SWITCH_WIDTH > behind);
  if (
    stations.length === props.stations.length &&
    plyos.length === props.plyos.length &&
    belts.length === props.belts.length &&
    switches.length === props.switches.length
  ) {
    return props;
  }
  return { stations, plyos, belts, switches };
}

/** Sorts features by id, which is their creation order within a stage. */
function byId<T extends { id: number }>(a: T, b: T): number {
  return a.id - b.id;
}

/**
 * Rest Day swap. resting=true: every brick block without fromKudos (except
 * one hiding a medal) becomes a Kudos, and every Kudos without fromBrick becomes a brick. resting=false
 * reverses only the flagged ones, clearing the flags. Sync blocks, gaps,
 * ledges and poles are untouched.
 */
export function restDaySwap(
  course: CourseLayout,
  resting: boolean
): CourseLayout {
  const half = BLOCK_SIZE / 2;
  const blocks: CourseBlock[] = [];
  const kudos: CourseKudos[] = [];
  if (resting) {
    for (const b of course.blocks) {
      // A PR Board hiding a medal stays a board (#2025).
      if (b.kind === "brick" && !b.fromKudos && b.contents !== "medal") {
        kudos.push({ id: b.id, x: b.x + half, y: b.y + half, fromBrick: true });
      } else {
        blocks.push(b);
      }
    }
    for (const k of course.kudos) {
      if (!k.fromBrick) {
        blocks.push({
          id: k.id,
          x: k.x - half,
          y: k.y - half,
          kind: "brick",
          contents: "kudos",
          used: true,
          fromKudos: true,
        });
      } else {
        kudos.push(k);
      }
    }
  } else {
    for (const b of course.blocks) {
      if (b.fromKudos) {
        kudos.push({ id: b.id, x: b.x + half, y: b.y + half });
      } else {
        blocks.push(b);
      }
    }
    for (const k of course.kudos) {
      if (k.fromBrick) {
        blocks.push({
          id: k.id,
          x: k.x - half,
          y: k.y - half,
          kind: "brick",
          contents: "kudos",
          used: false,
        });
      } else {
        kudos.push(k);
      }
    }
  }
  blocks.sort(byId);
  kudos.sort(byId);
  const swapped: CourseLayout = {
    gaps: course.gaps,
    ledges: course.ledges,
    blocks,
    kudos,
    poles: course.poles,
  };
  if (course.ceilings) swapped.ceilings = course.ceilings;
  if (course.currents) swapped.currents = course.currents;
  if (course.medBalls) swapped.medBalls = course.medBalls;
  if (course.medals) swapped.medals = course.medals;
  if (course.checkpoints) swapped.checkpoints = course.checkpoints;
  return swapped;
}

/**
 * A bonus room laid out from startX: flat floor (no gaps), no poles, two rows
 * of Kudos every 30 px (34 in all, worth a little more than a stage clear),
 * and two ledges. Kudos ids start at 900000 + (seed mod
 * 1000) * 100 so they never clash with stage ids.
 */
export function generateBonusRoom(
  startX: number,
  seed: number,
  groundY: number
): CourseLayout {
  const base = Number.isFinite(seed) ? Math.floor(seed) : 0;
  const slot = ((base % 1000) + 1000) % 1000;
  let nextId = 900000 + slot * 100;
  const kudos: CourseKudos[] = [];
  const rows = [groundY - 14, groundY - 50];
  for (let x = startX + 80; x <= startX + BONUS_ROOM_LENGTH - 60; x += 30) {
    for (const y of rows) {
      kudos.push({ id: nextId++, x, y });
    }
  }
  return {
    gaps: [],
    ledges: [
      { x: startX + 200, y: groundY - 36, width: 60 },
      { x: startX + 420, y: groundY - 36, width: 60 },
    ],
    blocks: [],
    kudos,
    poles: [],
  };
}
