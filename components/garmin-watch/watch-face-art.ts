/**
 * Monkey C Mayhem watch face art (#1520).
 *
 * Draws what the round 280 x 280 Connect IQ screen shows, in the same logical
 * units as `lib/garmin-engine.ts`, from the engine state alone. The engine's
 * own `renderCanvasFrame` is untouched (it is part of the core engine and the
 * standalone bundle); the simulator draws with this module instead.
 *
 * The face is a real Garmin-style layout: a data-field ring around the edge
 * (heart rate, score and battery on top, RAM and NV flash as arcs down the
 * sides, steps and distance below the track) around a side-scrolling world
 * with a parallax skyline, a pine line, a runner sprite and pictogram
 * obstacles. Nothing on the ring is drawn over the running lane.
 *
 * Motion is only the world scrolling with the run's distance, so a paused or
 * idle watch is still. A crash, a power loss and the end of a run each draw
 * one full-screen face, with no DOM text on top of it.
 */
import { clamp, gameFont } from "@/lib/game-utils";
import { formatClock, formatPace, paceSecondsPerKm } from "@/lib/garmin-splits";
import {
  DEFAULT_GROUND_STRIP,
  type GroundStripField,
  type GroundStripLayout,
} from "@/lib/garmin-ground-strip";
import {
  BLOCK_SIZE,
  EMPTY_COURSE,
  KUDOS_RADIUS,
  MEDAL_SIZE,
  MEDBALL_SIZE,
  LEDGE_THICKNESS,
  POLE_HEIGHT,
  PX_PER_METER,
  STAGE_COUNT,
  STAGE_LENGTH_METERS,
  stagePoleX,
  stageStartX,
  type CourseCeiling,
  type CourseCheckpoint,
  type CourseCurrent,
  type CoursePole,
  type CourseLayout,
  type CourseMedBall,
} from "@/lib/garmin-course";
import { MEDALS_PER_STAGE, stageMedalSlots } from "@/lib/garmin-medals";
import {
  LENGTH_METERS,
  isWaterTheme,
  themeForStage,
  type StageTheme,
} from "@/lib/garmin-themes";
import {
  bodyBatteryFraction,
  bodyBatteryLabel,
} from "@/lib/garmin-body-battery";
import {
  AUTO_PAUSE_TEXT,
  recoveryHours,
  trainingStatus,
} from "@/lib/garmin-culture";
import { FOE_SHOT_SIZE, type Foe, type FoeShot } from "@/lib/garmin-foes";
import {
  RACE_CATEGORY_INFO,
  formatRaceTime,
  judgeRace,
  raceOutcomeOf,
  type RaceCourse,
  type RaceSetup,
} from "@/lib/garmin-race";
import { GHOST_FLAG, formatGap, type GhostSample } from "@/lib/garmin-ghost";
import type { ThrownBall } from "@/lib/garmin-medball";
import { SWIM_SURFACE_Y, isUnderwater } from "@/lib/garmin-swim";
import {
  SECOND_WIND_EVENTS,
  hillTilt,
  type SecondWind,
} from "@/lib/garmin-second-wind";
import {
  CAPE_SPIN_MS,
  CAPE_SPIN_REACH,
  PACE_SEGMENTS,
  paceSegments,
} from "@/lib/garmin-cape";
import {
  BASE_HEIGHT,
  BOLT_SIZE,
  PICKUP_SIZE,
  playerHeightFor,
  type Bolt,
  type Pickup,
} from "@/lib/garmin-powerups";
import type {
  CourseBelt,
  CoursePlyo,
  CourseProps,
  CourseStation,
  CourseSwitch,
} from "@/lib/garmin-props";
import { beltOffset } from "@/lib/garmin-props";
import {
  CANVAS_SIZE,
  DEVICE_PROFILES,
  GROUND_Y,
  PLAYER_X,
  isFitnessRun,
  type CrashReport,
  type GameEngineState,
  type Obstacle,
  type ObstacleType,
  type VariableType,
  paceMeters,
} from "@/lib/garmin-engine";

type Ctx = CanvasRenderingContext2D;

/** Centre of the round screen in logical units. */
export const FACE_CENTER = CANVAS_SIZE / 2;
/** Radius of the visible round screen. */
export const FACE_RADIUS = CANVAS_SIZE / 2 - 2;
/** Radius the RAM and flash arcs are stroked at. */
export const RING_RADIUS = 130;
/** Stroke width of the RAM and flash arcs. */
const RING_WIDTH = 5;

const DEG = Math.PI / 180;

/**
 * The RAM arc climbs the left side and the flash arc the right side, from
 * just above the running lane (165 and 15 degrees) up to beside the score.
 * Both end above the lane, whose top edge meets the rim at 150 and 30
 * degrees, so the meters never cross the track.
 */
const RAM_ARC_START_DEG = 165;
const FLASH_ARC_START_DEG = 15;
const RING_ARC_SWEEP_DEG = 90;

/** Signal colours used on the face. Identity cyan is the world's own hue. */
const FACE_COLORS = {
  identity: "#22d3ee",
  ok: "#22d3ee",
  good: "#10b981",
  warn: "#f59e0b",
  danger: "#ef4444",
  steel: "#94a3b8",
  text: "#f4f4f6",
  dim: "#a1a1aa",
  track: "rgba(148, 163, 184, 0.22)",
} as const;

/**
 * Scenery and identity per stage theme (#1993). The theme swaps only the
 * identity accent (lane edge, ledges and the runner's singlet) and the world
 * behind the lane; signal colours stay in FACE_COLORS.
 */
interface ThemePalette {
  /** Identity accent: lane edge, ledge tops and the runner's singlet. */
  accent: string;
  /** Top of the sky, or of the water column on water stages. */
  top: string;
  /** Bottom of the sky, or of the water column. */
  bottom: string;
  /** The lane surface below the ground line: track, pool floor or sea bed. */
  ground: string;
}

export const THEME_PALETTE: Record<StageTheme, ThemePalette> = {
  track: {
    accent: "#22d3ee",
    top: "#000000",
    bottom: "#032a33",
    ground: "#101215",
  },
  pool: {
    accent: "#67e8f9",
    top: "#03324a",
    bottom: "#0369a1",
    ground: "#0c4a6e",
  },
  "open-water": {
    accent: "#2dd4bf",
    top: "#021b2e",
    bottom: "#082f49",
    ground: "#041a28",
  },
  "basement-gym": {
    accent: "#fb7185",
    top: "#000000",
    bottom: "#0c0a09",
    ground: "#18181b",
  },
};

/** The theme the face draws: a bonus room always uses the track art. */
export function themeOf(
  state: Pick<GameEngineState, "stage" | "bonusRoom">
): StageTheme {
  return state.bonusRoom ? "track" : themeForStage(state.stage ?? 1);
}

/** Pool lengths swum on this stage so far, 0 to the stage's length count. */
export function lengthCount(
  state: Pick<GameEngineState, "stage" | "distanceMeters">
): number {
  const stage = state.stage ?? 1;
  const into = state.distanceMeters - stageStartX(stage) / PX_PER_METER;
  return clamp(
    Math.floor(into / LENGTH_METERS),
    0,
    STAGE_LENGTH_METERS / LENGTH_METERS
  );
}

/** Trisuit colours: a teal body with an orange hip band. */
const TRISUIT = { body: "#0284c7", band: "#f97316", tri: "#f4f4f6" } as const;

export type MeterTone = "ok" | "warn" | "danger";

/** RAM and flash read as fine, high (over 65%) or critical (over 85%). */
export function meterTone(fraction: number): MeterTone {
  if (!Number.isFinite(fraction)) return "ok";
  if (fraction > 0.85) return "danger";
  if (fraction > 0.65) return "warn";
  return "ok";
}

/** Battery reads as low under 30% and critical under 15%. */
export function batteryTone(percent: number): MeterTone {
  if (!Number.isFinite(percent)) return "ok";
  if (percent < 15) return "danger";
  if (percent < 30) return "warn";
  return "ok";
}

const TONE_COLOR: Record<MeterTone, string> = {
  ok: FACE_COLORS.ok,
  warn: FACE_COLORS.warn,
  danger: FACE_COLORS.danger,
};

/** A filled stretch of a ring arc, in radians, ready for `ctx.arc`. */
interface ArcSpan {
  from: number;
  to: number;
  anticlockwise: boolean;
}

/**
 * The filled part of the RAM (left) or flash (right) arc for a fill fraction.
 * Both fill upward from the lane end, so the left arc runs clockwise and the
 * right one anticlockwise.
 */
export function ringFillSpan(side: "ram" | "flash", fraction: number): ArcSpan {
  const f = clamp(Number.isFinite(fraction) ? fraction : 0, 0, 1);
  const sweep = RING_ARC_SWEEP_DEG * f * DEG;
  if (side === "ram") {
    const from = RAM_ARC_START_DEG * DEG;
    return { from, to: from + sweep, anticlockwise: false };
  }
  const from = FLASH_ARC_START_DEG * DEG;
  return { from, to: from - sweep, anticlockwise: true };
}

/**
 * How far a parallax layer has scrolled, in logical pixels within one tile.
 * The track scrolls 10 px per metre (as the engine's lane markers do); a
 * layer moves at `factor` times that and repeats every `period` pixels.
 */
export function parallaxOffset(
  distanceMeters: number,
  factor: number,
  period: number
): number {
  if (!(period > 0)) return 0;
  const d = Number.isFinite(distanceMeters) ? Math.max(0, distanceMeters) : 0;
  const f = Number.isFinite(factor) ? Math.max(0, factor) : 0;
  return (d * 10 * f) % period;
}

/** Limb angles in radians for the runner sprite; positive swings forward. */
interface RunnerPose {
  frontLeg: number;
  backLeg: number;
  frontArm: number;
  backArm: number;
  /** How far the body lifts off its lowest point, in logical pixels. */
  bob: number;
  airborne: boolean;
}

/** One stride every this many metres of run. */
const STRIDE_METERS = 6;

/**
 * The runner's pose for a distance. Grounded, the legs and arms swing in
 * opposition through one stride per {@link STRIDE_METERS}; in the air the
 * runner tucks. Distance only grows while a run is playing, so the runner
 * stands still when idle or paused.
 */
export function runnerPose(
  distanceMeters: number,
  isGrounded: boolean
): RunnerPose {
  if (!isGrounded) {
    return {
      frontLeg: 1.0,
      backLeg: -0.7,
      frontArm: -1.1,
      backArm: 0.9,
      bob: 0,
      airborne: true,
    };
  }
  const d = Number.isFinite(distanceMeters) ? Math.max(0, distanceMeters) : 0;
  const phase = ((d % STRIDE_METERS) / STRIDE_METERS) * Math.PI * 2;
  const swing = Math.sin(phase) * 0.75;
  return {
    frontLeg: swing,
    backLeg: -swing,
    frontArm: -swing * 0.9,
    backArm: swing * 0.9,
    bob: Math.abs(Math.sin(phase)) * 1.2,
    airborne: false,
  };
}

/**
 * The swimmer's pose for a distance: arms windmill through a freestyle stroke
 * and the legs flutter-kick behind. Used in place of the run cycle underwater.
 */
export function swimPose(distanceMeters: number): RunnerPose {
  const d = Number.isFinite(distanceMeters) ? Math.max(0, distanceMeters) : 0;
  const phase = ((d % STRIDE_METERS) / STRIDE_METERS) * Math.PI * 2;
  const kick = Math.sin(phase * 2) * 0.25;
  return {
    frontLeg: -1.2 + kick,
    backLeg: -1.2 - kick,
    frontArm: Math.sin(phase) * 1.9,
    backArm: -Math.sin(phase) * 1.9,
    bob: Math.abs(Math.sin(phase)) * 0.8,
    airborne: false,
  };
}

export type Pictogram = "bug" | "stopwatch" | "stack" | "ram-chip" | "nv-card";

/** Each obstacle draws as a pictogram instead of a labelled box. */
export const OBSTACLE_PICTOGRAMS: Record<ObstacleType, Pictogram> = {
  null_pointer: "bug",
  watchdog: "stopwatch",
  stack_overflow: "stack",
  mem_token: "ram-chip",
  flash_token: "nv-card",
};

/** The one-glyph type mark printed on a RAM chip token. */
const CHIP_MARKS: Record<VariableType, string> = {
  int: "i",
  float: "f",
  string: "s",
  array: "[]",
};

/** Steps shown on the face: about 1.35 strides per metre of run. */
export function stepsFor(distanceMeters: number): number {
  if (!Number.isFinite(distanceMeters)) return 0;
  return Math.round(Math.max(0, distanceMeters) * 1.35);
}

const GROUND_STRIP_X = [90, 140, 190];

/** Widest the run clock may draw across the top centre, between heart and battery. */
const CLOCK_MAX_WIDTH = 64;
/** Widest a lap banner's text may draw inside its pill. */
const BANNER_TEXT_MAX_WIDTH = 180;

/** `m:ss.cc` shortened to `m:ss` for a narrow ground-strip slot. */
function shortClock(ms: number): string {
  return formatClock(ms).replace(/\.\d+$/, "");
}

/**
 * The largest size at or below `px`, down to `minPx`, at which `value`
 * draws within `maxWidth`. Leaves the context's font set to that size.
 */
function fitTextPx(
  ctx: Ctx,
  value: string,
  px: number,
  maxWidth: number,
  minPx: number
): number {
  let size = px;
  ctx.font = faceFont(size);
  while (size > minPx && ctx.measureText(value).width > maxWidth) {
    size = Math.max(minPx, size - 0.5);
    ctx.font = faceFont(size);
  }
  return size;
}

/** The value and unit label a ground-strip field shows for `state`. */
function groundStripReadout(
  field: GroundStripField,
  state: GameEngineState
): [value: string, label: string] {
  const pct = (n: number | undefined) =>
    `${Math.round(clamp(Number.isFinite(n) ? (n as number) : 0, 0, 1) * 100)}`;
  switch (field) {
    case "steps":
      return [`${stepsFor(state.distanceMeters)}`, "STEPS"];
    case "distance":
      return [(Math.max(0, state.distanceMeters) / 1000).toFixed(2), "KM"];
    case "vars":
      return [`${state.variables.length}`, "VARS"];
    case "heartRate":
      return [`${Math.round(state.heartRate)}`, "BPM"];
    case "thermal":
      return [pct(state.thermalStress), "TEMP %"];
    case "fog":
      return [pct(state.fogLevel), "FOG %"];
    case "ram":
      return [`${state.allocatedRamKb.toFixed(1)}K`, "RAM"];
    case "flash":
      return [`${state.allocatedFlashKb.toFixed(1)}K`, "NV"];
    case "time":
      return [shortClock(state.runClockMs ?? 0), "TIME"];
    case "pace":
      return [
        formatPace(
          paceSecondsPerKm(state.runClockMs ?? 0, paceMeters(state))
        ).replace("/km", ""),
        "PACE",
      ];
  }
}

/** What a full-screen end face says. */
interface EndFace {
  kind: "crash" | "power" | "complete" | "status" | "race";
  headline: string;
  detail: string;
}

/** The race verdict on the report face: the time, or DNF / DNQ and why. */
function raceVerdictLine(
  race: RaceSetup,
  state: Pick<GameEngineState, "gameState"> & Partial<GameEngineState>
): string {
  const verdict = judgeRace(race.category, raceOutcomeOf(state));
  if (verdict.result === "time") {
    return formatRaceTime(state.runClockMs ?? 0);
  }
  return `${verdict.result.toUpperCase()} · ${verdict.reason}`;
}

/** The best lap and the time bonked on the race report face (#2019). */
function raceReportLine(state: GameEngineState): string {
  const laps = state.lapSplits ?? [];
  const best = laps.length > 0 ? formatRaceTime(Math.min(...laps)) : "--";
  const bonked = Math.round((state.bonkedMs ?? 0) / 1000);
  return `BEST LAP ${best} · BONKED ${bonked}s`;
}

/** The full-screen face for a run that has ended, or null while it hasn't.
 * The crash face names the real cause and where it happened.
 */
export function endFaceFor(
  state: Pick<GameEngineState, "gameState" | "battery" | "crashReport"> &
    Partial<GameEngineState>
): EndFace | null {
  // A race ends on its report: the verdict in place of the Training Status (#2019).
  if (
    state.race &&
    (state.gameState === "crashed" || state.gameState === "summary")
  ) {
    return {
      kind: "race",
      headline: "RACE REPORT",
      detail: raceVerdictLine(state.race, state),
    };
  }
  // The fitness rules end on a Training Status, like a watch after a run.
  if (isFitnessRun(state)) {
    const stage = state.stage ?? 1;
    if (state.gameState === "crashed") {
      return {
        kind: "status",
        headline: trainingStatus(stage, false).toUpperCase(),
        detail: `Training Status · Recovery ${recoveryHours(stage - 1, false)} h`,
      };
    }
    if (state.gameState === "summary") {
      return {
        kind: "complete",
        headline: "5K COMPLETE",
        detail: `${trainingStatus(stage, true)} · Recovery ${recoveryHours(stage, true)} h`,
      };
    }
    return null;
  }
  if (state.gameState === "shutdown" || state.battery <= 0) {
    return {
      kind: "power",
      headline: "POWER LOSS",
      detail: "Battery empty. NV flash kept.",
    };
  }
  if (state.gameState === "crashed") {
    const report: CrashReport | null = state.crashReport;
    return {
      kind: "crash",
      headline: (report?.errorType ?? "App Crashed").toUpperCase(),
      detail: report ? `${report.file}:${report.line}` : "Unhandled exception",
    };
  }
  if (state.gameState === "summary") {
    return {
      kind: "complete",
      headline: "5K COMPLETE",
      detail: "Activity saved",
    };
  }
  return null;
}

/** Canvas text in the page's Geist Mono, via the arcade kit's gameFont. */
function faceFont(px: number, weight: "normal" | "bold" = "bold"): string {
  return gameFont(px, weight);
}

function text(
  ctx: Ctx,
  value: string,
  x: number,
  y: number,
  px: number,
  color: string,
  align: CanvasTextAlign = "center",
  weight: "normal" | "bold" = "bold"
) {
  ctx.font = faceFont(px, weight);
  ctx.textAlign = align;
  ctx.fillStyle = color;
  ctx.fillText(value, x, y);
}

// ---------------------------------------------------------------- world

/** Far skyline: one 140 px tile of buildings as [x, width, height]. */
const SKYLINE_TILE = 140;
const SKYLINE: ReadonlyArray<readonly [number, number, number]> = [
  [0, 14, 30],
  [15, 10, 46],
  [26, 18, 26],
  [45, 8, 56],
  [54, 16, 38],
  [71, 12, 28],
  [84, 20, 50],
  [105, 10, 34],
  [116, 22, 42],
];
const SKYLINE_BASE = GROUND_Y - 4;

/** Near pine line: one 90 px tile of trees as [x, height]. */
const PINE_TILE = 90;
const PINES: ReadonlyArray<readonly [number, number]> = [
  [4, 24],
  [17, 16],
  [33, 30],
  [49, 20],
  [62, 26],
  [78, 15],
];

/** Pool lane ropes: two dashed lines of floats across the water. */
const POOL_ROPE_YS = [122, 150] as const;
/** Current chevron rows in the open water column. */
const CURRENT_ROWS = [124, 150, 176] as const;

/** Open Water current chevron colour, and the chevron's half-width in pixels. */
const CURRENT_CHEVRON = "rgba(45, 212, 191, 0.3)";
const CHEVRON_HALF = 3;
const CHEVRON_STEP = 9;

/** Pool water column and surface colours; the surface band is 35% alpha. */
const SURFACE_BAND = "rgba(56, 189, 248, 0.35)";
const ROPE_COLOR = "rgba(255, 255, 255, 0.25)";
const AIR_ABOVE_WATER = "#020617";

/** Gym ceiling: beams, joists and fluorescent strips. */
const GYM_BEAM = "#18181b";
const GYM_STRIP = "rgba(254, 249, 195, 0.5)";
const GYM_STRIP_PERIOD = 90;

function drawSky(ctx: Ctx, lit: boolean, theme: StageTheme, distance: number) {
  if (isWaterTheme(theme)) {
    // Air above the deck, then the water column from the surface down.
    ctx.fillStyle = AIR_ABOVE_WATER;
    ctx.fillRect(0, 0, CANVAS_SIZE, SWIM_SURFACE_Y);
    const palette = THEME_PALETTE[theme];
    const column = ctx.createLinearGradient(0, SWIM_SURFACE_Y, 0, GROUND_Y);
    column.addColorStop(0, palette.top);
    column.addColorStop(1, palette.bottom);
    ctx.fillStyle = column;
    ctx.fillRect(0, SWIM_SURFACE_Y, CANVAS_SIZE, GROUND_Y - SWIM_SURFACE_Y);
    ctx.fillStyle = SURFACE_BAND;
    ctx.fillRect(0, SWIM_SURFACE_Y, CANVAS_SIZE, 4);
    return;
  }
  if (theme === "basement-gym") {
    const palette = THEME_PALETTE[theme];
    const room = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    room.addColorStop(0, palette.top);
    room.addColorStop(1, palette.bottom);
    ctx.fillStyle = room;
    ctx.fillRect(0, 0, CANVAS_SIZE, GROUND_Y);
    // Ceiling beam across the top, joists hanging from it.
    ctx.fillStyle = GYM_BEAM;
    ctx.fillRect(0, 0, CANVAS_SIZE, 6);
    for (let x = 0; x < CANVAS_SIZE; x += 40) ctx.fillRect(x, 6, 3, 8);
    // Fluorescent strips that scroll past at track speed.
    ctx.fillStyle = GYM_STRIP;
    const off = parallaxOffset(distance, 1, GYM_STRIP_PERIOD);
    for (let x = -off; x < CANVAS_SIZE; x += GYM_STRIP_PERIOD) {
      ctx.fillRect(x + 10, 20, 56, 2.5);
    }
    return;
  }

  const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  sky.addColorStop(0, lit ? "#06161d" : "#000000");
  sky.addColorStop(0.6, lit ? "#0a3440" : "#011318");
  sky.addColorStop(1, lit ? "#0e4d5c" : "#032a33");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, CANVAS_SIZE, GROUND_Y);

  // A still moon, clear of the data fields and the runner's jump.
  ctx.fillStyle = "rgba(226, 232, 240, 0.85)";
  ctx.beginPath();
  ctx.arc(188, 74, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = lit ? "#08222a" : "#010d11";
  ctx.beginPath();
  ctx.arc(191, 72, 6, 0, Math.PI * 2);
  ctx.fill();
}

/** Pool lane ropes, with floats that scroll at track speed. */
function drawPoolLanes(ctx: Ctx, distance: number) {
  const off = parallaxOffset(distance, 1, 24);
  for (const y of POOL_ROPE_YS) {
    ctx.fillStyle = ROPE_COLOR;
    ctx.fillRect(0, y, CANVAS_SIZE, 1.2);
    for (let x = -off; x < CANVAS_SIZE; x += 24) {
      ctx.beginPath();
      ctx.roundRect(x, y - 1.5, 4, 4, 1.5);
      ctx.fill();
    }
  }
}

/**
 * Open Water currents: a row of chevrons across each zone, pointing with the
 * flow (right for a positive flow, left for a negative one).
 */
function drawCurrents(
  ctx: Ctx,
  currents: readonly CourseCurrent[],
  camera: number
) {
  ctx.strokeStyle = CURRENT_CHEVRON;
  ctx.lineWidth = 1.2;
  for (const zone of currents) {
    const left = zone.x - camera;
    if (left > CANVAS_SIZE || left + zone.width < 0) continue;
    const dir = zone.flow < 0 ? -1 : 1;
    for (const y of CURRENT_ROWS) {
      ctx.beginPath();
      for (
        let x = left + CHEVRON_STEP;
        x < left + zone.width;
        x += CHEVRON_STEP
      ) {
        ctx.moveTo(x - dir * CHEVRON_HALF, y - CHEVRON_HALF);
        ctx.lineTo(x, y);
        ctx.lineTo(x - dir * CHEVRON_HALF, y + CHEVRON_HALF);
      }
      ctx.stroke();
    }
  }
}

function drawSkyline(ctx: Ctx, distance: number, theme: StageTheme) {
  if (theme !== "track") return;
  const offset = parallaxOffset(distance, 0.15, SKYLINE_TILE);
  for (let tile = -offset; tile < CANVAS_SIZE; tile += SKYLINE_TILE) {
    SKYLINE.forEach(([x, w, h], i) => {
      const left = tile + x;
      if (left > CANVAS_SIZE || left + w < 0) return;
      ctx.fillStyle = "#0a252c";
      ctx.fillRect(left, SKYLINE_BASE - h, w, h);
      // A few lit windows, fixed per building so they never flicker.
      ctx.fillStyle = "rgba(34, 211, 238, 0.45)";
      for (let wy = SKYLINE_BASE - h + 4; wy < SKYLINE_BASE - 6; wy += 6) {
        for (let wx = 2; wx < w - 2; wx += 4) {
          if ((i * 7 + wx * 3 + wy) % 5 === 0) {
            ctx.fillRect(left + wx, wy, 1.5, 2);
          }
        }
      }
    });
  }
}

function drawPines(ctx: Ctx, distance: number, theme: StageTheme) {
  if (theme !== "track") return;
  const offset = parallaxOffset(distance, 0.45, PINE_TILE);
  ctx.fillStyle = "#04161a";
  for (let tile = -offset; tile < CANVAS_SIZE + PINE_TILE; tile += PINE_TILE) {
    for (const [x, h] of PINES) {
      const cx = tile + x;
      if (cx - 8 > CANVAS_SIZE || cx + 8 < 0) continue;
      const half = h * 0.32;
      ctx.beginPath();
      ctx.moveTo(cx, GROUND_Y - h);
      ctx.lineTo(cx + half, GROUND_Y);
      ctx.lineTo(cx - half, GROUND_Y);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function drawGround(
  ctx: Ctx,
  distance: number,
  course: CourseLayout,
  theme: StageTheme
) {
  const palette = THEME_PALETTE[theme];
  ctx.fillStyle = palette.ground;
  ctx.fillRect(0, GROUND_Y, CANVAS_SIZE, CANVAS_SIZE - GROUND_Y);
  // Lane edge in the theme's accent.
  ctx.fillStyle = palette.accent;
  ctx.fillRect(0, GROUND_Y, CANVAS_SIZE, 1.5);
  const scroll = parallaxOffset(distance, 1, 24);
  if (theme === "pool") {
    // Floor tiles, scrolling with the lane.
    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    for (let x = -scroll; x < CANVAS_SIZE; x += 24) {
      ctx.fillRect(x, GROUND_Y + 2, 1, CANVAS_SIZE - GROUND_Y);
    }
  } else if (theme !== "open-water") {
    // Lane dashes at track speed.
    ctx.fillStyle = "rgba(148, 163, 184, 0.35)";
    for (let x = -scroll; x < CANVAS_SIZE; x += 24) {
      ctx.fillRect(x, GROUND_Y + 5, 12, 1.5);
    }
  }
  // Gaps: the lane breaks off into a dark drop with amber hazard edges.
  const camera = distance * PX_PER_METER;
  for (const gap of course.gaps) {
    const left = gap.x - camera;
    if (left > CANVAS_SIZE || left + gap.width < 0) continue;
    const drop = ctx.createLinearGradient(0, GROUND_Y, 0, CANVAS_SIZE);
    drop.addColorStop(0, "#020304");
    drop.addColorStop(1, "#000000");
    ctx.fillStyle = drop;
    ctx.fillRect(left, GROUND_Y - 0.5, gap.width, CANVAS_SIZE - GROUND_Y + 1);
    ctx.fillStyle = FACE_COLORS.warn;
    ctx.fillRect(left - 1.5, GROUND_Y, 1.5, 9);
    ctx.fillRect(left + gap.width, GROUND_Y, 1.5, 9);
  }
}

// --------------------------------------------------------------- course

/** One-way ledges: a slim data rail with a lit top edge. */
function drawLedges(
  ctx: Ctx,
  course: CourseLayout,
  camera: number,
  accent: string
) {
  for (const l of course.ledges) {
    const left = l.x - camera;
    if (left > CANVAS_SIZE || left + l.width < 0) continue;
    ctx.fillStyle = "#1e293b";
    ctx.beginPath();
    ctx.roundRect(left, l.y, l.width, LEDGE_THICKNESS, 1.5);
    ctx.fill();
    ctx.fillStyle = accent;
    ctx.fillRect(left + 1, l.y, l.width - 2, 1.2);
    ctx.fillStyle = "rgba(34, 211, 238, 0.35)";
    for (let x = left + 4; x < left + l.width - 3; x += 6) {
      ctx.fillRect(x, l.y + 2.6, 2, 1);
    }
  }
}

/**
 * A squat-rack bar in the Basement Gym: a steel bar across the lane at the
 * ceiling's underside, two uprights running up off the top of the screen, and
 * a J-hook on each upright that holds the bar.
 */
function drawCeilingRack(ctx: Ctx, c: CourseCeiling, camera: number) {
  const left = c.x - camera;
  const w = c.width;
  if (left > CANVAS_SIZE || left + w < 0) return;
  const bottom = c.bottom;
  ctx.fillStyle = PROP_COLORS.rack;
  ctx.fillRect(left, bottom - 4, w, 4);
  ctx.fillRect(left + 1, 0, 3, bottom - 4);
  ctx.fillRect(left + w - 4, 0, 3, bottom - 4);
  ctx.strokeStyle = PROP_COLORS.rackHook;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(left + 4, bottom - 11);
  ctx.lineTo(left + 7, bottom - 11);
  ctx.lineTo(left + 7, bottom - 7);
  ctx.moveTo(left + w - 4, bottom - 11);
  ctx.lineTo(left + w - 7, bottom - 11);
  ctx.lineTo(left + w - 7, bottom - 7);
  ctx.stroke();
}

/**
 * A buoy on the open water: a dome in orange with a white stripe, on a line
 * down to the sea bed. It bobs at the run clock.
 */
function drawBuoy(ctx: Ctx, belt: CourseBelt, camera: number, clockMs: number) {
  const cx = belt.x + belt.width / 2 - camera;
  if (cx + 8 < 0 || cx - 8 > CANVAS_SIZE) return;
  // The same bob the engine stands the swimmer on.
  const y = belt.y + beltOffset(belt, clockMs).dy + 4;
  ctx.strokeStyle = ROPE_COLOR;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx, y + 4);
  ctx.lineTo(cx, GROUND_Y);
  ctx.stroke();
  ctx.fillStyle = PROP_COLORS.buoy;
  ctx.beginPath();
  ctx.roundRect(cx - 6, y - 4, 12, 8, 3);
  ctx.fill();
  ctx.fillStyle = PROP_COLORS.buoyStripe;
  ctx.fillRect(cx - 6, y - 0.75, 12, 1.5);
}

/** The two-arrow sync glyph on a Sync Block. */
function drawSyncGlyph(ctx: Ctx, cx: number, cy: number, color: string) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.arc(cx, cy, 3.6, Math.PI * 1.1, Math.PI * 1.9);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, 3.6, Math.PI * 0.1, Math.PI * 0.9);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + 3.4, cy - 3.6);
  ctx.lineTo(cx + 4.8, cy - 0.8);
  ctx.lineTo(cx + 1.8, cy - 1.4);
  ctx.closePath();
  ctx.moveTo(cx - 3.4, cy + 3.6);
  ctx.lineTo(cx - 4.8, cy + 0.8);
  ctx.lineTo(cx - 1.8, cy + 1.4);
  ctx.closePath();
  ctx.fill();
}

/** Sync Blocks (lit until bumped) and plain circuit bricks. */
function drawBlocks(ctx: Ctx, course: CourseLayout, camera: number) {
  for (const b of course.blocks) {
    const left = b.x - camera;
    if (left > CANVAS_SIZE || left + BLOCK_SIZE < 0) continue;
    if (b.kind === "brick") {
      ctx.fillStyle = "#273244";
      ctx.fillRect(left, b.y, BLOCK_SIZE, BLOCK_SIZE);
      ctx.strokeStyle = "#475569";
      ctx.lineWidth = 1;
      ctx.strokeRect(left + 0.5, b.y + 0.5, BLOCK_SIZE - 1, BLOCK_SIZE - 1);
      ctx.beginPath();
      ctx.moveTo(left + 3, b.y + 5);
      ctx.lineTo(left + 8, b.y + 5);
      ctx.lineTo(left + 8, b.y + 10);
      ctx.lineTo(left + 11, b.y + 10);
      ctx.stroke();
      // The PR plate, pinned to the top-left corner of the board.
      ctx.fillStyle = PROP_COLORS.prPlate;
      ctx.fillRect(left + 2, b.y + 2, 5, 2.5);
      continue;
    }
    const lit = !b.used;
    ctx.fillStyle = lit ? "#0e7490" : "#27272a";
    ctx.beginPath();
    ctx.roundRect(left, b.y, BLOCK_SIZE, BLOCK_SIZE, 2);
    ctx.fill();
    ctx.strokeStyle = lit ? FACE_COLORS.identity : "#52525b";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    drawSyncGlyph(
      ctx,
      left + BLOCK_SIZE / 2,
      b.y + BLOCK_SIZE / 2,
      lit ? "#f4f4f6" : "#71717a"
    );
  }
}

/** Kudos: an amber medal with a raised-hand notch. */
function drawKudos(ctx: Ctx, course: CourseLayout, camera: number) {
  for (const k of course.kudos) {
    const x = k.x - camera;
    if (x - KUDOS_RADIUS > CANVAS_SIZE || x + KUDOS_RADIUS < 0) continue;
    ctx.fillStyle = "#b45309";
    ctx.beginPath();
    ctx.arc(x, k.y, KUDOS_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = FACE_COLORS.warn;
    ctx.beginPath();
    ctx.arc(x, k.y, KUDOS_RADIUS - 1.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#78350f";
    ctx.fillRect(x - 0.9, k.y - 2.4, 1.8, 4.8);
    ctx.fillRect(x - 2.4, k.y - 0.9, 4.8, 1.8);
  }
}

// ------------------------------------------------- medals & checkpoints (#2025)

const MEDAL = {
  gold: "#f59e0b",
  rim: "#b45309",
  shine: "#fde68a",
  ribbonA: "#0e7490",
  ribbonB: "#f4f4f6",
} as const;

const AID = {
  leg: "#334155",
  table: "#a16207",
  cup: "#f4f4f6",
  pole: "#cbd5e1",
  flagDown: "#71717a",
} as const;

const SECRET_POLE = {
  mast: "#64748b",
  cap: "#2dd4bf",
  base: "#134e4a",
  flag: "#0f766e",
  stripe: "#f4f4f6",
} as const;

/**
 * A Finisher Medal in its MEDAL_SIZE box at (x, y): a gold disc with a darker
 * rim, and a short two-tone ribbon hanging out above it.
 */
function drawMedal(ctx: Ctx, x: number, y: number) {
  ctx.fillStyle = MEDAL.ribbonA;
  ctx.fillRect(x + 2.5, y, 2, 4);
  ctx.fillStyle = MEDAL.ribbonB;
  ctx.fillRect(x + 5.5, y, 2, 4);
  const cx = x + MEDAL_SIZE / 2;
  const cy = y + 6.4;
  ctx.fillStyle = MEDAL.rim;
  ctx.beginPath();
  ctx.arc(cx, cy, 3.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = MEDAL.gold;
  ctx.beginPath();
  ctx.arc(cx, cy, 2.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = MEDAL.shine;
  ctx.fillRect(cx - 1.4, cy - 1.6, 1, 1);
}

/** Finisher Medals out on the course, on the lane, a ledge or a block row. */
function drawCourseMedals(ctx: Ctx, course: CourseLayout, camera: number) {
  for (const m of course.medals ?? []) {
    const x = m.x - camera;
    if (x > CANVAS_SIZE || x + MEDAL_SIZE < 0) continue;
    drawMedal(ctx, x, m.y);
  }
}

/**
 * An Aid Station: a small table with a cup and a flag pole. Its flag hangs
 * grey until the runner has touched it, then flies green.
 */
function drawAidStation(
  ctx: Ctx,
  cp: CourseCheckpoint,
  camera: number,
  reached: boolean
) {
  const x = cp.x - camera;
  if (x > CANVAS_SIZE || x + 20 < 0) return;
  ctx.fillStyle = AID.leg;
  ctx.fillRect(x + 1, GROUND_Y - 7, 2, 7);
  ctx.fillRect(x + 13, GROUND_Y - 7, 2, 7);
  ctx.fillStyle = AID.table;
  ctx.fillRect(x, GROUND_Y - 10, 18, 3);
  ctx.fillStyle = AID.cup;
  ctx.fillRect(x + 3, GROUND_Y - 15, 4, 5);
  ctx.fillStyle = AID.pole;
  ctx.fillRect(x + 15, GROUND_Y - 26, 1, 16);
  ctx.fillStyle = reached ? FACE_COLORS.good : AID.flagDown;
  ctx.fillRect(x + 16, reached ? GROUND_Y - 26 : GROUND_Y - 19, 6, 4);
}

/** The Aid Stations on the course; the touched one is the state's checkpoint. */
function drawCheckpoints(
  ctx: Ctx,
  course: CourseLayout,
  camera: number,
  touched: CourseCheckpoint | null | undefined
) {
  for (const cp of course.checkpoints ?? []) {
    const reached = touched?.x === cp.x && touched?.stage === cp.stage;
    drawAidStation(ctx, cp, camera, reached);
  }
}

/** Finish poles: a mast with a chequered banner that drops once grabbed. */
function drawPoles(ctx: Ctx, course: CourseLayout, camera: number) {
  for (const p of course.poles) {
    const x = p.x - camera;
    if (x - 30 > CANVAS_SIZE || x + 30 < 0) continue;
    if (p.secret) {
      drawSecretPole(ctx, p, x);
      continue;
    }
    const top = GROUND_Y - POLE_HEIGHT;
    ctx.fillStyle = "#cbd5e1";
    ctx.fillRect(x - 1, top, 2, POLE_HEIGHT);
    ctx.fillStyle = FACE_COLORS.good;
    ctx.beginPath();
    ctx.arc(x, top - 2, 3, 0, Math.PI * 2);
    ctx.fill();
    // Base plinth.
    ctx.fillStyle = "#334155";
    ctx.fillRect(x - 6, GROUND_Y - 6, 12, 6);
    // Banner: rides down the pole to where it was grabbed.
    const flagY =
      p.grabbed === undefined
        ? top + 2
        : Math.min(GROUND_Y - 22, GROUND_Y - p.grabbed * POLE_HEIGHT);
    const w = 22;
    const h = 14;
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 4; c++) {
        ctx.fillStyle = (r + c) % 2 === 0 ? "#f4f4f6" : "#0d0e11";
        ctx.fillRect(
          x - 1 - w + c * (w / 4),
          flagY + r * (h / 2),
          w / 4,
          h / 2
        );
      }
    }
    text(ctx, `${p.stage}K`, x - 12, flagY + h + 8, 7, FACE_COLORS.good);
  }
}

/**
 * A secret exit's pole (#2025): a steel mast with a teal cap and a small
 * trail-marker flag on its right, so it reads apart from the finish pole.
 */
function drawSecretPole(ctx: Ctx, p: CoursePole, x: number) {
  const top = GROUND_Y - POLE_HEIGHT;
  ctx.fillStyle = SECRET_POLE.mast;
  ctx.fillRect(x - 1, top, 2, POLE_HEIGHT);
  ctx.fillStyle = SECRET_POLE.cap;
  ctx.beginPath();
  ctx.arc(x, top - 2, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = SECRET_POLE.base;
  ctx.fillRect(x - 6, GROUND_Y - 6, 12, 6);
  const flagY =
    p.grabbed === undefined
      ? top + 2
      : Math.min(GROUND_Y - 22, GROUND_Y - p.grabbed * POLE_HEIGHT);
  ctx.fillStyle = SECRET_POLE.flag;
  ctx.fillRect(x + 1, flagY, 10, 9);
  ctx.fillStyle = SECRET_POLE.stripe;
  ctx.fillRect(x + 1, flagY + 3.5, 10, 2);
  text(ctx, `${p.stage}K`, x + 12, flagY + 14, 7, SECRET_POLE.cap, "left");
}

/** A Protein Shake: a white shaker bottle with a cyan cap and a P band. */
// ---------------------------------------------------------------- props

/** Rest Day Switch footprint, and Treadmill Belt slab thickness. */
const SWITCH_WIDTH = 16;
const SWITCH_HEIGHT = 8;
const BELT_THICKNESS = 6;
/** Tread lines on a belt: spacing in pixels, and scroll speed in pixels/s. */
const TREAD_GAP = 12;
const TREAD_SPEED = 60;
/** Water Station chevron: bob height in pixels and bob period in ms. */
const CHEVRON_BOB_PX = 1.5;
const CHEVRON_BOB_MS = 600;

const PROP_COLORS = {
  tableTop: "#e2e8f0",
  tableLeg: "#64748b",
  cup: "#f8fafc",
  cupRim: "#94a3b8",
  woodMain: "#a16207",
  woodEdge: "#713f12",
  woodMark: "#fde68a",
  belt: "#1f2937",
  beltTread: "rgba(226, 232, 240, 0.5)",
  roller: "#475569",
  switchBase: "#334155",
  switchPressed: "#047857",
  prPlate: "#cbd5e1",
  rack: "#27272a",
  rackHook: "#71717a",
  buoy: "#fb923c",
  buoyStripe: "#f4f4f6",
} as const;

/** The bonus room: a warm wall, dark wainscot, lockers and a bench. */
const ROOM_COLORS = {
  ceiling: "#2e1f15",
  wall: "#4a3426",
  wainscot: "#3a2719",
  locker: "#4b5563",
  lockerEdge: "#374151",
  vent: "#1f2937",
  bench: "#8b5e3c",
} as const;

/**
 * A Treadmill Belt's travel at `clockMs`: a triangle wave from 0 out to
 * `range` and back over `periodMs`. A missing or bad period means no travel.
 */
function beltTravel(belt: CourseBelt, clockMs: number): number {
  const period = belt.periodMs;
  if (!Number.isFinite(period) || period <= 0) return 0;
  const t = Number.isFinite(clockMs) ? clockMs : 0;
  const phase = (((t % period) + period) % period) / period;
  return belt.range * (1 - Math.abs(1 - 2 * phase));
}

/** A Water Station: a folding aid table on the lane, with paper cups. */
function drawWaterStation(
  ctx: Ctx,
  station: CourseStation,
  camera: number,
  clockMs: number,
  groundY: number
) {
  const left = station.x - camera;
  const w = station.width;
  if (left + w < 0 || left > CANVAS_SIZE) return;
  const top = groundY - station.height;
  // Two legs down to the lane, then the light table top.
  ctx.fillStyle = PROP_COLORS.tableLeg;
  ctx.fillRect(left + 3, top + 3, 2, groundY - top - 3);
  ctx.fillRect(left + w - 5, top + 3, 2, groundY - top - 3);
  ctx.fillStyle = PROP_COLORS.tableTop;
  ctx.fillRect(left, top, w, 3);
  // Two or three paper cups standing on the table.
  const cups = w >= 40 ? 3 : 2;
  for (let i = 1; i <= cups; i++) {
    const cx = left + (i * w) / (cups + 1);
    ctx.fillStyle = PROP_COLORS.cup;
    ctx.beginPath();
    ctx.moveTo(cx - 2.5, top - 5);
    ctx.lineTo(cx + 2.5, top - 5);
    ctx.lineTo(cx + 1.8, top);
    ctx.lineTo(cx - 1.8, top);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PROP_COLORS.cupRim;
    ctx.fillRect(cx - 2.5, top - 5, 5, 1);
  }
  // An enterable, unused station invites a Down press with a bobbing chevron.
  if (station.enterable && !station.used) {
    const bob =
      Math.sin((clockMs / CHEVRON_BOB_MS) * Math.PI * 2) * CHEVRON_BOB_PX;
    const cx = left + w / 2;
    const y = top - 14 + bob;
    ctx.strokeStyle = FACE_COLORS.identity;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(cx - 4, y);
    ctx.lineTo(cx, y + 4);
    ctx.lineTo(cx + 4, y);
    ctx.stroke();
  }
}

/** A Plyo Box: a wooden box with darker edges and a pale plus mark. */
function drawPlyoBox(
  ctx: Ctx,
  plyo: CoursePlyo,
  camera: number,
  groundY: number
) {
  const left = plyo.x - camera;
  const w = plyo.width;
  if (left + w < 0 || left > CANVAS_SIZE) return;
  const top = groundY - plyo.height;
  const h = groundY - top;
  ctx.fillStyle = PROP_COLORS.woodMain;
  ctx.fillRect(left, top, w, h);
  ctx.fillStyle = PROP_COLORS.woodEdge;
  ctx.fillRect(left, top, w, 2);
  ctx.fillRect(left, groundY - 2, w, 2);
  ctx.fillRect(left, top, 1.5, h);
  ctx.fillRect(left + w - 1.5, top, 1.5, h);
  const cx = left + w / 2;
  const cy = top + h / 2;
  const arm = Math.min(w, h) * 0.3;
  ctx.fillStyle = PROP_COLORS.woodMark;
  ctx.fillRect(cx - arm, cy - 0.6, arm * 2, 1.2);
  ctx.fillRect(cx - 0.6, cy - arm, 1.2, arm * 2);
}

/**
 * A Treadmill Belt: a dark slab that slides on its axis, with tread lines
 * scrolling along it at the run clock and a roller at each end.
 */
function drawTreadmillBelt(
  ctx: Ctx,
  belt: CourseBelt,
  camera: number,
  clockMs: number
) {
  const travel = beltTravel(belt, clockMs);
  const left = belt.x + (belt.axis === "x" ? travel : 0) - camera;
  const top = belt.y + (belt.axis === "y" ? travel : 0);
  const w = belt.width;
  if (left + w < 0 || left > CANVAS_SIZE) return;
  ctx.fillStyle = PROP_COLORS.belt;
  ctx.fillRect(left, top, w, BELT_THICKNESS);
  const t = Number.isFinite(clockMs) ? clockMs : 0;
  const scroll = ((t * TREAD_SPEED) / 1000) % TREAD_GAP;
  ctx.fillStyle = PROP_COLORS.beltTread;
  for (let x = left + TREAD_GAP - scroll; x < left + w - 2; x += TREAD_GAP) {
    ctx.fillRect(x, top + 1.5, 1.5, BELT_THICKNESS - 3);
  }
  ctx.fillStyle = PROP_COLORS.roller;
  ctx.beginPath();
  ctx.arc(left, top + BELT_THICKNESS / 2, 3, 0, Math.PI * 2);
  ctx.arc(left + w, top + BELT_THICKNESS / 2, 3, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * The Rest Day Switch: a round button on a small base. Unpressed it stands
 * up in a calm colour; pressed it lies flat.
 */
function drawRestSwitch(
  ctx: Ctx,
  sw: CourseSwitch,
  camera: number,
  groundY: number
) {
  const left = sw.x - camera;
  if (left + SWITCH_WIDTH < 0 || left > CANVAS_SIZE) return;
  const cx = left + SWITCH_WIDTH / 2;
  const baseTop = groundY - 3;
  ctx.fillStyle = PROP_COLORS.switchBase;
  ctx.fillRect(left, baseTop, SWITCH_WIDTH, 3);
  if (sw.pressed) {
    ctx.fillStyle = PROP_COLORS.switchPressed;
    ctx.beginPath();
    ctx.roundRect(cx - 5, baseTop - 2.5, 10, 2.5, 1.2);
    ctx.fill();
    return;
  }
  ctx.fillStyle = FACE_COLORS.good;
  ctx.beginPath();
  ctx.arc(cx, baseTop - 3.5, SWITCH_HEIGHT / 2 - 0.5, 0, Math.PI * 2);
  ctx.fill();
}

/** True for a belt flagged as an open-water buoy. */
function isBuoyBelt(belt: CourseBelt): boolean {
  return (belt as { buoy?: boolean }).buoy === true;
}

/** Draws every course prop on the lane, skipping those off screen. */
function drawProps(
  ctx: Ctx,
  props: CourseProps,
  camera: number,
  clockMs: number,
  groundY: number
) {
  for (const plyo of props.plyos) drawPlyoBox(ctx, plyo, camera, groundY);
  for (const station of props.stations) {
    drawWaterStation(ctx, station, camera, clockMs, groundY);
  }
  for (const belt of props.belts) {
    // Buoy belts are open-water markers; the flag is read defensively until
    // CourseBelt carries it.
    if (isBuoyBelt(belt)) drawBuoy(ctx, belt, camera, clockMs);
    else drawTreadmillBelt(ctx, belt, camera, clockMs);
  }
  for (const sw of props.switches) drawRestSwitch(ctx, sw, camera, groundY);
}

/**
 * The bonus room behind a Water Station: a warm wall, a row of lockers, a
 * bench and a dark ceiling band. Drawn in place of the outdoor sky.
 */
function drawBonusRoomBackdrop(ctx: Ctx) {
  ctx.fillStyle = ROOM_COLORS.wall;
  ctx.fillRect(0, 0, CANVAS_SIZE, GROUND_Y);
  ctx.fillStyle = ROOM_COLORS.ceiling;
  ctx.fillRect(0, 0, CANVAS_SIZE, 10);
  ctx.fillStyle = ROOM_COLORS.wainscot;
  ctx.fillRect(0, GROUND_Y - 30, CANVAS_SIZE, 30);
  for (let i = 0; i < 7; i++) {
    const x = 4 + i * 40;
    ctx.fillStyle = ROOM_COLORS.locker;
    ctx.fillRect(x, 96, 36, GROUND_Y - 34 - 96);
    ctx.strokeStyle = ROOM_COLORS.lockerEdge;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, 96.5, 35, GROUND_Y - 34 - 97);
    ctx.fillStyle = ROOM_COLORS.vent;
    ctx.fillRect(x + 12, 112, 12, 1.5);
    ctx.fillRect(x + 12, 118, 12, 1.5);
  }
  // A bench along the lane edge.
  ctx.fillStyle = ROOM_COLORS.bench;
  ctx.fillRect(16, GROUND_Y - 26, 248, 3);
  ctx.fillRect(24, GROUND_Y - 23, 3, 23);
  ctx.fillRect(253, GROUND_Y - 23, 3, 23);
}

function drawShake(ctx: Ctx, x: number, y: number) {
  const s = PICKUP_SIZE;
  ctx.fillStyle = FACE_COLORS.identity;
  ctx.beginPath();
  ctx.roundRect(x + 3, y, s - 6, 3, 1);
  ctx.fill();
  ctx.fillStyle = "#f4f4f6";
  ctx.beginPath();
  ctx.roundRect(x + 2, y + 3, s - 4, s - 3, 2);
  ctx.fill();
  ctx.fillStyle = FACE_COLORS.good;
  ctx.fillRect(x + 2, y + 6, s - 4, 3);
}

/** A Runner's High: an amber disc with a lightning bolt. */
function drawHigh(ctx: Ctx, x: number, y: number) {
  const r = PICKUP_SIZE / 2;
  ctx.fillStyle = FACE_COLORS.warn;
  ctx.beginPath();
  ctx.arc(x + r, y + r, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#0d0e11";
  ctx.beginPath();
  ctx.moveTo(x + r + 1, y + 2);
  ctx.lineTo(x + r - 3, y + r + 1);
  ctx.lineTo(x + r, y + r + 1);
  ctx.lineTo(x + r - 1, y + PICKUP_SIZE - 2);
  ctx.lineTo(x + r + 3, y + r - 1);
  ctx.lineTo(x + r, y + r - 1);
  ctx.closePath();
  ctx.fill();
}

/** The Heat Map runner's singlet and bolt colours. */
const HEAT = { hot: "#f97316", core: "#fde68a", cool: "#22d3ee" } as const;

/** A Heat Map: a three-by-three tile of cells from cool to hot. */
function drawHeatMap(ctx: Ctx, x: number, y: number) {
  const cell = PICKUP_SIZE / 3;
  const ramp = [HEAT.cool, FACE_COLORS.good, FACE_COLORS.warn, HEAT.hot];
  ctx.fillStyle = "#0d0e11";
  ctx.fillRect(x - 0.5, y - 0.5, PICKUP_SIZE + 1, PICKUP_SIZE + 1);
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      ctx.fillStyle = ramp[Math.min(3, row + col)];
      ctx.fillRect(
        x + col * cell + 0.4,
        y + row * cell + 0.4,
        cell - 0.8,
        cell - 0.8
      );
    }
  }
}

/** A Compression Cape: an emerald vest with a trailing hem. */
function drawCape(ctx: Ctx, x: number, y: number) {
  ctx.fillStyle = FACE_COLORS.good;
  ctx.beginPath();
  ctx.moveTo(x + 3, y + 1);
  ctx.lineTo(x + PICKUP_SIZE - 3, y + 1);
  ctx.lineTo(x + PICKUP_SIZE - 1, y + PICKUP_SIZE - 1);
  ctx.lineTo(x + PICKUP_SIZE / 2, y + PICKUP_SIZE - 3);
  ctx.lineTo(x + 1, y + PICKUP_SIZE - 1);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#0d0e11";
  ctx.fillRect(x + PICKUP_SIZE / 2 - 1.5, y + 1, 3, 3);
}

/** A Tri Suit: a teal one-piece with a three-band hem and a white tri mark. */
function drawSuit(ctx: Ctx, x: number, y: number) {
  ctx.fillStyle = TRISUIT.body;
  ctx.beginPath();
  ctx.roundRect(x + 2.5, y + 1, PICKUP_SIZE - 5, PICKUP_SIZE - 3, 2);
  ctx.fill();
  ctx.fillStyle = TRISUIT.band;
  ctx.fillRect(x + 2.5, y + 7.5, PICKUP_SIZE - 5, 1.2);
  ctx.fillStyle = TRISUIT.tri;
  ctx.beginPath();
  ctx.moveTo(x + PICKUP_SIZE / 2, y + 3);
  ctx.lineTo(x + PICKUP_SIZE / 2 + 2.2, y + 6.4);
  ctx.lineTo(x + PICKUP_SIZE / 2 - 2.2, y + 6.4);
  ctx.closePath();
  ctx.fill();
}

/** The Running Buddy: a tan dog with a dark nose and a white collar. */
const BUDDY = {
  fur: "#d97706",
  dark: "#78350f",
  collar: "#f4f4f6",
  leash: "#a1a1aa",
} as const;

/** A medicine ball: a dark round weight with a light grip band across it. */
const MED_BALL = { body: "#27272a", rim: "#71717a", grip: "#d4d4d8" } as const;

/** How far a riding runner sits higher on the buddy's back, in local px. */
const RIDE_LIFT = 6;
/** Local y of the runner's feet on the lane (the box is BASE_HEIGHT tall). */
const GROUND_LOCAL_FEET = BASE_HEIGHT;
/** Local height the dog's body and legs take up under a rider. */
const BUDDY_HEIGHT = 6;
/** A runaway buddy blinks in its last this many ms. */
const BUDDY_BLINK_MS = 1000;
/** Milliseconds per blink phase while a runaway buddy blinks. */
const BUDDY_BLINK_PHASE_MS = 100;

/** A medicine ball centred on (cx, cy), radius r. */
function drawMedBall(ctx: Ctx, cx: number, cy: number, r: number) {
  ctx.fillStyle = MED_BALL.body;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = MED_BALL.rim;
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.fillStyle = MED_BALL.grip;
  ctx.fillRect(cx - r + 0.6, cy - 0.7, (r - 0.6) * 2, 1.4);
}

/**
 * The dog, facing right, drawn in local px with its back at `top` and its
 * feet about 7 px below. It stands under a rider at the lane and, scaled
 * down, is the pickup.
 */
function drawDog(ctx: Ctx, x: number, top: number) {
  ctx.fillStyle = BUDDY.fur;
  ctx.beginPath();
  ctx.roundRect(x, top, 12, 5, 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + 13.5, top - 1.2, 2.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = BUDDY.dark;
  ctx.fillRect(x + 2.5, top + 4.5, 1.6, 2.2);
  ctx.fillRect(x + 9, top + 4.5, 1.6, 2.2);
  ctx.beginPath();
  ctx.roundRect(x + 15.5, top - 1.6, 3, 2, 1);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + 17.6, top - 1.6, 0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + 15.2, top - 2.6, 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = BUDDY.collar;
  ctx.fillRect(x + 11.6, top, 1.2, 4.6);
}

/**
 * The Running Buddy as a pickup: the dog scaled to fit its 12 px box on a
 * dark tile, so it reads as a pickup like the others.
 */
function drawBuddyPickup(ctx: Ctx, x: number, y: number) {
  ctx.fillStyle = MED_BALL.body;
  ctx.beginPath();
  ctx.roundRect(x, y, PICKUP_SIZE, PICKUP_SIZE, 2.5);
  ctx.fill();
  ctx.save();
  ctx.translate(x + 0.4, y + 3.4);
  ctx.scale(0.62, 0.62);
  drawDog(ctx, 0, 2.6);
  ctx.restore();
}

/** Power-ups travelling the course, behind the blocks they rise out of. */
function drawPickups(ctx: Ctx, pickups: readonly Pickup[], camera: number) {
  for (const p of pickups) {
    const x = p.x - camera;
    if (x > CANVAS_SIZE || x + PICKUP_SIZE < 0) continue;
    if (p.kind === "high") drawHigh(ctx, x, p.y);
    else if (p.kind === "heatmap") drawHeatMap(ctx, x, p.y);
    else if (p.kind === "cape") drawCape(ctx, x, p.y);
    else if (p.kind === "suit") drawSuit(ctx, x, p.y);
    else if (p.kind === "buddy") {
      // A runaway buddy blinks in its last second, off on odd 100 ms phases.
      const ttl = p.ttlMs;
      if (
        ttl !== undefined &&
        ttl < BUDDY_BLINK_MS &&
        Math.floor(ttl / BUDDY_BLINK_PHASE_MS) % 2 === 1
      ) {
        continue;
      }
      drawBuddyPickup(ctx, x, p.y);
    } else drawShake(ctx, x, p.y);
  }
}

/** Lane medicine balls resting on the course, drawn with the lane's features. */
function drawMedBalls(
  ctx: Ctx,
  balls: readonly CourseMedBall[],
  camera: number
) {
  const r = MEDBALL_SIZE / 2;
  for (const b of balls) {
    const x = b.x - camera;
    if (x > CANVAS_SIZE || x + MEDBALL_SIZE < 0) continue;
    drawMedBall(ctx, x + r, b.y + r, r);
  }
}

/** A cape spin: an emerald swoosh around the runner while it lasts. */
function drawSpin(ctx: Ctx, state: GameEngineState) {
  const spinMs = state.spinMs ?? 0;
  if (spinMs <= 0) return;
  const h = playerHeightFor(state.power);
  const cx = PLAYER_X + 10;
  const cy = state.playerY + h / 2;
  const turn = (1 - spinMs / CAPE_SPIN_MS) * Math.PI * 2;
  ctx.strokeStyle = FACE_COLORS.good;
  ctx.globalAlpha = 0.85;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(cx, cy, 10 + CAPE_SPIN_REACH, h / 2, 0, turn, turn + Math.PI);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/** Heat bolts: an orange ball with a pale core. */
function drawBolts(ctx: Ctx, bolts: readonly Bolt[], camera: number) {
  const r = BOLT_SIZE / 2;
  for (const b of bolts) {
    const cx = b.x - camera + r;
    if (cx - r > CANVAS_SIZE || cx + r < 0) continue;
    ctx.fillStyle = HEAT.hot;
    ctx.beginPath();
    ctx.arc(cx, b.y + r, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = HEAT.core;
    ctx.beginPath();
    ctx.arc(cx - 0.6, b.y + r - 0.6, r / 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** A medicine ball in flight. */
function drawThrownBall(ctx: Ctx, ball: ThrownBall, camera: number) {
  const r = MEDBALL_SIZE / 2;
  const x = ball.x - camera;
  if (x > CANVAS_SIZE || x + MEDBALL_SIZE < 0) return;
  drawMedBall(ctx, x + r, ball.y + r, r);
}

/** Score and event labels that float up from where they happened. */
function drawPopups(ctx: Ctx, state: GameEngineState, camera: number) {
  for (const p of state.popups ?? []) {
    const alpha = clamp(p.ttlMs / 400, 0, 1);
    ctx.globalAlpha = alpha;
    text(ctx, p.text, p.x - camera + 7, p.y, 7.5, FACE_COLORS.text);
  }
  ctx.globalAlpha = 1;
}

const BANNER_TONE = {
  info: FACE_COLORS.identity,
  good: FACE_COLORS.good,
  warn: FACE_COLORS.warn,
} as const;

/** A short line across the upper face for stage starts and pickups. */
function drawBanner(ctx: Ctx, state: GameEngineState) {
  const banner = state.banner;
  if (!banner) return;
  // A lap banner carries a split and a Training Effect; shrink it to fit.
  const px = fitTextPx(ctx, banner.text, 7.5, BANNER_TEXT_MAX_WIDTH, 5);
  const w = Math.min(196, ctx.measureText(banner.text).width + 16);
  ctx.fillStyle = "rgba(0, 0, 0, 0.88)";
  ctx.beginPath();
  ctx.roundRect(FACE_CENTER - w / 2, 70, w, 13, 3);
  ctx.fill();
  text(ctx, banner.text, FACE_CENTER, 79.5, px, BANNER_TONE[banner.tone]);
}

/**
 * The top-centre readout during a run: the run clock, held at 0:00.00 until
 * GPS locks, with the score on the line beneath it.
 */
function drawRunClock(ctx: Ctx, state: GameEngineState) {
  const waitingForGps = (state.gpsMs ?? 0) > 0;
  const clock = waitingForGps
    ? formatClock(0)
    : formatClock(state.runClockMs ?? 0);
  const fitted = fitTextPx(ctx, clock, 20, CLOCK_MAX_WIDTH, 12);
  text(ctx, clock, FACE_CENTER, 44, fitted, FACE_COLORS.text);
  text(ctx, `${state.score} PTS`, FACE_CENTER, 55, 7, FACE_COLORS.dim);
}

/** Stage, lives and Kudos count, small, under the score. */
function drawCourseHud(ctx: Ctx, state: GameEngineState) {
  const stage = state.stage ?? 1;
  text(
    ctx,
    `STAGE ${stage}/${STAGE_COUNT} · LIVES ${state.lives ?? 1} · KUDOS ${state.kudos ?? 0}`,
    FACE_CENTER,
    64,
    6,
    FACE_COLORS.dim
  );
  // Water stages count pool lengths on their own line, never inside a bonus room.
  if (isUnderwater(state)) {
    text(
      ctx,
      `LENGTH ${lengthCount(state)}/${STAGE_LENGTH_METERS / LENGTH_METERS}`,
      FACE_CENTER,
      80,
      6,
      FACE_COLORS.dim
    );
  }
  drawPaceMeter(ctx, state);
  drawMedalSlots(ctx, state);
}

/**
 * Three Finisher Medal slots for the current stage, in a row above the run
 * clock (#2025): gold when found, a grey outline while still hidden. They sit
 * clear of the ring, the clock and the course line.
 */
function drawMedalSlots(ctx: Ctx, state: GameEngineState) {
  const slots = stageMedalSlots(state.medalsFound, state.stage ?? 1);
  const r = 3;
  const cy = 22;
  const gap = 9;
  slots.forEach((found, i) => {
    const cx = FACE_CENTER + (i - (MEDALS_PER_STAGE - 1) / 2) * gap;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    if (found) {
      ctx.fillStyle = MEDAL.gold;
      ctx.fill();
      ctx.strokeStyle = MEDAL.rim;
      ctx.lineWidth = 0.8;
      ctx.stroke();
    } else {
      ctx.strokeStyle = FACE_COLORS.dim;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  });
}

/**
 * The pace meter under the course line: six segments that light amber as
 * the runner sprints, and blink emerald when full.
 */
function drawPaceMeter(ctx: Ctx, state: GameEngineState) {
  const lit = paceSegments(state.paceMeter);
  const full = lit === PACE_SEGMENTS;
  const blinkOff =
    full && Math.floor(state.distanceMeters * 4) % 2 === 1 && !state.isGrounded;
  const segW = 6;
  const gap = 1.5;
  const total = PACE_SEGMENTS * segW + (PACE_SEGMENTS - 1) * gap;
  const left = FACE_CENTER - total / 2;
  for (let i = 0; i < PACE_SEGMENTS; i++) {
    ctx.fillStyle =
      i < lit && !blinkOff
        ? full
          ? FACE_COLORS.good
          : FACE_COLORS.warn
        : FACE_COLORS.track;
    ctx.fillRect(left + i * (segW + gap), 88, segW, 3);
  }
}

/** The rest-day countdown: a small pill under the course line. */
function drawRestDayBadge(ctx: Ctx, restDayMs: number) {
  const w = 72;
  const h = 11;
  const x = FACE_CENTER - w / 2;
  const y = 96;
  ctx.fillStyle = "#022c22";
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
  ctx.fill();
  ctx.strokeStyle = FACE_COLORS.good;
  ctx.lineWidth = 1;
  ctx.stroke();
  text(
    ctx,
    `REST DAY ${Math.ceil(restDayMs / 1000)}s`,
    FACE_CENTER,
    y + 7.6,
    6.5,
    FACE_COLORS.good
  );
}

// --------------------------------------------------------------- runner

const FUR = { front: "#8a4b22", back: "#5e3216", light: "#e2b48a" };
const FUR_FROZEN = { front: "#3b7183", back: "#285160", light: "#a5f3fc" };

function limb(
  ctx: Ctx,
  x: number,
  y: number,
  angle: number,
  bend: number,
  upper: number,
  lower: number
): { x: number; y: number } {
  const kx = x + upper * Math.sin(angle);
  const ky = y + upper * Math.cos(angle);
  const end = angle + bend;
  const fx = kx + lower * Math.sin(end);
  const fy = ky + lower * Math.cos(end);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(kx, ky);
  ctx.lineTo(fx, fy);
  ctx.stroke();
  return { x: fx, y: fy };
}

/**
 * The pose for the #2023 moves: a tucked body with both arms down for a
 * Burpee Slam, and one hand flat on the wall for a wall slide. Otherwise the
 * usual run or jump pose.
 */
function movePose(state: GameEngineState): RunnerPose {
  if (state.slamming) {
    return {
      frontLeg: 0.7,
      backLeg: 0.2,
      frontArm: 0.15,
      backArm: -0.2,
      bob: 0,
      airborne: true,
    };
  }
  if (state.wallSide && !state.isGrounded) {
    return {
      frontLeg: 1.2,
      backLeg: 0.5,
      frontArm: 1.45,
      backArm: 0.4,
      bob: 0,
      airborne: true,
    };
  }
  return runnerPose(state.distanceMeters, state.isGrounded);
}

/**
 * The monkey runner, facing right, drawn in a 20 x 24 box and scaled up
 * from the feet to fill the engine's player box when Buff: a headband, a
 * cyan race singlet with bib, and a watch on the wrist.
 */
function drawRunner(
  ctx: Ctx,
  state: GameEngineState,
  swimming = isUnderwater(state)
) {
  // Underwater the monkey swims: a stroke in place of the run cycle.
  const pose = swimming ? swimPose(state.distanceMeters) : movePose(state);
  const fur = state.isGcActive ? FUR_FROZEN : FUR;
  // After a hit the runner blinks while hits pass through.
  const graceMs = state.invulnerableMs ?? 0;
  if (graceMs > 0 && Math.floor(graceMs / 100) % 2 === 0) return;
  const boxH = playerHeightFor(state.power);
  const scale = boxH / BASE_HEIGHT;
  ctx.save();
  ctx.translate(PLAYER_X + 10, state.playerY + boxH - pose.bob);
  ctx.scale(scale, scale);
  ctx.translate(-10, -BASE_HEIGHT);
  const highMs = state.starMs ?? 0;
  if (highMs > 0 && (highMs > 1500 || Math.floor(highMs / 120) % 2 === 0)) {
    // Runner's High: a pulsing amber and emerald aura.
    ctx.strokeStyle =
      Math.floor(highMs / 150) % 2 === 0 ? FACE_COLORS.warn : FACE_COLORS.good;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(10, 12 + pose.bob, 13, 15, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Contact shadow on the lane, smaller the higher the jump.
  const lift = clamp(GROUND_Y - (state.playerY + boxH), 0, 90) / scale;
  ctx.save();
  ctx.translate(0, pose.bob);
  ctx.fillStyle = `rgba(0, 0, 0, ${0.45 - lift / 300})`;
  ctx.beginPath();
  ctx.ellipse(10, 24 + lift, 8 - lift / 20, 1.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Burpee Slam: short speed lines above the head.
  if (state.slamming) {
    ctx.strokeStyle = FACE_COLORS.warn;
    ctx.lineWidth = 1;
    ctx.lineCap = "round";
    for (const x of [5, 10, 15]) {
      ctx.beginPath();
      ctx.moveTo(x, -8);
      ctx.lineTo(x, -4);
      ctx.stroke();
    }
  }

  // Running Buddy (#2024): the buddy trots on the lane under the runner, who
  // sits RIDE_LIFT higher on its back inside the same box. The leash runs
  // from the front hand to the buddy's collar (drawn after the arms).
  const riding = state.riding === true;
  if (riding) drawDog(ctx, 1, GROUND_LOCAL_FEET - BUDDY_HEIGHT);
  ctx.save();
  if (riding) ctx.translate(0, -RIDE_LIFT);

  // Spin Jump: the whole sprite turns about its centre, a time-based angle
  // (about a turn and a half a second), and the shadow stays flat.
  ctx.save();
  if (state.spinJump) {
    ctx.translate(10, 12);
    ctx.rotate(((state.runClockMs ?? 0) / 1000) * Math.PI * 3);
    ctx.translate(-10, -12);
  }

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Compression Cape: an emerald hem streaming behind the shoulders.
  if (state.power === "cape") {
    const flutter = Math.sin(state.distanceMeters * 3) * 1.2;
    ctx.fillStyle = FACE_COLORS.good;
    ctx.beginPath();
    ctx.moveTo(10.5, 8);
    ctx.lineTo(1, 11 + flutter);
    ctx.lineTo(2.5, 14 + flutter);
    ctx.lineTo(8, 14);
    ctx.closePath();
    ctx.fill();
  }

  // Tail, curling up behind.
  ctx.strokeStyle = fur.back;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(7.5, 14);
  ctx.quadraticCurveTo(0.5, 16, 1.5, 9.5);
  ctx.quadraticCurveTo(2.2, 7.4, 3.8, 8.6);
  ctx.stroke();

  const hip = { x: 9.5, y: 13.5 };
  const shoulder = { x: 11, y: 9.5 };
  const legBend = (a: number) => (a < 0 ? -0.95 : -0.3);

  // Far limbs first, in the darker fur.
  ctx.strokeStyle = fur.back;
  ctx.lineWidth = 2.6;
  const backFoot = limb(
    ctx,
    hip.x,
    hip.y,
    pose.backLeg,
    legBend(pose.backLeg),
    5.4,
    5.4
  );
  ctx.lineWidth = 2;
  limb(ctx, shoulder.x, shoulder.y, pose.backArm, 1.3, 3.8, 3.4);

  // Torso: singlet in the stage's accent with a white race bib; orange once
  // the runner holds a Heat Map, teal with an orange band in a Tri Suit.
  const trisuit = state.power === "trisuit";
  ctx.fillStyle = state.isGcActive
    ? "#a5f3fc"
    : state.power === "heatmap"
      ? HEAT.hot
      : trisuit
        ? TRISUIT.body
        : THEME_PALETTE[themeOf(state)].accent;
  ctx.beginPath();
  ctx.roundRect(7.2, 7.6, 7, 7.6, 2);
  ctx.fill();
  if (trisuit) {
    ctx.fillStyle = TRISUIT.band;
    ctx.fillRect(7.2, 13.2, 7, 1.4);
  }
  ctx.fillStyle = "#f4f4f6";
  ctx.fillRect(8.4, 9.8, 4.2, 3.2);
  ctx.fillStyle = "#0d0e11";
  ctx.fillRect(9.1, 11, 2.8, 0.7);

  // Near limbs, then shoes.
  ctx.strokeStyle = fur.front;
  ctx.lineWidth = 2.6;
  const frontFoot = limb(
    ctx,
    hip.x,
    hip.y,
    pose.frontLeg,
    legBend(pose.frontLeg),
    5.4,
    5.4
  );
  ctx.lineWidth = 2;
  const hand = limb(ctx, shoulder.x, shoulder.y, pose.frontArm, 1.3, 3.8, 3.4);
  ctx.fillStyle = "#e5e7eb";
  for (const foot of [backFoot, frontFoot]) {
    ctx.beginPath();
    ctx.roundRect(foot.x - 1.2, foot.y - 1.1, 4.2, 2.2, 1);
    ctx.fill();
  }
  // A carried medicine ball sits in the front hand, under the watch.
  if (state.carrying) drawMedBall(ctx, hand.x + 1, hand.y - 0.6, 4);
  if (riding) {
    ctx.strokeStyle = BUDDY.leash;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(hand.x, hand.y);
    // The collar is on the lane at y 18.5; this path is drawn lifted.
    ctx.lineTo(13, GROUND_LOCAL_FEET - BUDDY_HEIGHT + 0.5 - RIDE_LIFT);
    ctx.stroke();
  }
  // The watch on the wrist.
  ctx.fillStyle = FACE_COLORS.identity;
  ctx.beginPath();
  ctx.arc(hand.x, hand.y, 1, 0, Math.PI * 2);
  ctx.fill();

  // Head: fur, ear, muzzle, eye and the developer headband.
  ctx.fillStyle = fur.front;
  ctx.beginPath();
  ctx.arc(13, 4.8, 4.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = fur.light;
  ctx.beginPath();
  ctx.arc(10.2, 4.6, 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(16.2, 6.2, 2.6, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#0d0e11";
  ctx.beginPath();
  ctx.arc(15.3, 3.9, 0.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = FACE_COLORS.danger;
  ctx.fillRect(8.6, 1.3, 8.8, 1.6);
  ctx.strokeStyle = FACE_COLORS.danger;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(8.8, 2.1);
  ctx.lineTo(5.6, 3.6);
  ctx.moveTo(8.8, 2.1);
  ctx.lineTo(6, 0.6);
  ctx.stroke();

  ctx.restore();
  ctx.restore();
  ctx.restore();
}

// ----------------------------------------------------------- obstacles

function groundShadow(ctx: Ctx, w: number, h: number) {
  ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
  ctx.beginPath();
  ctx.ellipse(w / 2, h, w / 2, 1.6, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Null pointer: a red beetle with a null sign on its shell. */
function drawBug(ctx: Ctx, w: number, h: number) {
  groundShadow(ctx, w, h);
  const cx = w / 2;
  const cy = h - 7;
  ctx.strokeStyle = "#7f1d1d";
  ctx.lineWidth = 1.2;
  ctx.lineCap = "round";
  ctx.beginPath();
  for (const dy of [-3, 0, 3]) {
    ctx.moveTo(cx - 5, cy + dy);
    ctx.lineTo(cx - 8, cy + dy + 2.5);
    ctx.moveTo(cx + 5, cy + dy);
    ctx.lineTo(cx + 8, cy + dy + 2.5);
  }
  // Antennae.
  ctx.moveTo(cx - 1.5, cy - 9);
  ctx.lineTo(cx - 4.5, cy - 13);
  ctx.moveTo(cx + 1.5, cy - 9);
  ctx.lineTo(cx + 4.5, cy - 13);
  ctx.stroke();
  ctx.fillStyle = "#7f1d1d";
  ctx.beginPath();
  ctx.arc(cx, cy - 7.5, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = FACE_COLORS.danger;
  ctx.beginPath();
  ctx.ellipse(cx, cy, w / 2 - 2, 6.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // The null sign.
  ctx.strokeStyle = "#f4f4f6";
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.arc(cx, cy, 2.6, 0, Math.PI * 2);
  ctx.moveTo(cx - 3.4, cy + 3.4);
  ctx.lineTo(cx + 3.4, cy - 3.4);
  ctx.stroke();
}

/** Watchdog: a stopwatch with floppy dog ears. */
function drawStopwatch(ctx: Ctx, w: number, h: number) {
  groundShadow(ctx, w, h);
  const cx = w / 2;
  const cy = h - 10.5;
  const r = 9;
  ctx.fillStyle = "#b45309";
  ctx.beginPath();
  ctx.moveTo(cx - 7, cy - 6);
  ctx.lineTo(cx - 10.5, cy - 1);
  ctx.lineTo(cx - 4, cy - 8.5);
  ctx.closePath();
  ctx.moveTo(cx + 7, cy - 6);
  ctx.lineTo(cx + 10.5, cy - 1);
  ctx.lineTo(cx + 4, cy - 8.5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = FACE_COLORS.warn;
  ctx.fillRect(cx - 2, cy - r - 4, 4, 3);
  ctx.fillStyle = "#18181b";
  ctx.strokeStyle = FACE_COLORS.warn;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = "#f4f4f6";
  ctx.lineWidth = 1.2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + 3.5, cy - 4.5);
  ctx.stroke();
  ctx.fillStyle = FACE_COLORS.warn;
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    ctx.fillRect(
      cx + Math.cos(a) * 6.2 - 0.6,
      cy + Math.sin(a) * 6.2 - 0.6,
      1.2,
      1.2
    );
  }
}

/** Stack overflow: three call frames toppling, one spilling over the top. */
function drawStack(ctx: Ctx, w: number, h: number) {
  groundShadow(ctx, w, h);
  ctx.fillStyle = "#7f1d1d";
  ctx.strokeStyle = FACE_COLORS.danger;
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 3; i++) {
    const y = h - 6 * (i + 1);
    ctx.beginPath();
    ctx.roundRect(1 + i * 1.6, y, w - 5, 5, 1.2);
    ctx.fill();
    ctx.stroke();
  }
  // Spikes along the top frame: this one can't be stomped.
  ctx.fillStyle = "#fca5a5";
  ctx.beginPath();
  const topY = h - 18;
  for (let x = 3.6; x < w - 2; x += 3.6) {
    ctx.moveTo(x - 1.8, topY);
    ctx.lineTo(x, topY - 4.5);
    ctx.lineTo(x + 1.8, topY);
  }
  ctx.closePath();
  ctx.fill();
}

/** Memory token: an amber RAM chip marked with its variable type. */
function drawRamChip(ctx: Ctx, w: number, h: number, payload?: VariableType) {
  ctx.strokeStyle = "#78350f";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const p of [4.5, 7, 9.5]) {
    ctx.moveTo(0.5, p);
    ctx.lineTo(2.5, p);
    ctx.moveTo(w - 2.5, p);
    ctx.lineTo(w - 0.5, p);
  }
  ctx.stroke();
  ctx.fillStyle = FACE_COLORS.warn;
  ctx.beginPath();
  ctx.roundRect(2.5, 1.5, w - 5, h - 3, 1.5);
  ctx.fill();
  if (payload) {
    text(ctx, CHIP_MARKS[payload], w / 2, h / 2 + 2.2, 6, "#0d0e11");
  }
}

/** Flash token: a steel NV storage card. */
function drawNvCard(ctx: Ctx, w: number, h: number) {
  ctx.fillStyle = FACE_COLORS.steel;
  ctx.beginPath();
  ctx.moveTo(2, 1);
  ctx.lineTo(w - 5, 1);
  ctx.lineTo(w - 2, 4);
  ctx.lineTo(w - 2, h - 1);
  ctx.lineTo(2, h - 1);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#334155";
  for (let x = 3.5; x < w - 5; x += 2.2) {
    ctx.fillRect(x, 2.5, 1.2, 3);
  }
  text(ctx, "NV", w / 2, h - 2.6, 4.5, "#0d0e11");
}

/** A Couch Potato: a lumpy potato slumped on a cushion, remote in hand. */
function drawCouchPotato(ctx: Ctx, w: number, h: number) {
  groundShadow(ctx, w, h);
  const cx = w / 2;
  // Cushion.
  ctx.fillStyle = "#475569";
  ctx.beginPath();
  ctx.roundRect(1, h - 5, w - 2, 5, 1.5);
  ctx.fill();
  // Potato body.
  ctx.fillStyle = "#b7895a";
  ctx.beginPath();
  ctx.ellipse(cx, h - 10, w / 2 - 3, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  // Eyes and spots.
  ctx.fillStyle = "#0d0e11";
  ctx.fillRect(cx - 4, h - 13, 2, 1.5);
  ctx.fillRect(cx + 2, h - 13, 2, 1.5);
  ctx.fillStyle = "#8a6440";
  ctx.fillRect(cx - 6, h - 8, 1.5, 1.5);
  ctx.fillRect(cx + 4, h - 7, 1.5, 1.5);
  // The remote.
  ctx.fillStyle = "#18181b";
  ctx.fillRect(w - 6, h - 12, 3, 6);
  ctx.fillStyle = FACE_COLORS.danger;
  ctx.fillRect(w - 5.5, h - 11.5, 2, 1);
}

/** A Snooze Button: a round alarm clock with a big amber Z button on top. */
function drawSnoozeButton(ctx: Ctx, w: number, h: number) {
  groundShadow(ctx, w, h);
  const cx = w / 2;
  const cy = h - 9.5;
  const r = 8;
  // Feet.
  ctx.fillStyle = "#64748b";
  ctx.fillRect(cx - 6, h - 2.5, 3, 2.5);
  ctx.fillRect(cx + 3, h - 2.5, 3, 2.5);
  // Snooze bar.
  ctx.fillStyle = FACE_COLORS.warn;
  ctx.beginPath();
  ctx.roundRect(cx - 6, cy - r - 4, 12, 3.5, 1.5);
  ctx.fill();
  // Clock face.
  ctx.fillStyle = "#18181b";
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Zz.
  text(ctx, "Z", cx, cy + 3, 8, FACE_COLORS.warn);
}

/** A Hurdle: a striped track hurdle on two legs. Spiked to the touch. */
function drawHurdle(ctx: Ctx, w: number, h: number) {
  groundShadow(ctx, w, h);
  const top = h - 17;
  // Legs and feet.
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(3, top);
  ctx.lineTo(3, h);
  ctx.moveTo(w - 3, top);
  ctx.lineTo(w - 3, h);
  ctx.moveTo(0, h - 0.8);
  ctx.lineTo(6, h - 0.8);
  ctx.moveTo(w - 6, h - 0.8);
  ctx.lineTo(w, h - 0.8);
  ctx.stroke();
  // The striped bar.
  ctx.fillStyle = "#f4f4f6";
  ctx.fillRect(1, top, w - 2, 4);
  ctx.fillStyle = FACE_COLORS.danger;
  for (let x = 1; x < w - 2; x += 6) {
    ctx.fillRect(x, top, 3, 4);
  }
  // Spikes along the top: it can't be stomped.
  ctx.fillStyle = "#fca5a5";
  ctx.beginPath();
  for (let x = 3.6; x < w - 2; x += 3.6) {
    ctx.moveTo(x - 1.8, top);
    ctx.lineTo(x, top - 4);
    ctx.lineTo(x + 1.8, top);
  }
  ctx.closePath();
  ctx.fill();
}

/** Fitness runs draw the legacy obstacles as gym and couch foes. */
const FITNESS_OBSTACLE_ART: Partial<
  Record<Obstacle["type"], (ctx: Ctx, w: number, h: number) => void>
> = {
  null_pointer: drawCouchPotato,
  watchdog: drawSnoozeButton,
  stack_overflow: drawHurdle,
};

function drawObstacle(ctx: Ctx, obs: Obstacle, fitness = false) {
  ctx.save();
  ctx.translate(obs.x, obs.y);
  const fitnessArt = fitness ? FITNESS_OBSTACLE_ART[obs.type] : undefined;
  if (fitnessArt) {
    fitnessArt(ctx, obs.width, obs.height);
    ctx.restore();
    return;
  }
  switch (OBSTACLE_PICTOGRAMS[obs.type]) {
    case "bug":
      drawBug(ctx, obs.width, obs.height);
      break;
    case "stopwatch":
      drawStopwatch(ctx, obs.width, obs.height);
      break;
    case "stack":
      drawStack(ctx, obs.width, obs.height);
      break;
    case "ram-chip":
      drawRamChip(ctx, obs.width, obs.height, obs.variablePayload);
      break;
    default:
      drawNvCard(ctx, obs.width, obs.height);
  }
  ctx.restore();
}

// ------------------------------------------------------------ course foes

const FOE_COLORS = {
  steel: "#94a3b8",
  dark: "#0d0e11",
  amber: "#f59e0b",
  coral: "#fb7185",
  sky: "#38bdf8",
  emerald: "#10b981",
  iron: "#64748b",
  skin: "#d6a77a",
} as const;

/** A Kettlebell: an iron bell with a handle, waddling on stubby feet, or tipped on its side. */
function drawKettlebell(ctx: Ctx, foe: Foe) {
  const { width: w, height: h } = foe;
  if (foe.mode === "walk") {
    // Handle.
    ctx.strokeStyle = FOE_COLORS.steel;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.36, w * 0.26, Math.PI, 0);
    ctx.stroke();
    // Bell.
    ctx.fillStyle = FOE_COLORS.iron;
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.64, w * 0.42, 0, Math.PI * 2);
    ctx.fill();
    // Weight plate on the front.
    ctx.fillStyle = FOE_COLORS.amber;
    ctx.fillRect(w / 2 - 3, h * 0.56, 6, 4);
    ctx.fillStyle = FOE_COLORS.dark;
    ctx.fillRect(3, h - 2, 4, 2);
    ctx.fillRect(w - 7, h - 2, 4, 2);
    return;
  }
  // Tipped over: the bell on its side with the handle pointing back.
  const ahead = foe.mode === "kicked" && foe.vx < 0 ? -1 : 1;
  ctx.fillStyle = FOE_COLORS.iron;
  ctx.beginPath();
  ctx.ellipse(w / 2, h / 2, w / 2 - 1, h / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = FOE_COLORS.steel;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(
    w / 2 - ahead * (w / 2 - 1),
    h / 2,
    h * 0.35,
    Math.PI / 2,
    -Math.PI / 2,
    ahead > 0
  );
  ctx.stroke();
  ctx.fillStyle = FOE_COLORS.amber;
  ctx.fillRect(w / 2 - 2, h / 2 - 2, 4, 4);
  if (foe.mode === "kicked") {
    // Speed lines behind a sliding kettlebell.
    ctx.strokeStyle = FOE_COLORS.steel;
    ctx.lineWidth = 1;
    const back = foe.vx > 0 ? -3 : w + 3;
    const dir = foe.vx > 0 ? -1 : 1;
    for (const y of [h * 0.3, h * 0.7]) {
      ctx.beginPath();
      ctx.moveTo(back, y);
      ctx.lineTo(back + dir * 5, y);
      ctx.stroke();
    }
  }
}

/** A Move Alert: the watch's buzzing "move" nag, a bubble with a bang, on buzzing wings. */
function drawMoveAlert(ctx: Ctx, foe: Foe) {
  const { width: w, height: h } = foe;
  if (foe.mode === "fly") {
    ctx.strokeStyle = FOE_COLORS.steel;
    ctx.lineWidth = 1.4;
    const flap = Math.sin((foe.phase ?? 0) * 6) * 1.5;
    ctx.beginPath();
    ctx.moveTo(-2, 1 + flap);
    ctx.lineTo(w * 0.35, 3);
    ctx.moveTo(w + 2, 1 - flap);
    ctx.lineTo(w * 0.65, 3);
    ctx.stroke();
  }
  ctx.fillStyle = FOE_COLORS.sky;
  ctx.beginPath();
  ctx.roundRect(1, 2, w - 2, h - 4, 3);
  ctx.fill();
  // Bubble tail.
  ctx.beginPath();
  ctx.moveTo(w * 0.3, h - 2.5);
  ctx.lineTo(w * 0.22, h);
  ctx.lineTo(w * 0.48, h - 2.5);
  ctx.fill();
  // The bang.
  ctx.fillStyle = FOE_COLORS.dark;
  ctx.fillRect(w / 2 - 0.9, 3.5, 1.8, h * 0.38);
  ctx.fillRect(w / 2 - 0.9, h - 5.5, 1.8, 1.6);
}

/** A Box Jumper: a plyo box on a spring, springing toward the runner. */
function drawBoxJumper(ctx: Ctx, foe: Foe) {
  const { width: w, height: h } = foe;
  ctx.fillStyle = FOE_COLORS.coral;
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h - 3, 2);
  ctx.fill();
  // Plywood edges and a hand hole.
  ctx.strokeStyle = FOE_COLORS.dark;
  ctx.lineWidth = 1;
  ctx.strokeRect(1.5, 1.5, w - 3, h - 6);
  ctx.fillStyle = FOE_COLORS.dark;
  ctx.beginPath();
  ctx.roundRect(w * 0.3, h * 0.25, w * 0.4, 2.5, 1.2);
  ctx.fill();
  // Spring.
  ctx.strokeStyle = FOE_COLORS.steel;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(w * 0.3, h - 3);
  ctx.lineTo(w * 0.5, h - 1.5);
  ctx.lineTo(w * 0.7, h - 3);
  ctx.lineTo(w * 0.5, h);
  ctx.stroke();
}

/** An Auto Lap: a lap timer face on a squat base. */
function drawAutoLap(ctx: Ctx, foe: Foe) {
  const { width: w, height: h } = foe;
  ctx.fillStyle = FOE_COLORS.iron;
  ctx.fillRect(1, h - 5, w - 2, 5);
  ctx.fillStyle = FOE_COLORS.steel;
  ctx.beginPath();
  ctx.arc(w / 2, h * 0.4, w * 0.42, 0, Math.PI * 2);
  ctx.fill();
  // Stopwatch crown.
  ctx.fillRect(w / 2 - 1.5, -1.5, 3, 2);
  ctx.strokeStyle = FOE_COLORS.dark;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(w / 2, h * 0.4);
  ctx.lineTo(w / 2, h * 0.4 - w * 0.3);
  ctx.moveTo(w / 2, h * 0.4);
  ctx.lineTo(w / 2 + w * 0.22, h * 0.4);
  ctx.stroke();
}

/** The Rep Max: a gym bro in a headband, pressing a dumbbell, with hit pips. */
function drawRepMax(ctx: Ctx, foe: Foe) {
  const { width: w, height: h } = foe;
  if (foe.graceMs > 0 && Math.floor(foe.graceMs / 80) % 2 === 0) return;
  // Dumbbell pressed overhead.
  ctx.fillStyle = FOE_COLORS.steel;
  ctx.fillRect(1, 0, w - 2, 2);
  ctx.fillStyle = FOE_COLORS.iron;
  ctx.fillRect(0, -2, 4, 6);
  ctx.fillRect(w - 4, -2, 4, 6);
  // Arms.
  ctx.fillStyle = FOE_COLORS.skin;
  ctx.fillRect(3, 2, 3, 9);
  ctx.fillRect(w - 6, 2, 3, 9);
  // Head and headband.
  ctx.beginPath();
  ctx.arc(w / 2, 8, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = FOE_COLORS.amber;
  ctx.fillRect(w / 2 - 4, 6, 8, 1.6);
  // Tank top, wide at the shoulders.
  ctx.fillStyle = FOE_COLORS.coral;
  ctx.beginPath();
  ctx.moveTo(2, 12);
  ctx.lineTo(w - 2, 12);
  ctx.lineTo(w - 6, h - 9);
  ctx.lineTo(6, h - 9);
  ctx.closePath();
  ctx.fill();
  // Shorts and legs.
  ctx.fillStyle = FOE_COLORS.iron;
  ctx.fillRect(6, h - 9, w - 12, 4);
  ctx.fillStyle = FOE_COLORS.skin;
  ctx.fillRect(7, h - 5, 3, 5);
  ctx.fillRect(w - 10, h - 5, 3, 5);
  // Hit pips: one per two hit points left.
  ctx.fillStyle = FOE_COLORS.coral;
  const pips = Math.ceil(foe.hp / 2);
  for (let i = 0; i < pips; i++) {
    ctx.fillRect(w / 2 - 6 + i * 4.5, -7, 3, 2.5);
  }
}

/**
 * A Jellyfish: a pale bell with trailing tentacles that pulse as it drifts.
 * It floats in the water, so stomping it does nothing.
 */
function drawJellyfish(ctx: Ctx, foe: Foe) {
  const { width: w, height: h } = foe;
  const pulse = Math.sin((foe.phase ?? 0) * 2) * 1.2;
  ctx.fillStyle = "rgba(224, 242, 254, 0.85)";
  ctx.beginPath();
  ctx.moveTo(0, h * 0.6);
  ctx.bezierCurveTo(0, -1 - pulse, w, -1 - pulse, w, h * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = FOE_COLORS.sky;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.strokeStyle = "rgba(224, 242, 254, 0.6)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const tx of [w * 0.2, w * 0.5, w * 0.8]) {
    ctx.moveTo(tx, h * 0.6);
    ctx.quadraticCurveTo(tx + pulse, h * 0.8, tx - pulse, h + 3);
  }
  ctx.stroke();
}

/**
 * Lost Goggles: two dark-rimmed lenses on a strap, drifting in pairs. They
 * sink and rise in the water column.
 */
function drawGoggles(ctx: Ctx, foe: Foe) {
  const { width: w, height: h } = foe;
  ctx.strokeStyle = FOE_COLORS.steel;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, h / 2);
  ctx.lineTo(w, h / 2);
  ctx.stroke();
  ctx.strokeStyle = FOE_COLORS.dark;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(w * 0.3 + 3.2, h / 2);
  ctx.lineTo(w * 0.7 - 3.2, h / 2);
  ctx.stroke();
  for (const lx of [w * 0.3, w * 0.7]) {
    ctx.fillStyle = "rgba(56, 189, 248, 0.55)";
    ctx.beginPath();
    ctx.arc(lx, h / 2, 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

/**
 * A Fun Run spectator (#2026) in the foe's box: a small cheering fan with both
 * arms up and a foam hand on the right one. Original art, no sign or logo.
 */
function drawSpectator(ctx: Ctx, foe: Foe) {
  const { width: w, height: h } = foe;
  const mid = w / 2;
  // Trousers and shirt.
  ctx.fillStyle = FOE_COLORS.iron;
  ctx.fillRect(mid - 2.6, h * 0.6, 5.2, h * 0.4);
  ctx.fillStyle = "#fb7185";
  ctx.fillRect(mid - 3.2, 6.2, 6.4, h * 0.45);
  // Head.
  ctx.fillStyle = FOE_COLORS.skin;
  ctx.beginPath();
  ctx.arc(mid, 3.2, 2.5, 0, Math.PI * 2);
  ctx.fill();
  // Both arms raised.
  ctx.strokeStyle = FOE_COLORS.skin;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(mid - 2.4, 8);
  ctx.lineTo(mid - 4.6, 2.6);
  ctx.moveTo(mid + 2.4, 8);
  ctx.lineTo(mid + 4.6, 2.6);
  ctx.stroke();
  // Foam hand on the right.
  ctx.fillStyle = FOE_COLORS.amber;
  ctx.fillRect(mid + 3.8, 0, 3, 3.2);
}

/**
 * The Wall (#1994): a stack of bricks with a scowl, flashing through its
 * grace after a hit, with one pip per hit point left.
 */
function drawWall(ctx: Ctx, foe: Foe) {
  const { width: w, height: h } = foe;
  if (foe.graceMs > 0 && Math.floor(foe.graceMs / 80) % 2 === 0) return;
  ctx.fillStyle = FOE_COLORS.iron;
  ctx.fillRect(0, 0, w, h);
  // Bricks in courses of two, offset row by row.
  ctx.fillStyle = FOE_COLORS.coral;
  const rows = 5;
  const bh = h / rows;
  for (let r = 0; r < rows; r++) {
    const shift = r % 2 === 0 ? 0 : -w / 4;
    for (let c = 0; c < 3; c++) {
      const left = Math.max(0, shift + (c * w) / 2 + 0.6);
      const right = Math.min(w, shift + ((c + 1) * w) / 2 - 0.6);
      if (right > left)
        ctx.fillRect(left, r * bh + 0.6, right - left, bh - 1.2);
    }
  }
  // A scowl: two eyes under a heavy brow.
  ctx.fillStyle = FOE_COLORS.dark;
  ctx.fillRect(4, 9, 5, 1.6);
  ctx.fillRect(w - 9, 9, 5, 1.6);
  ctx.fillRect(5, 11.5, 3, 3);
  ctx.fillRect(w - 8, 11.5, 3, 3);
  ctx.fillRect(w / 2 - 4, 20, 8, 1.6);
  // Hit pips.
  ctx.fillStyle = FOE_COLORS.amber;
  for (let i = 0; i < foe.hp; i++) {
    ctx.fillRect(w / 2 - 6.5 + i * 4.5, -6, 3, 2.5);
  }
}

/** Course foes, drawn at their screen x. A Fun Run turns them to spectators. */
function drawFoes(
  ctx: Ctx,
  foes: readonly Foe[],
  camera: number,
  cheering = false
) {
  for (const f of foes) {
    const x = f.x - camera;
    if (x > CANVAS_SIZE || x + f.width < -8) continue;
    ctx.save();
    ctx.translate(x, f.y);
    if (cheering && f.kind !== "repmax" && f.kind !== "wall") {
      drawSpectator(ctx, f);
      ctx.restore();
      continue;
    }
    switch (f.kind) {
      case "kettlebell":
        drawKettlebell(ctx, f);
        break;
      case "alert":
        drawMoveAlert(ctx, f);
        break;
      case "box":
        drawBoxJumper(ctx, f);
        break;
      case "lap":
        drawAutoLap(ctx, f);
        break;
      case "jellyfish":
        drawJellyfish(ctx, f);
        break;
      case "goggles":
        drawGoggles(ctx, f);
        break;
      case "repmax":
        drawRepMax(ctx, f);
        break;
      case "wall":
        drawWall(ctx, f);
        break;
    }
    ctx.restore();
  }
}

// ------------------------------------------------ Second Wind (#2026)

/**
 * Night Run (#2026): the play area goes dark except a soft headlamp cone
 * just ahead of the runner. Drawn before the runner and the HUD, so both
 * stay bright.
 */
function drawHeadlamp(ctx: Ctx) {
  const cx = PLAYER_X + 40;
  const cy = GROUND_Y - 28;
  const lamp = ctx.createRadialGradient(cx, cy, 12, cx, cy, 104);
  lamp.addColorStop(0, "rgba(2, 4, 10, 0)");
  lamp.addColorStop(0.6, "rgba(2, 4, 10, 0.4)");
  lamp.addColorStop(1, "rgba(2, 4, 10, 0.9)");
  ctx.fillStyle = lamp;
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
}

/**
 * Taper Week (#2026): a faint float trail under the runner while airborne.
 * It is static, so it moves nothing under reduced motion either.
 */
function drawFloatTrail(ctx: Ctx, state: GameEngineState) {
  if (state.isGrounded) return;
  const feet = state.playerY + BASE_HEIGHT;
  ctx.fillStyle = "rgba(186, 230, 253, 0.45)";
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(PLAYER_X - 6 - i * 7, feet + 4 + i, 4, 1);
  }
}

/**
 * The Second Wind HUD line (#2026): the event, its progress and the seconds
 * left. Night Run reads NO HITS until the runner takes one.
 */
export function secondWindHudText(wind: SecondWind): string {
  const seconds = Math.ceil(Math.max(0, wind.msLeft) / 1000);
  if (wind.kind === "night") {
    return `NIGHT RUN · ${wind.progress === 0 ? "NO HITS" : "HIT"} · ${seconds}s`;
  }
  const { name, goal } = SECOND_WIND_EVENTS[wind.kind];
  return `${name} ${Math.floor(wind.progress)}/${goal} · ${seconds}s`;
}

/**
 * The Second Wind line in a small dark pill across the lane (#2026), under
 * the pace meter and the RAM and NV readouts, clear of the banner, the
 * medal slots, the clock and the score.
 */
function drawSecondWindLine(ctx: Ctx, wind: SecondWind) {
  const line = secondWindHudText(wind);
  const px = fitTextPx(ctx, line, 6.5, 140, 5);
  const w = Math.min(150, ctx.measureText(line).width + 12);
  const y = 113;
  const h = 11;
  ctx.fillStyle = "rgba(0, 0, 0, 0.88)";
  ctx.beginPath();
  ctx.roundRect(FACE_CENTER - w / 2, y, w, h, 3);
  ctx.fill();
  text(
    ctx,
    line,
    FACE_CENTER,
    y + 7.4,
    px,
    wind.kind === "night" ? FACE_COLORS.identity : FACE_COLORS.good
  );
}

/** Race Mode course names on the HUD pill (#2019). */
const RACE_COURSE_SHORT: Record<RaceCourse, string> = {
  saturday5k: "SAT 5K",
  daily: "DAILY",
  raceday: "RACE DAY",
};

/**
 * The race pill (#2019): the course and category, e.g. "SAT 5K · ANY%", under
 * the Second Wind line and clear of the medal slots and the banner.
 */
function drawRaceLine(ctx: Ctx, race: RaceSetup) {
  // Race Day has one category, so its pill names the race alone (#1994).
  const line =
    race.course === "raceday"
      ? RACE_COURSE_SHORT.raceday
      : `${RACE_COURSE_SHORT[race.course]} · ${RACE_CATEGORY_INFO[race.category].short}`;
  const px = fitTextPx(ctx, line, 6.5, 100, 5);
  const w = Math.min(112, ctx.measureText(line).width + 12);
  const y = 127;
  ctx.fillStyle = "rgba(0, 0, 0, 0.88)";
  ctx.beginPath();
  ctx.roundRect(FACE_CENTER - w / 2, y, w, 11, 3);
  ctx.fill();
  text(ctx, line, FACE_CENTER, y + 7.4, px, FACE_COLORS.text);
}

/** Foe shots: a lap ping is a small sky diamond, a dumbbell a tumbling bar with plates, a brick a small brick. */
function drawFoeShots(ctx: Ctx, shots: readonly FoeShot[], camera: number) {
  const r = FOE_SHOT_SIZE / 2;
  for (const s of shots) {
    const cx = s.x - camera + r;
    const cy = s.y + r;
    if (cx - r > CANVAS_SIZE || cx + r < 0) continue;
    if (s.kind === "ping") {
      ctx.fillStyle = FOE_COLORS.sky;
      ctx.beginPath();
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r, cy);
      ctx.lineTo(cx, cy + r);
      ctx.lineTo(cx - r, cy);
      ctx.closePath();
      ctx.fill();
    } else if (s.kind === "brick") {
      ctx.fillStyle = FOE_COLORS.coral;
      ctx.fillRect(cx - r - 1, cy - r / 2, FOE_SHOT_SIZE + 2, r + 1);
      ctx.fillStyle = FOE_COLORS.iron;
      ctx.fillRect(cx - 0.5, cy - r / 2, 1, r + 1);
    } else {
      // A tumbling dumbbell: a bar with a plate at each end.
      const a = s.x / 6;
      const dx = Math.cos(a) * r;
      const dy = Math.sin(a) * r;
      ctx.strokeStyle = FOE_COLORS.steel;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx - dx, cy - dy);
      ctx.lineTo(cx + dx, cy + dy);
      ctx.stroke();
      ctx.fillStyle = FOE_COLORS.iron;
      ctx.beginPath();
      ctx.arc(cx - dx, cy - dy, 2, 0, Math.PI * 2);
      ctx.arc(cx + dx, cy + dy, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ------------------------------------------------------- data-field ring

function drawRingArc(
  ctx: Ctx,
  side: "ram" | "flash",
  fraction: number,
  tone: MeterTone = meterTone(fraction)
) {
  const track = ringFillSpan(side, 1);
  ctx.lineCap = "round";
  ctx.lineWidth = RING_WIDTH;
  ctx.strokeStyle = FACE_COLORS.track;
  ctx.beginPath();
  ctx.arc(
    FACE_CENTER,
    FACE_CENTER,
    RING_RADIUS,
    track.from,
    track.to,
    track.anticlockwise
  );
  ctx.stroke();
  if (fraction <= 0) return;
  const fill = ringFillSpan(side, fraction);
  ctx.strokeStyle = TONE_COLOR[tone];
  ctx.beginPath();
  ctx.arc(
    FACE_CENTER,
    FACE_CENTER,
    RING_RADIUS,
    fill.from,
    fill.to,
    fill.anticlockwise
  );
  ctx.stroke();
}

function drawHeart(ctx: Ctx, x: number, y: number) {
  ctx.fillStyle = FACE_COLORS.danger;
  ctx.beginPath();
  ctx.moveTo(x, y + 2.6);
  ctx.bezierCurveTo(x - 4.6, y - 0.4, x - 2.4, y - 4.4, x, y - 2);
  ctx.bezierCurveTo(x + 2.4, y - 4.4, x + 4.6, y - 0.4, x, y + 2.6);
  ctx.fill();
}

function drawBatteryGlyph(ctx: Ctx, x: number, y: number, percent: number) {
  const tone = batteryTone(percent);
  ctx.strokeStyle = FACE_COLORS.dim;
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y - 3, 11, 6);
  ctx.fillStyle = FACE_COLORS.dim;
  ctx.fillRect(x + 11, y - 1.5, 1.5, 3);
  ctx.fillStyle = tone === "ok" ? FACE_COLORS.good : TONE_COLOR[tone];
  ctx.fillRect(x + 1, y - 2, 9 * clamp(percent / 100, 0, 1), 4);
}

/**
 * The data fields: heart rate, run clock and battery across the top, RAM and
 * NV flash as arcs with readouts down the sides, and the ground strip below
 * the lane (steps, distance and heap variables by default).
 */
/** How far the runner is from this stage's start to its finish pole, 0 to 1. */
export function stageProgress(
  state: Pick<GameEngineState, "stage" | "distanceMeters">
): number {
  const stage = state.stage ?? 1;
  return clamp(
    (state.distanceMeters * PX_PER_METER - stageStartX(stage)) /
      (stagePoleX(stage) - stageStartX(stage)),
    0,
    1
  );
}

/**
 * The ring and readouts under the fitness rules: Body Battery on the left
 * arc, the stage's progress to the finish pole on the right, and running
 * stats along the ground strip.
 */
function drawFitnessRing(ctx: Ctx, state: GameEngineState) {
  const bb = state.bodyBattery;
  const bbValue = Math.round(bodyBatteryFraction(bb) * 100);
  const bbTone = bb?.bonked ? "danger" : batteryTone(bbValue);
  const stage = state.stage ?? 1;
  const progress = stageProgress(state);
  drawRingArc(ctx, "ram", bbValue / 100, bbTone);
  drawRingArc(ctx, "flash", progress, "ok");

  drawRunClock(ctx, state);
  drawHeart(ctx, 71, 40);
  text(
    ctx,
    `${Math.round(state.heartRate)}`,
    78,
    43,
    9,
    FACE_COLORS.text,
    "left"
  );
  drawBatteryGlyph(ctx, 171, 40, bbValue);
  text(ctx, `${bbValue}`, 212, 43, 9, TONE_COLOR[bbTone], "right");

  text(ctx, "BODY", 24, 93, 6.5, FACE_COLORS.dim, "left");
  text(ctx, bodyBatteryLabel(bb), 24, 104, 9, TONE_COLOR[bbTone], "left");
  text(ctx, `${stage}K`, 256, 93, 6.5, FACE_COLORS.dim, "right");
  text(
    ctx,
    `${Math.round(progress * 100)}%`,
    256,
    104,
    9,
    FACE_COLORS.text,
    "right"
  );

  // A runner reads average pace off the watch (#2018).
  const pace = formatPace(
    paceSecondsPerKm(state.runClockMs ?? 0, paceMeters(state))
  ).replace("/km", "");
  const fields: [string, string][] = [
    [pace, "PACE"],
    [(Math.max(0, state.distanceMeters) / 1000).toFixed(2), "KM"],
    [`${state.kudos ?? 0}`, "KUDOS"],
  ];
  fields.forEach(([value, label], i) => {
    const x = GROUND_STRIP_X[i];
    text(ctx, value, x, 231, 9, FACE_COLORS.text);
    text(ctx, label, x, 240, 5.5, FACE_COLORS.dim);
  });
  if (bb?.bonked) {
    ctx.fillStyle = FACE_COLORS.danger;
    ctx.beginPath();
    ctx.roundRect(116, 248, 48, 10, 3);
    ctx.fill();
    text(ctx, "BONKED", FACE_CENTER, 255.5, 6.5, "#0d0e11");
  }
}

function drawDataRing(
  ctx: Ctx,
  state: GameEngineState,
  strip: GroundStripLayout
) {
  if (isFitnessRun(state)) {
    drawFitnessRing(ctx, state);
    return;
  }
  const profile = DEVICE_PROFILES[state.device] ?? DEVICE_PROFILES.fenix;
  const ramFraction = state.allocatedRamKb / profile.ramLimitKb;
  const flashFraction = state.allocatedFlashKb / profile.flashLimitKb;
  drawRingArc(ctx, "ram", ramFraction);
  drawRingArc(ctx, "flash", flashFraction);

  // Top row.
  drawRunClock(ctx, state);
  drawHeart(ctx, 71, 40);
  text(
    ctx,
    `${Math.round(state.heartRate)}`,
    78,
    43,
    9,
    FACE_COLORS.text,
    "left"
  );
  const battery = Math.round(state.battery);
  drawBatteryGlyph(ctx, 171, 40, battery);
  text(
    ctx,
    `${battery}%`,
    212,
    43,
    9,
    batteryTone(battery) === "ok"
      ? FACE_COLORS.text
      : TONE_COLOR[batteryTone(battery)],
    "right"
  );

  // Side readouts for the arcs, above the runner's jump.
  text(ctx, "RAM", 24, 93, 6.5, FACE_COLORS.dim, "left");
  text(
    ctx,
    `${state.allocatedRamKb.toFixed(1)}K`,
    24,
    104,
    9,
    TONE_COLOR[meterTone(ramFraction)],
    "left"
  );
  text(ctx, "NV", 256, 93, 6.5, FACE_COLORS.dim, "right");
  text(
    ctx,
    `${state.allocatedFlashKb.toFixed(1)}K`,
    256,
    104,
    9,
    TONE_COLOR[meterTone(flashFraction)],
    "right"
  );

  // Ground strip, below the lane.
  strip.forEach((field, i) => {
    const [value, label] = groundStripReadout(field, state);
    const x = GROUND_STRIP_X[i];
    text(ctx, value, x, 231, 9, FACE_COLORS.text);
    text(ctx, label, x, 240, 5.5, FACE_COLORS.dim);
  });
  if (battery < 15 && battery > 0) {
    ctx.fillStyle = FACE_COLORS.danger;
    ctx.beginPath();
    ctx.roundRect(116, 248, 48, 10, 3);
    ctx.fill();
    text(ctx, "LOW BAT", FACE_CENTER, 255.5, 6.5, "#0d0e11");
  }
}

// ------------------------------------------------------------- overlays

function drawGcFreeze(ctx: Ctx, state: GameEngineState) {
  ctx.fillStyle = "rgba(0, 0, 170, 0.28)";
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  const ms = state.tuning?.gcFreezeMs ?? 500;
  text(ctx, "GC", FACE_CENTER, 128, 16, "#a5f3fc");
  text(
    ctx,
    `FREEZE ${ms}MS · RECLAIMING HEAP`,
    FACE_CENTER,
    140,
    6.5,
    FACE_COLORS.text
  );
}

let fogLayer: HTMLCanvasElement | null = null;

/**
 * Condensation: a frosted layer with the wiped patches cut out. It is drawn
 * on its own layer and laid over the world, so a wipe shows the world rather
 * than punching through it. Without layer support (a minimal test double) it
 * falls back to a plain veil.
 */
function drawFog(ctx: Ctx, state: GameEngineState) {
  const alpha = Math.min(0.85, state.fogLevel);
  const veil = `rgba(214, 236, 245, ${alpha})`;
  const canLayer =
    typeof document !== "undefined" && typeof ctx.drawImage === "function";
  let layerCtx: Ctx | null = null;
  if (canLayer) {
    fogLayer ??= document.createElement("canvas");
    if (fogLayer.width !== CANVAS_SIZE) {
      fogLayer.width = CANVAS_SIZE;
      fogLayer.height = CANVAS_SIZE;
    }
    layerCtx = fogLayer.getContext("2d");
  }
  if (!layerCtx || !fogLayer) {
    ctx.fillStyle = veil;
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  } else {
    layerCtx.save();
    layerCtx.globalCompositeOperation = "source-over";
    layerCtx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    layerCtx.fillStyle = veil;
    layerCtx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    layerCtx.globalCompositeOperation = "destination-out";
    for (const wipe of state.fogWipes) {
      const grad = layerCtx.createRadialGradient(
        wipe.x,
        wipe.y,
        0,
        wipe.x,
        wipe.y,
        wipe.radius
      );
      grad.addColorStop(0, "rgba(0, 0, 0, 1)");
      grad.addColorStop(0.7, "rgba(0, 0, 0, 0.8)");
      grad.addColorStop(1, "rgba(0, 0, 0, 0)");
      layerCtx.fillStyle = grad;
      layerCtx.beginPath();
      layerCtx.arc(wipe.x, wipe.y, wipe.radius, 0, Math.PI * 2);
      layerCtx.fill();
    }
    layerCtx.restore();
    ctx.drawImage(fogLayer, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
  }
  if (state.fogLevel > 0.4) {
    text(
      ctx,
      "OVERHEAT · SWIPE TO WIPE",
      FACE_CENTER,
      80,
      7.5,
      FACE_COLORS.warn
    );
  }
}

function drawPaused(ctx: Ctx, title: string) {
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  text(ctx, title, FACE_CENTER, FACE_CENTER - 4, 16, FACE_COLORS.text);
  text(
    ctx,
    "PRESS START / ENTER",
    FACE_CENTER,
    FACE_CENTER + 12,
    7,
    FACE_COLORS.dim
  );
}

// ------------------------------------------------------------ end faces

/** The Connect IQ "IQ!" error mark. */
function drawIqMark(ctx: Ctx, cx: number, cy: number) {
  ctx.fillStyle = "#0b0c0f";
  ctx.strokeStyle = FACE_COLORS.identity;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(cx - 38, cy - 30, 76, 60, 13);
  ctx.fill();
  ctx.stroke();
  text(ctx, "IQ", cx + 7, cy + 11, 30, FACE_COLORS.text, "right");
  text(ctx, "!", cx + 9, cy + 11, 30, FACE_COLORS.danger, "left");
}

function drawEmptyBattery(ctx: Ctx, cx: number, cy: number) {
  ctx.strokeStyle = FACE_COLORS.dim;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(cx - 28, cy - 14, 52, 28, 4);
  ctx.stroke();
  ctx.fillStyle = FACE_COLORS.dim;
  ctx.fillRect(cx + 26, cy - 6, 4, 12);
  ctx.fillStyle = FACE_COLORS.danger;
  ctx.fillRect(cx - 24, cy - 10, 5, 20);
}

/** A Training Status gauge: a half dial with its needle low. */
function drawStatusGauge(ctx: Ctx, cx: number, cy: number) {
  ctx.lineCap = "round";
  ctx.lineWidth = 5;
  const bands = [FACE_COLORS.danger, FACE_COLORS.warn, FACE_COLORS.ok];
  bands.forEach((color, i) => {
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.arc(
      cx,
      cy,
      24,
      Math.PI + (i * Math.PI) / 3 + 0.08,
      Math.PI + ((i + 1) * Math.PI) / 3 - 0.08
    );
    ctx.stroke();
  });
  ctx.strokeStyle = FACE_COLORS.text;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx - 17, cy - 9);
  ctx.stroke();
  ctx.fillStyle = FACE_COLORS.text;
  ctx.beginPath();
  ctx.arc(cx, cy, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawEndFace(ctx: Ctx, state: GameEngineState, face: EndFace) {
  ctx.fillStyle = face.kind === "power" ? "#050508" : "#000000";
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  if (face.kind === "power") {
    drawEmptyBattery(ctx, FACE_CENTER, 98);
  } else if (face.kind === "crash") {
    drawIqMark(ctx, FACE_CENTER, 96);
  } else if (
    face.kind === "status" ||
    // A DNF or DNQ race gets the gauge, not the finisher's tick (#2019).
    (face.kind === "race" && face.detail.startsWith("DN"))
  ) {
    drawStatusGauge(ctx, FACE_CENTER, 104);
  } else {
    ctx.strokeStyle = FACE_COLORS.good;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(FACE_CENTER - 18, 98);
    ctx.lineTo(FACE_CENTER - 4, 112);
    ctx.lineTo(FACE_CENTER + 20, 84);
    ctx.stroke();
  }
  const headlinePx = face.headline.length > 14 ? 11 : 13;
  text(ctx, face.headline, FACE_CENTER, 152, headlinePx, FACE_COLORS.text);
  // A race's verdict is its finish time, so it reads larger.
  const raceTime = face.kind === "race" && !face.detail.startsWith("DN");
  text(
    ctx,
    face.detail,
    FACE_CENTER,
    raceTime ? 170 : 167,
    raceTime ? 11 : 7,
    raceTime ? FACE_COLORS.text : FACE_COLORS.dim,
    "center",
    "normal"
  );
  ctx.fillStyle = "rgba(148, 163, 184, 0.25)";
  ctx.fillRect(FACE_CENTER - 44, 180, 88, 1);
  // A fitness run ends with its medal tally, and any secret exits it found (#2025).
  const medals = (state.medalsFound ?? []).length;
  const totalMedals = STAGE_COUNT * MEDALS_PER_STAGE;
  const scoreLine =
    face.kind === "race"
      ? raceReportLine(state)
      : isFitnessRun(state)
        ? `SCORE ${state.score} · MEDALS ${medals}/${totalMedals}`
        : `SCORE ${state.score}`;
  text(ctx, scoreLine, FACE_CENTER, 196, 8, FACE_COLORS.text);
  const exits = (state.secretExits ?? []).length;
  if (isFitnessRun(state) && exits > 0) {
    text(ctx, `SECRET EXITS ${exits}`, FACE_CENTER, 205, 6, FACE_COLORS.good);
  }
  text(
    ctx,
    face.kind === "race"
      ? "PRESS START TO RACE AGAIN"
      : isFitnessRun(state)
        ? "PRESS START TO RUN AGAIN"
        : "PRESS START TO REBOOT",
    FACE_CENTER,
    214,
    7.5,
    FACE_COLORS.identity
  );
}

/** The Virtual Partner on one frame (#2020): where it is, and where it just was. */
interface GhostFrame {
  sample: GhostSample;
  /** Earlier samples for the trail, newest first; empty under reduced motion. */
  trail: readonly GhostSample[];
}

/** Options for one frame of the watch face. */
interface WatchFaceOptions {
  /**
   * The user asks for reduced motion: Hill Repeats draws no lane tilt (its
   * progress line still shows the event).
   */
  reducedMotion?: boolean;
  /** The Virtual Partner to draw, if any (#2020). */
  ghost?: GhostFrame | null;
  /** The gap to the Virtual Partner in ms, positive when behind (#2020). */
  ghostGapMs?: number | null;
}

/** Whether a ghost sample shares the runner's stage and room, so it can be drawn beside them. */
function ghostBeside(state: GameEngineState, s: GhostSample): boolean {
  const room = (s.flags & GHOST_FLAG.room) !== 0;
  return s.stage === (state.stage ?? 1) && room === Boolean(state.bonusRoom);
}

/**
 * The Virtual Partner (#2020): the runner's sprite, see-through, where the
 * ghost is on the lane, with a short fading trail. It is drawn only on the
 * runner's stage and inside the same room, and never collides.
 */
function drawGhost(ctx: Ctx, state: GameEngineState, frame: GhostFrame) {
  const g = frame.sample;
  if (!ghostBeside(state, g)) return;
  const dx = (g.d - state.distanceMeters) * PX_PER_METER;
  if (Math.abs(dx) > CANVAS_SIZE) return;
  ctx.save();
  ctx.fillStyle = FACE_COLORS.identity;
  frame.trail.forEach((t, i) => {
    if (!ghostBeside(state, t)) return;
    const tx = PLAYER_X + 10 + (t.d - state.distanceMeters) * PX_PER_METER;
    ctx.globalAlpha = 0.22 - i * 0.06;
    ctx.beginPath();
    ctx.arc(
      tx,
      t.y + playerHeightFor(t.power) / 2,
      3 - i * 0.6,
      0,
      Math.PI * 2
    );
    ctx.fill();
  });
  ctx.globalAlpha = 0.4;
  ctx.translate(dx, 0);
  drawRunner(
    ctx,
    {
      ...state,
      playerY: g.y,
      distanceMeters: g.d,
      power: g.power,
      isGrounded: (g.flags & GHOST_FLAG.grounded) !== 0,
      slamming: (g.flags & GHOST_FLAG.slamming) !== 0,
      wallSide: (g.flags & GHOST_FLAG.wallSide) !== 0,
      riding: (g.flags & GHOST_FLAG.riding) !== 0,
      spinJump: (g.flags & GHOST_FLAG.spinJump) !== 0,
      carrying: false,
      invulnerableMs: 0,
      starMs: 0,
      isGcActive: false,
    },
    (g.flags & GHOST_FLAG.swimming) !== 0
  );
  ctx.restore();
}

/** The gap to the Virtual Partner, under the race line: red behind, green ahead. */
function drawGhostGap(ctx: Ctx, gapMs: number) {
  const line = formatGap(gapMs);
  const tone = line.startsWith("-")
    ? FACE_COLORS.good
    : line === "+0:00.0"
      ? FACE_COLORS.text
      : FACE_COLORS.danger;
  ctx.font = faceFont(7, "bold");
  const w = ctx.measureText(line).width + 12;
  const y = 140;
  ctx.fillStyle = "rgba(0, 0, 0, 0.88)";
  ctx.beginPath();
  ctx.roundRect(FACE_CENTER - w / 2, y, w, 11, 3);
  ctx.fill();
  text(ctx, line, FACE_CENTER, y + 7.6, 7, tone);
}

/**
 * Draws one frame of the watch face for `state` into a context already
 * scaled to the 280 x 280 logical space.
 */
export function renderWatchFace(
  ctx: Ctx,
  state: GameEngineState,
  strip: GroundStripLayout = DEFAULT_GROUND_STRIP,
  options: WatchFaceOptions = {}
): void {
  ctx.save();
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  ctx.beginPath();
  ctx.arc(FACE_CENTER, FACE_CENTER, FACE_RADIUS, 0, Math.PI * 2);
  ctx.clip();

  const end = endFaceFor(state);
  if (end) {
    drawEndFace(ctx, state, end);
    ctx.restore();
    return;
  }

  const course = state.course ?? EMPTY_COURSE;
  const camera = state.distanceMeters * PX_PER_METER;
  const theme = themeOf(state);
  const wind = state.secondWind ?? null;
  if (state.bonusRoom) {
    drawBonusRoomBackdrop(ctx);
  } else {
    drawSky(ctx, state.isLightOn, theme, state.distanceMeters);
    drawSkyline(ctx, state.distanceMeters, theme);
    drawPines(ctx, state.distanceMeters, theme);
    if (theme === "pool") drawPoolLanes(ctx, state.distanceMeters);
    if (theme === "open-water" && course.currents) {
      drawCurrents(ctx, course.currents, camera);
    }
  }
  // Hill Repeats tilts the lane about the runner's feet (#2026), and only
  // the lane: the sky, the runner and the HUD stay level.
  const tilting = wind?.kind === "hills" && !options.reducedMotion;
  ctx.save();
  if (tilting) {
    ctx.translate(PLAYER_X, GROUND_Y);
    ctx.rotate(hillTilt(wind, camera + PLAYER_X));
    ctx.translate(-PLAYER_X, -GROUND_Y);
  }
  drawGround(ctx, state.distanceMeters, course, theme);
  drawPoles(ctx, course, camera);
  drawCheckpoints(ctx, course, camera, state.checkpoint);
  drawLedges(ctx, course, camera, THEME_PALETTE[theme].accent);
  for (const ceiling of course.ceilings ?? []) {
    drawCeilingRack(ctx, ceiling, camera);
  }
  if (state.props) {
    drawProps(ctx, state.props, camera, state.propClockMs ?? 0, GROUND_Y);
  }
  drawPickups(ctx, state.pickups ?? [], camera);
  drawBlocks(ctx, course, camera);
  drawKudos(ctx, course, camera);
  drawCourseMedals(ctx, course, camera);
  if (!state.bonusRoom) drawMedBalls(ctx, course.medBalls ?? [], camera);

  drawFoes(ctx, state.foes ?? [], camera, wind?.kind === "funrun");
  const fitness = isFitnessRun(state);
  for (const obs of state.obstacles) {
    drawObstacle(ctx, obs, fitness);
  }
  ctx.restore();
  if (wind?.kind === "night") drawHeadlamp(ctx);
  if (wind?.kind === "taper") drawFloatTrail(ctx, state);
  if (options.ghost) drawGhost(ctx, state, options.ghost);
  drawRunner(ctx, state);
  drawSpin(ctx, state);
  drawBolts(ctx, state.bolts ?? [], camera);
  if (state.thrownBall && !state.bonusRoom) {
    drawThrownBall(ctx, state.thrownBall, camera);
  }
  drawFoeShots(ctx, state.foeShots ?? [], camera);
  drawPopups(ctx, state, camera);

  if (state.isGcActive) drawGcFreeze(ctx, state);
  if (!isFitnessRun(state) && state.battery < 15) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  }
  // Idle keeps the ring empty: the start card sits over the face then.
  if (state.gameState !== "idle") {
    drawDataRing(ctx, state, strip);
    drawCourseHud(ctx, state);
    if ((state.restDayMs ?? 0) > 0) drawRestDayBadge(ctx, state.restDayMs ?? 0);
    drawBanner(ctx, state);
    if (wind) drawSecondWindLine(ctx, wind);
    if (state.race) drawRaceLine(ctx, state.race);
    if (state.race && typeof options.ghostGapMs === "number") {
      drawGhostGap(ctx, options.ghostGapMs);
    }
  }
  if (state.fogLevel > 0.05) drawFog(ctx, state);
  if (state.gameState === "paused")
    drawPaused(ctx, isFitnessRun(state) ? AUTO_PAUSE_TEXT : "PAUSED");

  ctx.restore();
}
