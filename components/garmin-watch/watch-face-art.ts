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
import {
  CANVAS_SIZE,
  GROUND_Y,
  PLAYER_X,
  type CrashReport,
  type GameEngineState,
  type Obstacle,
  type ObstacleType,
  type VariableType,
} from "@/lib/garmin-engine";
import {
  DEFAULT_WIDGET_LAYOUT,
  METRIC_DEFINITIONS,
  type WidgetLayoutConfig,
} from "@/lib/garmin-widget-layout";

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

/** What a full-screen end face says. */
interface EndFace {
  kind: "crash" | "power" | "complete";
  headline: string;
  detail: string;
}

/**
 * The full-screen face for a run that has ended, or null while it hasn't.
 * The crash face names the real cause and where it happened.
 */
export function endFaceFor(
  state: Pick<GameEngineState, "gameState" | "battery" | "crashReport">
): EndFace | null {
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
      headline: "RUN COMPLETE",
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

function drawSky(ctx: Ctx, lit: boolean) {
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

function drawSkyline(ctx: Ctx, distance: number) {
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

function drawPines(ctx: Ctx, distance: number) {
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

function drawGround(ctx: Ctx, distance: number) {
  ctx.fillStyle = "#101215";
  ctx.fillRect(0, GROUND_Y, CANVAS_SIZE, CANVAS_SIZE - GROUND_Y);
  // Lane edge in the identity hue, and lane dashes at track speed.
  ctx.fillStyle = FACE_COLORS.identity;
  ctx.fillRect(0, GROUND_Y, CANVAS_SIZE, 1.5);
  ctx.fillStyle = "rgba(148, 163, 184, 0.35)";
  const dash = parallaxOffset(distance, 1, 24);
  for (let x = -dash; x < CANVAS_SIZE; x += 24) {
    ctx.fillRect(x, GROUND_Y + 5, 12, 1.5);
  }
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
 * The monkey runner, facing right, inside the engine's 20 x 24 player box:
 * a headband, a cyan race singlet with bib, and a watch on the wrist.
 */
function drawRunner(ctx: Ctx, state: GameEngineState) {
  const pose = runnerPose(state.distanceMeters, state.isGrounded);
  const fur = state.isGcActive ? FUR_FROZEN : FUR;
  ctx.save();
  ctx.translate(PLAYER_X, state.playerY - pose.bob);

  // Contact shadow on the lane, smaller the higher the jump.
  const lift = clamp(GROUND_Y - (state.playerY + 24), 0, 90);
  ctx.save();
  ctx.translate(0, pose.bob);
  ctx.fillStyle = `rgba(0, 0, 0, ${0.45 - lift / 300})`;
  ctx.beginPath();
  ctx.ellipse(10, 24 + lift, 8 - lift / 20, 1.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

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

  // Torso: singlet in the identity hue with a white race bib.
  ctx.fillStyle = state.isGcActive ? "#a5f3fc" : FACE_COLORS.identity;
  ctx.beginPath();
  ctx.roundRect(7.2, 7.6, 7, 7.6, 2);
  ctx.fill();
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
  ctx.fillStyle = FACE_COLORS.danger;
  ctx.beginPath();
  ctx.moveTo(w - 3, h - 24);
  ctx.lineTo(w, h - 19.5);
  ctx.lineTo(w - 6, h - 19.5);
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

function drawObstacle(ctx: Ctx, obs: Obstacle) {
  ctx.save();
  ctx.translate(obs.x, obs.y);
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
 * The data fields: rendered according to the configurable WidgetLayoutConfig.
 */
function drawDataRing(
  ctx: Ctx,
  state: GameEngineState,
  layout: WidgetLayoutConfig = DEFAULT_WIDGET_LAYOUT
) {
  const leftMetric =
    METRIC_DEFINITIONS[layout.leftArc] ?? METRIC_DEFINITIONS.ram;
  const rightMetric =
    METRIC_DEFINITIONS[layout.rightArc] ?? METRIC_DEFINITIONS.flash;
  const topLeftMetric =
    METRIC_DEFINITIONS[layout.topLeft] ?? METRIC_DEFINITIONS.heartRate;
  const topRightMetric =
    METRIC_DEFINITIONS[layout.topRight] ?? METRIC_DEFINITIONS.battery;

  const leftFraction = leftMetric.resolveFraction(state);
  const rightFraction = rightMetric.resolveFraction(state);

  drawRingArc(ctx, "ram", leftFraction, leftMetric.resolveTone(state));
  drawRingArc(ctx, "flash", rightFraction, rightMetric.resolveTone(state));

  // Top row.
  text(ctx, `${state.score}`, FACE_CENTER, 44, 20, FACE_COLORS.text);
  text(ctx, "PTS", FACE_CENTER, 55, 7, FACE_COLORS.dim);

  // Top Left Slot
  drawHeart(ctx, 71, 40);
  text(
    ctx,
    `${topLeftMetric.resolveValue(state)}`,
    78,
    43,
    9,
    FACE_COLORS.text,
    "left"
  );

  // Top Right Slot
  const batteryVal = Math.round(state.battery);
  drawBatteryGlyph(ctx, 171, 40, batteryVal);
  const topRightTone = topRightMetric.resolveTone(state);
  text(
    ctx,
    topRightMetric.formatReadout(state),
    212,
    43,
    9,
    topRightTone === "ok" ? FACE_COLORS.text : TONE_COLOR[topRightTone],
    "right"
  );

  // Side readouts for the arcs
  text(ctx, leftMetric.shortLabel, 24, 93, 6.5, FACE_COLORS.dim, "left");
  const leftTone = leftMetric.resolveTone(state);
  text(
    ctx,
    leftMetric.key === "ram" || leftMetric.key === "flash"
      ? `${leftMetric.resolveValue(state).toFixed(1)}K`
      : `${leftMetric.resolveValue(state)}`,
    24,
    104,
    9,
    TONE_COLOR[leftTone],
    "left"
  );

  text(ctx, rightMetric.shortLabel, 256, 93, 6.5, FACE_COLORS.dim, "right");
  const rightTone = rightMetric.resolveTone(state);
  text(
    ctx,
    rightMetric.key === "ram" || rightMetric.key === "flash"
      ? `${rightMetric.resolveValue(state).toFixed(1)}K`
      : `${rightMetric.resolveValue(state)}`,
    256,
    104,
    9,
    TONE_COLOR[rightTone],
    "right"
  );

  // Ground strip, below the lane.
  const bLeft =
    METRIC_DEFINITIONS[layout.bottomLeft] ?? METRIC_DEFINITIONS.steps;
  const bCenter =
    METRIC_DEFINITIONS[layout.bottomCenter] ?? METRIC_DEFINITIONS.distance;
  const bRight =
    METRIC_DEFINITIONS[layout.bottomRight] ?? METRIC_DEFINITIONS.variables;

  const fields: Array<[string, string, number]> = [
    [`${bLeft.resolveValue(state)}`, bLeft.shortLabel, 90],
    [`${bCenter.resolveValue(state)}`, bCenter.shortLabel, 140],
    [`${bRight.resolveValue(state)}`, bRight.shortLabel, 190],
  ];
  for (const [value, label, x] of fields) {
    text(ctx, value, x, 231, 9, FACE_COLORS.text);
    text(ctx, label, x, 240, 5.5, FACE_COLORS.dim);
  }

  if (batteryVal < 15 && batteryVal > 0) {
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

function drawPaused(ctx: Ctx) {
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  text(ctx, "PAUSED", FACE_CENTER, FACE_CENTER - 4, 16, FACE_COLORS.text);
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

function drawEndFace(ctx: Ctx, state: GameEngineState, face: EndFace) {
  ctx.fillStyle = face.kind === "power" ? "#050508" : "#000000";
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  if (face.kind === "power") {
    drawEmptyBattery(ctx, FACE_CENTER, 98);
  } else if (face.kind === "crash") {
    drawIqMark(ctx, FACE_CENTER, 96);
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
  text(
    ctx,
    face.detail,
    FACE_CENTER,
    167,
    7,
    FACE_COLORS.dim,
    "center",
    "normal"
  );
  ctx.fillStyle = "rgba(148, 163, 184, 0.25)";
  ctx.fillRect(FACE_CENTER - 44, 180, 88, 1);
  text(ctx, `SCORE ${state.score}`, FACE_CENTER, 196, 8, FACE_COLORS.text);
  text(
    ctx,
    "PRESS START TO REBOOT",
    FACE_CENTER,
    214,
    7.5,
    FACE_COLORS.identity
  );
}

/**
 * Draws one frame of the watch face for `state` into a context already
 * scaled to the 280 x 280 logical space.
 */
export function renderWatchFace(
  ctx: Ctx,
  state: GameEngineState,
  layout: WidgetLayoutConfig = DEFAULT_WIDGET_LAYOUT
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

  drawSky(ctx, state.isLightOn);
  drawSkyline(ctx, state.distanceMeters);
  drawPines(ctx, state.distanceMeters);
  drawGround(ctx, state.distanceMeters);

  for (const obs of state.obstacles) {
    drawObstacle(ctx, obs);
  }
  drawRunner(ctx, state);

  if (state.isGcActive) drawGcFreeze(ctx, state);
  if (state.battery < 15) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  }
  // Idle keeps the ring empty: the start card sits over the face then.
  if (state.gameState !== "idle") drawDataRing(ctx, state, layout);
  if (state.fogLevel > 0.05) drawFog(ctx, state);
  if (state.gameState === "paused") drawPaused(ctx);

  ctx.restore();
}
