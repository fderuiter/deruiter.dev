/**
 * Stage fit (#2358): the one sizing rule for an arcade canvas inside a stage
 * slot. It replaces the per-game fits (Retro Labyrinth's integer and fill
 * boxes, `computeCanvasResolution` plus a ResizeObserver, `fitRoomToStage`)
 * with a pure function the `useStageFit` hook calls on each measured change.
 *
 * Everything here is pure and total: zero, negative and non-finite input
 * returns an empty or 1x box, never NaN.
 */

import {
  MAX_CANVAS_DPR,
  screenToGameCoords,
  type ViewportMetrics,
} from "./viewport";

/** The game's logical size, in game units. Its ratio is the stage aspect. */
export interface StageAspect {
  width: number;
  height: number;
}

/**
 * How the box is snapped.
 *
 * - `integer`: each game unit is a whole number of device pixels, the largest
 *   that fits. Pixel art stays free of uneven pixels and blur.
 * - `fractional`: the largest box that fits, its CSS width snapped to the
 *   smallest step that keeps the height a whole number of pixels too.
 */
export type StageScaleMode = "integer" | "fractional";

/** Options for {@link computeStageFit}. */
export interface StageFitOptions {
  /** The game's logical size. */
  aspect: StageAspect;
  /** How the box is snapped. */
  scale: StageScaleMode;
  /**
   * Highest device pixel ratio the backing store is sized for. Defaults to
   * `MAX_CANVAS_DPR` (2). `Infinity` follows the device.
   */
  maxDpr?: number;
  /**
   * Fewest backing-store pixels per game unit. A slot too small for it shows
   * the canvas shrunk rather than with less detail. In `integer` mode it is
   * rounded up and never below 1; in `fractional` mode it defaults to 0, so
   * the backing store follows the box.
   */
  minScale?: number;
}

/** A measured stage slot, in CSS pixels. */
export interface StageSlot {
  width: number;
  height: number;
}

/** Where the canvas goes and how big its backing store is. */
export interface StageFit {
  /** CSS size the canvas is shown at. Never larger than the slot. */
  cssWidth: number;
  cssHeight: number;
  /** Backing-store size, in device pixels. */
  backingWidth: number;
  backingHeight: number;
  /** Backing-store pixels per game unit (a whole number in `integer` mode). */
  scale: number;
  /** The device pixel ratio after the cap. */
  dpr: number;
  /** The CSS width step the box snapped to (`fractional` mode), or 0. */
  step: number;
}

/** A point in game units, and whether it lies on the game. */
export interface StagePoint {
  x: number;
  y: number;
  /** True when the point is inside the game's logical bounds. */
  inside: boolean;
}

/** A client rectangle: a `DOMRect` or the part of one that matters here. */
export interface StageRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** The largest CSS width step worth snapping to; wider steps fall back to 1px. */
const MAX_SNAP_STEP = 32;

/** A hair of tolerance, so a slot that is exactly 3x does not round to 2x. */
const SCALE_EPSILON = 1e-6;

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function nonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function greatestCommonDivisor(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y > 0) {
    [x, y] = [y, x % y];
  }
  return x;
}

/** The logical size, made safe: at least 1 unit each way. */
function safeAspect(aspect: StageAspect): StageAspect {
  const width = finiteOr(aspect.width, 0);
  const height = finiteOr(aspect.height, 0);
  return {
    width: width > 0 ? width : 1,
    height: height > 0 ? height : 1,
  };
}

/**
 * The smallest whole CSS width whose height at this aspect is also whole: 5
 * for a 240x144 (5:3) game. A whole-unit aspect with a step above 32px, or a
 * fractional one, snaps to 1px instead, and its height keeps the exact ratio.
 *
 * @param aspect - The game's logical size.
 * @returns The width step, in CSS pixels.
 */
export function stageSnapStep(aspect: StageAspect): number {
  const { width, height } = safeAspect(aspect);
  if (!Number.isInteger(width) || !Number.isInteger(height)) return 1;
  const step = width / greatestCommonDivisor(width, height);
  return step <= MAX_SNAP_STEP ? step : 1;
}

/**
 * The device pixel ratio after the cap. A missing or invalid ratio is 1, and
 * an invalid cap is `MAX_CANVAS_DPR`. There is no 1x floor: a page zoomed out
 * below 1 keeps its real ratio, as Retro Labyrinth's fit always did.
 *
 * @param devicePixelRatio - The window's ratio.
 * @param maxDpr - The cap.
 * @returns The ratio the backing store is sized for.
 */
export function capStageDpr(
  devicePixelRatio: number,
  maxDpr: number = MAX_CANVAS_DPR
): number {
  const cap =
    maxDpr === Number.POSITIVE_INFINITY ||
    (Number.isFinite(maxDpr) && maxDpr > 0)
      ? maxDpr
      : MAX_CANVAS_DPR;
  const dpr =
    Number.isFinite(devicePixelRatio) && devicePixelRatio > 0
      ? devicePixelRatio
      : 1;
  return Math.min(dpr, cap);
}

/** The largest box at the aspect that fits the slot, in CSS pixels. */
function containBox(
  slotWidth: number,
  slotHeight: number,
  aspect: StageAspect
): { width: number; height: number } {
  const width = Math.min(
    slotWidth,
    (slotHeight * aspect.width) / aspect.height
  );
  return {
    width,
    height: Math.min(slotHeight, (width * aspect.height) / aspect.width),
  };
}

function integerFit(
  slotWidth: number,
  slotHeight: number,
  aspect: StageAspect,
  dpr: number,
  minScale: number
): StageFit {
  const floor = Math.max(1, Math.ceil(finiteOr(minScale, 1)));
  const fit = Math.min(
    (slotWidth * dpr) / aspect.width,
    (slotHeight * dpr) / aspect.height
  );
  const scale = Math.max(floor, Math.floor(fit + SCALE_EPSILON));
  const backingWidth = Math.round(aspect.width * scale);
  const backingHeight = Math.round(aspect.height * scale);
  // The whole-pixel box fits: show it at one backing pixel per device pixel.
  // Otherwise (the floor, or a slot a hair short of the scale) keep the
  // detail and shrink the box into the slot.
  const fits = fit >= scale;
  const box = fits
    ? { width: backingWidth / dpr, height: backingHeight / dpr }
    : containBox(slotWidth, slotHeight, aspect);
  return {
    cssWidth: Math.min(slotWidth, box.width),
    cssHeight: Math.min(slotHeight, box.height),
    backingWidth,
    backingHeight,
    scale,
    dpr,
    step: 0,
  };
}

function fractionalFit(
  slotWidth: number,
  slotHeight: number,
  aspect: StageAspect,
  dpr: number,
  minScale: number
): StageFit {
  const step = stageSnapStep(aspect);
  const fitWidth = containBox(slotWidth, slotHeight, aspect).width;
  const cssWidth = Math.max(0, Math.floor(fitWidth / step) * step);
  const cssHeight = Math.min(
    slotHeight,
    (cssWidth * aspect.height) / aspect.width
  );
  const floorWidth = Math.ceil(
    Math.max(0, finiteOr(minScale, 0)) * aspect.width
  );
  const naturalWidth = Math.round(cssWidth * dpr);
  // The backing store follows the box, unless the floor asks for more detail.
  const backingWidth = Math.max(naturalWidth, floorWidth);
  const backingHeight =
    backingWidth === naturalWidth
      ? Math.round(cssHeight * dpr)
      : Math.round((backingWidth * aspect.height) / aspect.width);
  return {
    cssWidth,
    cssHeight,
    backingWidth,
    backingHeight,
    scale: backingWidth / aspect.width,
    dpr,
    step,
  };
}

/**
 * Fits a game of the given aspect into a stage slot: the largest CSS box at
 * that aspect that fits, snapped by the scale mode, and the backing-store size
 * at the capped device pixel ratio.
 *
 * @param slot - The measured slot, in CSS pixels.
 * @param devicePixelRatio - The window's device pixel ratio.
 * @param options - Aspect, scale mode, DPR cap and scale floor.
 * @returns The box and backing store. The box never exceeds the slot.
 */
export function computeStageFit(
  slot: StageSlot,
  devicePixelRatio: number,
  options: StageFitOptions
): StageFit {
  const aspect = safeAspect(options.aspect);
  const width = nonNegative(slot.width);
  const height = nonNegative(slot.height);
  const dpr = capStageDpr(devicePixelRatio, options.maxDpr);
  return options.scale === "integer"
    ? integerFit(width, height, aspect, dpr, options.minScale ?? 1)
    : fractionalFit(width, height, aspect, dpr, options.minScale ?? 0);
}

/**
 * The viewport metrics `screenToGameCoords` reads for a canvas shown at
 * `rect`: one scale for both axes, since the box keeps the aspect.
 *
 * @param rect - Where the canvas is shown, in client pixels.
 * @param aspect - The game's logical size.
 * @param dpr - The device pixel ratio (only carried along).
 * @returns Metrics with no offset; the rect already starts at the game.
 */
export function stageViewportMetrics(
  rect: StageRect,
  aspect: StageAspect,
  dpr = 1
): ViewportMetrics {
  const logical = safeAspect(aspect);
  const width = nonNegative(rect.width);
  const height = nonNegative(rect.height);
  return {
    dpr,
    scale: width / logical.width,
    offsetX: 0,
    offsetY: 0,
    internalWidth: width * dpr,
    internalHeight: height * dpr,
    canvasWidth: width,
    canvasHeight: height,
    bleedWidth: logical.width,
    bleedHeight: logical.height,
  };
}

/**
 * Maps a pointer's client position to game units on a canvas shown at
 * `rect` (its `getBoundingClientRect()`).
 *
 * @param clientX - Pointer x, in client pixels.
 * @param clientY - Pointer y, in client pixels.
 * @param rect - Where the canvas is shown.
 * @param aspect - The game's logical size.
 * @returns The game point, or null when the rect is empty.
 */
export function mapClientToStage(
  clientX: number,
  clientY: number,
  rect: StageRect,
  aspect: StageAspect
): StagePoint | null {
  if (!(rect.width > 0) || !(rect.height > 0)) return null;
  const logical = safeAspect(aspect);
  const { x, y } = screenToGameCoords(
    finiteOr(clientX, 0),
    finiteOr(clientY, 0),
    rect,
    stageViewportMetrics(rect, logical)
  );
  return {
    x,
    y,
    inside: x >= 0 && y >= 0 && x < logical.width && y < logical.height,
  };
}

/**
 * Maps a game point to client pixels on a canvas shown at `rect`, to place
 * DOM overlays over the game.
 *
 * @param gameX - X, in game units.
 * @param gameY - Y, in game units.
 * @param rect - Where the canvas is shown.
 * @param aspect - The game's logical size.
 * @returns The client position, or null when the rect is empty.
 */
export function mapStageToClient(
  gameX: number,
  gameY: number,
  rect: StageRect,
  aspect: StageAspect
): { x: number; y: number } | null {
  if (!(rect.width > 0) || !(rect.height > 0)) return null;
  const scale = rect.width / safeAspect(aspect).width;
  return {
    x: (rect.left || 0) + finiteOr(gameX, 0) * scale,
    y: (rect.top || 0) + finiteOr(gameY, 0) * scale,
  };
}
