/**
 * Pure geometry for the Meme Vault sampler face: pad key mapping, the
 * completion ring and the oscilloscope trace. Kept free of React and the DOM
 * so the drawing maths can be unit tested on its own.
 */

import { clamp } from "@/lib/game-utils";

/** Number of pads on the sampler face, played with keys 1 to 8. */
export const PAD_COUNT = 8;

/**
 * Maps a keyboard `key` value to a pad index. Keys "1" to "8" (top row or
 * numpad, which report the same `key`) select pads 0 to 7; anything else is
 * null.
 */
export function padIndexForKey(key: string): number | null {
  if (key.length !== 1) return null;
  const digit = key.charCodeAt(0) - 48;
  if (digit < 1 || digit > PAD_COUNT) return null;
  return digit - 1;
}

/** The key-cap label printed on a pad: "1" for the first pad. */
export function padKeyLabel(index: number): string {
  return String(index + 1);
}

export interface RingDash {
  circumference: number;
  /** `stroke-dashoffset` that leaves `progress` of the ring drawn. */
  dashOffset: number;
  /** Progress clamped to 0..1. */
  progress: number;
}

/**
 * Stroke dash values for a progress ring of the given radius. Progress is the
 * unlocked fraction; NaN, negative and over-full values clamp to 0..1, and an
 * empty set (0 of 0) reads as 0.
 */
export function ringDash(
  unlocked: number,
  total: number,
  radius: number
): RingDash {
  const circumference = 2 * Math.PI * Math.max(0, radius);
  const raw = total > 0 ? unlocked / total : 0;
  const progress = Number.isFinite(raw) ? clamp(raw, 0, 1) : 0;
  return {
    circumference,
    dashOffset: circumference * (1 - progress),
    progress,
  };
}

/**
 * Finds a rising zero crossing in the first half of a time-domain buffer, the
 * way a hardware scope's trigger holds a periodic wave still from frame to
 * frame. Returns 0 when there is none (silence, noise that never crosses).
 */
export function findTriggerIndex(samples: ArrayLike<number>): number {
  const limit = Math.floor(samples.length / 2);
  for (let i = 1; i < limit; i++) {
    if (samples[i - 1] < 0 && samples[i] >= 0) return i;
  }
  return 0;
}

/** Largest vertical gain the scope's auto-range applies. */
export const MAX_SCOPE_GAIN = 8;

/**
 * Auto-range for the scope, like a hardware scope's volts-per-division knob
 * set for you: the gain that puts the buffer's peak at 85% of full scale,
 * between 1 and {@link MAX_SCOPE_GAIN}. Quiet synth output still draws a
 * readable wave, and silence stays flat rather than amplifying noise.
 */
export function scopeGain(samples: ArrayLike<number>): number {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const v = Math.abs(Number(samples[i]) || 0);
    if (v > peak) peak = v;
  }
  if (peak < 1e-4) return 1;
  return clamp(0.85 / peak, 1, MAX_SCOPE_GAIN);
}

export interface ScopePoint {
  x: number;
  y: number;
}

/**
 * Maps a window of time-domain samples (-1..1) onto a trace across a canvas
 * of `width` by `height` CSS pixels. The window starts at the trigger and is
 * half the buffer long, decimated to at most one point per pixel. Samples
 * outside -1..1 clip to the top and bottom of the trace area, which is inset
 * by `inset` pixels. `gain` scales the samples first (see scopeGain).
 */
export function scopeTrace(
  samples: ArrayLike<number>,
  width: number,
  height: number,
  inset = 4,
  gain = 1
): ScopePoint[] {
  if (samples.length < 2 || width <= 0 || height <= 0) return [];
  const start = findTriggerIndex(samples);
  const span = Math.max(2, Math.floor(samples.length / 2));
  const end = Math.min(samples.length, start + span);
  const count = end - start;
  const steps = clamp(Math.floor(width), 2, Math.max(2, count));
  const mid = height / 2;
  const amp = Math.max(0, mid - inset);
  const points: ScopePoint[] = [];
  for (let p = 0; p < steps; p++) {
    const idx = start + Math.floor((p * (count - 1)) / (steps - 1));
    const v = clamp((Number(samples[idx]) || 0) * gain, -1, 1);
    points.push({
      x: (p * width) / (steps - 1),
      y: mid - v * amp,
    });
  }
  return points;
}

/**
 * Positions of the graticule's vertical and horizontal division lines,
 * aligned to half pixels so one-pixel hairlines stay crisp.
 */
export function graticuleLines(
  width: number,
  height: number,
  columns = 10,
  rows = 4
): { xs: number[]; ys: number[] } {
  const xs: number[] = [];
  const ys: number[] = [];
  for (let c = 1; c < columns; c++) {
    xs.push(Math.round((c * width) / columns) + 0.5);
  }
  for (let r = 1; r < rows; r++) {
    ys.push(Math.round((r * height) / rows) + 0.5);
  }
  return { xs, ys };
}
