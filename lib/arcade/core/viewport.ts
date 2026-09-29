/**
 * Arcade Viewport & Coordinate Transformation Engine.
 * Manages DPR scaling, Safe Zone matrix centering with bleed, integer letterboxing,
 * and defensive coordinate inverse math with zero division-by-zero risk.
 */

import { clamp } from "../utils";

export type ViewportMode = "safe-zone" | "integer-letterbox";

export interface ViewportConfig {
  mode: ViewportMode;
  baseWidth: number;
  baseHeight: number;
  maxDpr?: number;
}

export interface ViewportMetrics {
  dpr: number;
  scale: number;
  offsetX: number;
  offsetY: number;
  internalWidth: number;
  internalHeight: number;
  canvasWidth: number;
  canvasHeight: number;
  bleedWidth: number;
  bleedHeight: number;
}

export interface GamePoint {
  x: number;
  y: number;
}

export class ArcadeViewport {
  private readonly mode: ViewportMode;
  private readonly baseWidth: number;
  private readonly baseHeight: number;
  private readonly maxDpr: number;

  constructor(config: ViewportConfig) {
    this.mode = config.mode;
    this.baseWidth = Math.max(1, config.baseWidth);
    this.baseHeight = Math.max(1, config.baseHeight);
    this.maxDpr = config.maxDpr ?? 2.0;
  }

  /**
   * Calculates viewport metrics based on container dimensions and physical pixel ratio.
   */
  public calculateMetrics(
    containerWidth: number,
    containerHeight: number,
    rawDpr = 1.0
  ): ViewportMetrics {
    // The 1x floor wins over a configured maxDpr below 1, as it always has.
    const dpr = clamp(rawDpr || 1.0, 1.0, Math.max(1.0, this.maxDpr));
    const width = Math.max(1, containerWidth);
    const height = Math.max(1, containerHeight);

    if (this.mode === "integer-letterbox") {
      const fitRatio = Math.min(
        width / this.baseWidth,
        height / this.baseHeight
      );
      const scale = Math.max(1, Math.floor(fitRatio));
      const canvasWidth = this.baseWidth * scale;
      const canvasHeight = this.baseHeight * scale;
      const offsetX = Math.max(0, (width - canvasWidth) / 2);
      const offsetY = Math.max(0, (height - canvasHeight) / 2);

      return {
        dpr,
        scale,
        offsetX,
        offsetY,
        internalWidth: canvasWidth * dpr,
        internalHeight: canvasHeight * dpr,
        canvasWidth,
        canvasHeight,
        bleedWidth: this.baseWidth,
        bleedHeight: this.baseHeight,
      };
    }

    // Safe Zone with dynamic bleed
    const scale = Math.min(width / this.baseWidth, height / this.baseHeight);
    const offsetX = Math.max(0, (width - this.baseWidth * scale) / 2);
    const offsetY = Math.max(0, (height - this.baseHeight * scale) / 2);

    const bleedWidth = width / Math.max(0.0001, scale);
    const bleedHeight = height / Math.max(0.0001, scale);

    return {
      dpr,
      scale,
      offsetX,
      offsetY,
      internalWidth: width * dpr,
      internalHeight: height * dpr,
      canvasWidth: width,
      canvasHeight: height,
      bleedWidth,
      bleedHeight,
    };
  }

  /**
   * Applies the transformation matrix to a 2D canvas context.
   */
  public applyTransform(
    ctx: CanvasRenderingContext2D,
    metrics: ViewportMetrics
  ): void {
    if (!ctx || typeof ctx.setTransform !== "function") return;

    if (this.mode === "integer-letterbox") {
      ctx.setTransform(metrics.dpr, 0, 0, metrics.dpr, 0, 0);
      return;
    }

    ctx.setTransform(
      metrics.scale * metrics.dpr,
      0,
      0,
      metrics.scale * metrics.dpr,
      metrics.offsetX * metrics.dpr,
      metrics.offsetY * metrics.dpr
    );
  }
}

/**
 * Defensively translates client mouse/pointer coordinates to logical game safe zone coordinates.
 */
export function screenToGameCoords(
  clientX: number,
  clientY: number,
  rect: DOMRect | { left: number; top: number; width: number; height: number },
  metrics: ViewportMetrics
): GamePoint {
  const safeScale = Math.max(0.0001, metrics.scale);
  const rawX = clientX - (rect.left || 0);
  const rawY = clientY - (rect.top || 0);

  const gameX = (rawX - metrics.offsetX) / safeScale;
  const gameY = (rawY - metrics.offsetY) / safeScale;

  return {
    x: Number.isFinite(gameX) ? gameX : 0,
    y: Number.isFinite(gameY) ? gameY : 0,
  };
}

/** Highest device pixel ratio a game canvas renders at; beyond 2x the GPU cost outweighs the visible gain. */
export const MAX_CANVAS_DPR = 2;

/** Backing-store size for a canvas that draws in fixed logical units. */
export interface CanvasResolution {
  /** Backing-store pixels per logical unit; the drawing context is scaled by this once per frame. */
  scale: number;
  /** Backing-store width in device pixels. */
  width: number;
  /** Backing-store height in device pixels. */
  height: number;
}

/**
 * Sizes a canvas backing store to the device pixels it is displayed at, so
 * text and vector art stay sharp on HiDPI screens while game logic keeps
 * working in logical units. The scale never drops below 1, so a canvas
 * shown smaller than its logical size keeps its full detail, and the device
 * pixel ratio is capped at `maxDpr`. Degenerate inputs fall back to the
 * logical size.
 */
export function computeCanvasResolution(
  logicalWidth: number,
  logicalHeight: number,
  cssWidth: number,
  devicePixelRatio: number,
  maxDpr: number = MAX_CANVAS_DPR
): CanvasResolution {
  const baseWidth =
    Number.isFinite(logicalWidth) && logicalWidth >= 1
      ? Math.round(logicalWidth)
      : 1;
  const baseHeight =
    Number.isFinite(logicalHeight) && logicalHeight >= 1
      ? Math.round(logicalHeight)
      : 1;
  const cap = Number.isFinite(maxDpr) && maxDpr >= 1 ? maxDpr : 1;
  const dpr = Number.isFinite(devicePixelRatio)
    ? clamp(devicePixelRatio, 1, cap)
    : 1;
  const displayWidth = Number.isFinite(cssWidth) && cssWidth > 0 ? cssWidth : 0;
  const width = Math.max(baseWidth, Math.round(displayWidth * dpr));
  const scale = width / baseWidth;
  return { scale, width, height: Math.max(1, Math.round(baseHeight * scale)) };
}

/**
 * Scales a 2D context so drawing in logical units fills a backing store sized
 * by `computeCanvasResolution`. Replaces any earlier transform; a context
 * without `setTransform` (a minimal test double) is left untouched.
 */
export function applyCanvasScale(
  ctx: CanvasRenderingContext2D,
  scale: number
): void {
  if (typeof ctx.setTransform !== "function") return;
  const s = Number.isFinite(scale) && scale > 0 ? scale : 1;
  ctx.setTransform(s, 0, 0, s, 0, 0);
}
