/**
 * Virtual Partner for Monkey C Mayhem Race Mode (#2020): a see-through ghost
 * that replays your best race on the same course and category, like the
 * pacing partner on a running watch.
 *
 * A race samples the runner every {@link GHOST_SAMPLE_MS} of run clock. When
 * the run becomes the board's best, its samples are kept as the ghost. This
 * module is pure: it records, encodes, decodes, interpolates and measures the
 * gap. Storage lives in `lib/garmin-ghost-store.ts`. The engine never sees
 * the ghost, so the ghost cannot collide with anything or change a result.
 */

import type { PowerTier } from "./garmin-powerups";

/** Run clock between two samples, in ms. */
export const GHOST_SAMPLE_MS = 100;

/** The most characters one encoded ghost may take (about 40 KB). */
export const GHOST_MAX_CHARS = 40_000;

/** The encoding's version, the first field of every encoded ghost. */
const FORMAT = "g1";

/** Power tiers in a fixed order, so a sample can store one as a number. */
const POWERS: readonly PowerTier[] = [
  "base",
  "buff",
  "heatmap",
  "cape",
  "trisuit",
];

/** Bits of a sample's `flags`: the pose and where the runner is. */
export const GHOST_FLAG = {
  grounded: 1,
  slamming: 2,
  wallSide: 4,
  riding: 8,
  spinJump: 16,
  /** Inside a Water Station's bonus room. */
  room: 32,
  /** Swimming underwater. */
  swimming: 64,
} as const;

/** One sample of the runner. */
export interface GhostSample {
  /** Distance in metres. A lost life rewinds it to the stage start. */
  d: number;
  /** Top of the runner's box on the face, in px. */
  y: number;
  stage: number;
  power: PowerTier;
  /** {@link GHOST_FLAG} bits. */
  flags: number;
}

/** A ghost: its samples, the run's lap times and its finish time. */
export interface GhostTrack {
  /** Run clock between samples, in ms: {@link GHOST_SAMPLE_MS}, or a multiple when thinned to fit. */
  intervalMs: number;
  /** Sample `i` is the runner at run clock `i * intervalMs`. */
  samples: GhostSample[];
  /** Run clock at the end of each lap, in ms. */
  lapEndsMs: number[];
  /** The run's finish time, in ms. */
  timeMs: number;
}

/** What a race records from the engine state on each step. */
export interface GhostSource {
  gameState: string;
  runClockMs?: number;
  distanceMeters: number;
  playerY: number;
  isGrounded: boolean;
  stage?: number;
  power?: PowerTier;
  slamming?: boolean;
  wallSide?: boolean;
  riding?: boolean;
  spinJump?: boolean;
  /** Truthy inside a bonus room. */
  bonusRoom?: unknown;
}

/** A race's recording in progress. */
export interface GhostRecorder {
  samples: GhostSample[];
  /** The run clock of the next sample. */
  nextAtMs: number;
}

/** A recorder with no samples. */
export function createGhostRecorder(): GhostRecorder {
  return { samples: [], nextAtMs: 0 };
}

/**
 * Records `state` when its run clock has reached the next sample time. Call
 * it after every simulation step: a step is shorter than a sample, so each
 * sample is taken within one step of its time. `swimming` is whether the
 * runner is drawn swimming. Does nothing outside play.
 */
export function recordGhost(
  recorder: GhostRecorder,
  state: GhostSource,
  swimming: boolean
): void {
  if (state.gameState !== "playing") return;
  const clock = state.runClockMs ?? 0;
  if (!Number.isFinite(clock) || clock < recorder.nextAtMs) return;
  const flags =
    (state.isGrounded ? GHOST_FLAG.grounded : 0) |
    (state.slamming ? GHOST_FLAG.slamming : 0) |
    (state.wallSide ? GHOST_FLAG.wallSide : 0) |
    (state.riding ? GHOST_FLAG.riding : 0) |
    (state.spinJump ? GHOST_FLAG.spinJump : 0) |
    (state.bonusRoom ? GHOST_FLAG.room : 0) |
    (swimming ? GHOST_FLAG.swimming : 0);
  const sample: GhostSample = {
    d: state.distanceMeters,
    y: state.playerY,
    stage: state.stage ?? 1,
    power: state.power ?? "base",
    flags,
  };
  // A step that skips past a sample time (a stall) repeats the sample, so
  // sample i stays at run clock i * GHOST_SAMPLE_MS.
  while (recorder.nextAtMs <= clock) {
    recorder.samples.push(sample);
    recorder.nextAtMs += GHOST_SAMPLE_MS;
  }
}

/** The ghost of a finished run, from its recording, lap splits and time. */
export function finishGhost(
  recorder: GhostRecorder,
  lapSplits: readonly number[],
  timeMs: number
): GhostTrack {
  const lapEndsMs: number[] = [];
  let sum = 0;
  for (const split of lapSplits) {
    sum += split;
    lapEndsMs.push(sum);
  }
  return {
    intervalMs: GHOST_SAMPLE_MS,
    samples: recorder.samples.slice(),
    lapEndsMs,
    timeMs,
  };
}

/** Signed base-36: `-` before a negative number. */
const b36 = (n: number) => (n < 0 ? `-${(-n).toString(36)}` : n.toString(36));

/** A whole number from {@link b36}, or NaN. */
function fromB36(token: string): number {
  if (!/^-?[0-9a-z]+$/.test(token)) return Number.NaN;
  return token.startsWith("-")
    ? -parseInt(token.slice(1), 36)
    : parseInt(token, 36);
}

/** The stage, power and flags of a sample as one number. */
function modeOf(s: GhostSample): number {
  return s.flags | (POWERS.indexOf(s.power) << 7) | (s.stage << 10);
}

function encodeSamples(track: GhostTrack): string {
  const header = [
    FORMAT,
    b36(track.intervalMs),
    b36(Math.round(track.timeMs)),
    track.lapEndsMs.map((ms) => b36(Math.round(ms))).join("."),
  ].join(":");
  const tokens: string[] = [];
  let d = 0;
  let y = 0;
  let mode = -1;
  for (const s of track.samples) {
    const m = modeOf(s);
    if (m !== mode) {
      tokens.push(`m${b36(m)}`);
      mode = m;
    }
    // Distance in tenths of a metre (a pixel) and y in whole pixels, each
    // as a change from the sample before.
    const qd = Math.round(s.d * 10);
    const qy = Math.round(s.y);
    tokens.push(`${b36(qd - d)}/${b36(qy - y)}`);
    d = qd;
    y = qy;
  }
  return `${header}:${tokens.join(",")}`;
}

/** Keeps every other sample, doubling the interval. */
function thin(track: GhostTrack): GhostTrack {
  return {
    ...track,
    intervalMs: track.intervalMs * 2,
    samples: track.samples.filter((_, i) => i % 2 === 0),
  };
}

/**
 * Encodes a ghost as a compact string: each sample's distance and height as
 * a change from the one before, and its stage, power and pose only when they
 * change. A ghost longer than {@link GHOST_MAX_CHARS} is thinned (every other
 * sample) until it fits. Returns null when even one sample a second will not
 * fit.
 */
export function encodeGhost(track: GhostTrack): string | null {
  let current = track;
  let encoded = encodeSamples(current);
  while (encoded.length > GHOST_MAX_CHARS) {
    if (current.intervalMs * 2 > 1000) return null;
    current = thin(current);
    encoded = encodeSamples(current);
  }
  return encoded;
}

/** A ghost from {@link encodeGhost}, or null when it is corrupt. Never throws. */
export function decodeGhost(encoded: unknown): GhostTrack | null {
  if (typeof encoded !== "string" || encoded.length > GHOST_MAX_CHARS) {
    return null;
  }
  const parts = encoded.split(":");
  if (parts.length !== 5 || parts[0] !== FORMAT) return null;
  const intervalMs = fromB36(parts[1]);
  const timeMs = fromB36(parts[2]);
  if (
    !Number.isFinite(intervalMs) ||
    !Number.isFinite(timeMs) ||
    intervalMs <= 0 ||
    timeMs < 0
  ) {
    return null;
  }
  const lapEndsMs = parts[3] === "" ? [] : parts[3].split(".").map(fromB36);
  if (lapEndsMs.some((ms) => !Number.isFinite(ms) || ms < 0)) return null;
  const samples: GhostSample[] = [];
  let d = 0;
  let y = 0;
  let mode = -1;
  for (const token of parts[4] === "" ? [] : parts[4].split(",")) {
    if (token.startsWith("m")) {
      mode = fromB36(token.slice(1));
      if (!(mode >= 0)) return null;
      continue;
    }
    const pair = token.split("/");
    if (pair.length !== 2 || mode < 0) return null;
    const dd = fromB36(pair[0]);
    const dy = fromB36(pair[1]);
    if (!Number.isFinite(dd) || !Number.isFinite(dy)) return null;
    d += dd;
    y += dy;
    const power = POWERS[(mode >> 7) & 7];
    if (!power) return null;
    samples.push({
      d: d / 10,
      y,
      stage: mode >> 10,
      power,
      flags: mode & 127,
    });
  }
  if (samples.length === 0) return null;
  return { intervalMs, samples, lapEndsMs, timeMs };
}

/**
 * The ghost at run clock `clockMs`: distance and height eased between the two
 * samples around it, and the stage, power and pose of the earlier one. Null
 * before the start or after the ghost's finish, when it is no longer drawn.
 */
export function ghostAt(
  track: GhostTrack,
  clockMs: number
): GhostSample | null {
  if (!Number.isFinite(clockMs) || clockMs < 0 || clockMs > track.timeMs) {
    return null;
  }
  const at = clockMs / track.intervalMs;
  const i = Math.floor(at);
  const a = track.samples[i];
  if (!a) return null;
  const b = track.samples[i + 1];
  // A jump between stages or into a room is a cut, not a slide.
  if (!b || b.stage !== a.stage || (b.flags ^ a.flags) & GHOST_FLAG.room) {
    return a;
  }
  const f = at - i;
  return { ...a, d: a.d + (b.d - a.d) * f, y: a.y + (b.y - a.y) * f };
}

/** The furthest distance each sample had reached, so a lost life never moves it back. */
function furthest(track: GhostTrack): number[] {
  const out: number[] = [];
  let best = Number.NEGATIVE_INFINITY;
  for (const s of track.samples) {
    best = Math.max(best, s.d);
    out.push(best);
  }
  return out;
}

const furthestCache = new WeakMap<GhostTrack, number[]>();

/**
 * The run-clock gap to the ghost, in ms: positive when the runner is behind
 * (the ghost reached `progressMeters` that long before `clockMs`), negative
 * when ahead. `progressMeters` is the furthest distance the runner has
 * reached. Null when the ghost never got that far.
 */
export function ghostGapMs(
  track: GhostTrack,
  progressMeters: number,
  clockMs: number
): number | null {
  let reach = furthestCache.get(track);
  if (!reach) {
    reach = furthest(track);
    furthestCache.set(track, reach);
  }
  if (!Number.isFinite(progressMeters) || !Number.isFinite(clockMs)) {
    return null;
  }
  if (reach.length === 0 || progressMeters > reach[reach.length - 1]) {
    return null;
  }
  // The first sample at or past the distance, then ease back to it.
  let lo = 0;
  let hi = reach.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (reach[mid] >= progressMeters) hi = mid;
    else lo = mid + 1;
  }
  let t = lo * track.intervalMs;
  if (lo > 0 && reach[lo] > reach[lo - 1]) {
    const f = (reach[lo] - progressMeters) / (reach[lo] - reach[lo - 1]);
    t -= f * track.intervalMs;
  }
  return clockMs - t;
}

/** The gap at the end of lap `lap` (1-based) at run clock `clockMs`, or null when the ghost has no such lap. */
export function lapGapMs(
  track: GhostTrack,
  lap: number,
  clockMs: number
): number | null {
  const end = track.lapEndsMs[lap - 1];
  return end === undefined ? null : clockMs - end;
}

/** A gap as `+0:02.4` (behind) or `-0:01.1` (ahead), to the tenth of a second. */
export function formatGap(ms: number): string {
  const tenths = Math.round(Math.abs(ms) / 100);
  const sign = ms < 0 && tenths > 0 ? "-" : "+";
  const m = Math.floor(tenths / 600);
  const s = Math.floor((tenths % 600) / 10);
  return `${sign}${m}:${String(s).padStart(2, "0")}.${tenths % 10}`;
}
