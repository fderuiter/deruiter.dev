"use client";

import { useEffect, useRef } from "react";
import { computeCanvasResolution, MAX_CANVAS_DPR } from "@/lib/arcade";

export interface UseCanvasResolutionOptions {
  /** Canvas whose backing store is sized. */
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  /** Width of the coordinate space the game draws in. */
  logicalWidth: number;
  /** Height of the coordinate space the game draws in. */
  logicalHeight: number;
  /** False while the canvas is not rendered yet, e.g. before hydration. Defaults to true. */
  active?: boolean;
  /** Highest device pixel ratio honoured. Defaults to 2. */
  maxDpr?: number;
  /** Called after a resize, which clears the bitmap, so a paused game can redraw. */
  onResize?: (scale: number) => void;
}

/**
 * Keeps a game canvas's backing store matched to its displayed size times the
 * device pixel ratio, observing width changes only. Returns a ref holding the
 * current scale; render loops call `ctx.setTransform(scale, 0, 0, scale, 0, 0)`
 * before each frame so drawing and hit-testing stay in logical units.
 */
export function useCanvasResolution({
  canvasRef,
  logicalWidth,
  logicalHeight,
  active = true,
  maxDpr = MAX_CANVAS_DPR,
  onResize,
}: UseCanvasResolutionOptions): React.RefObject<number> {
  const scaleRef = useRef(1);
  const onResizeRef = useRef(onResize);

  useEffect(() => {
    onResizeRef.current = onResize;
  }, [onResize]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!active || !canvas) return;
    let lastWidth = -1;

    const apply = (cssWidth: number) => {
      const width = Math.floor(cssWidth);
      if (width === lastWidth) return;
      lastWidth = width;
      const next = computeCanvasResolution(
        logicalWidth,
        logicalHeight,
        width,
        window.devicePixelRatio,
        maxDpr
      );
      scaleRef.current = next.scale;
      if (canvas.width !== next.width || canvas.height !== next.height) {
        canvas.width = next.width;
        canvas.height = next.height;
        onResizeRef.current?.(next.scale);
      }
    };

    apply(canvas.getBoundingClientRect().width);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) apply(entry.contentRect.width);
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [active, canvasRef, logicalWidth, logicalHeight, maxDpr]);

  return scaleRef;
}
