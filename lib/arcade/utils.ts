/** Shared, deterministic math and scoring utilities for arcade games. */

import { clamp } from "../utils/number-format";

export { clamp };

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type BoundingBox = Rect;

export interface MultiplierOptions {
  baseMultiplier?: number;
  step?: number;
  maxMultiplier?: number;
}

/** Linearly interpolates between start and end by progress, clamped between 0 and 1. */
export const lerp = (start: number, end: number, progress: number): number =>
  start + (end - start) * clamp(progress, 0, 1);

/** Evaluates whether two 2D bounding boxes overlap. */
export const boundingBoxOverlap = (first: Rect, second: Rect): boolean =>
  first.x < second.x + second.width &&
  first.x + first.width > second.x &&
  first.y < second.y + second.height &&
  first.y + first.height > second.y;

/** Legacy alias for boundingBoxOverlap. */
export const rectanglesOverlap = boundingBoxOverlap;

/** Creates a repeatable PRNG producing deterministic floats in [0, 1). */
export const createSeededRandom = (seed: number): (() => number) => {
  let state = seed >>> 0;

  return (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

/** Calculates score multiplier based on combo count and options. */
export const calculateScoreMultiplier = (
  combo: number,
  options: MultiplierOptions = {}
): number => {
  const { baseMultiplier = 1, step = 3, maxMultiplier = 10 } = options;
  const safeStep = Math.max(1, Math.floor(Number.isFinite(step) ? step : 1));
  const safeBase = Number.isFinite(baseMultiplier)
    ? Math.max(0, baseMultiplier)
    : 1;
  const safeMax = Number.isFinite(maxMultiplier)
    ? Math.max(safeBase, maxMultiplier)
    : Infinity;

  if (Number.isNaN(combo) || combo <= 0) {
    return safeBase;
  }
  if (!Number.isFinite(combo)) {
    return safeMax;
  }

  const safeCombo = Math.floor(combo);
  const multiplier = safeBase + Math.floor(safeCombo / safeStep);
  return Math.min(safeMax, multiplier);
};

/** Scales base score by multiplier with optional integer rounding. */
export const scaleScoreWithMultiplier = (
  baseScore: number,
  multiplier: number,
  round = true
): number => {
  const safeScore = Number.isFinite(baseScore) ? Math.max(0, baseScore) : 0;
  const safeMultiplier = Number.isFinite(multiplier)
    ? Math.max(0, multiplier)
    : 1;
  const scaled = safeScore * safeMultiplier;
  return round ? Math.round(scaled) : scaled;
};
