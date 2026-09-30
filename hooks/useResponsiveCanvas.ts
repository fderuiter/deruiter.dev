"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { clamp } from "@/lib/game-utils";

export interface UseResponsiveCanvasOptions {
  canvasRef?: React.RefObject<HTMLCanvasElement | null> | null;
  canvas?: HTMLCanvasElement | null;
  internalWidth: number;
  internalHeight: number;
  maxDpr?: number;
  enableContextLossRecovery?: boolean;
  onResize?: (info: {
    width: number;
    height: number;
    dpr: number;
    scaleX: number;
    scaleY: number;
  }) => void;
  onContextLost?: (event: Event) => void;
  onContextRestored?: (event: Event) => void;
}

export interface UseResponsiveCanvasReturn {
  dpr: number;
  dimensions: { width: number; height: number };
  isContextLost: boolean;
  recoveryCount: number;
  toGameCoordinates: (
    clientX: number,
    clientY: number
  ) => { x: number; y: number; inBounds: boolean };
  bindCanvas: (canvasElement: HTMLCanvasElement | null) => void;
}

/**
 * Hook for managing responsive HTML5 2D and WebGL canvas lifecycles in arcade games.
 * Handles device pixel ratio (DPR) clamping, coordinate normalization without division-by-zero,
 * debounced resize listeners, and 2D/WebGL context loss and recovery.
 */
export function useResponsiveCanvas(
  options: UseResponsiveCanvasOptions
): UseResponsiveCanvasReturn {
  const {
    canvasRef,
    canvas: directCanvas,
    internalWidth,
    internalHeight,
    maxDpr = 2.0,
    enableContextLossRecovery = true,
    onResize,
    onContextLost,
    onContextRestored,
  } = options;

  const [isContextLost, setIsContextLost] = useState<boolean>(false);
  const [recoveryCount, setRecoveryCount] = useState<number>(0);
  const [activeCanvas, setActiveCanvas] = useState<HTMLCanvasElement | null>(null);

  const canvasRefInternal = useRef<HTMLCanvasElement | null>(null);
  const onResizeRef = useRef(onResize);
  const onContextLostRef = useRef(onContextLost);
  const onContextRestoredRef = useRef(onContextRestored);

  useEffect(() => {
    onResizeRef.current = onResize;
    onContextLostRef.current = onContextLost;
    onContextRestoredRef.current = onContextRestored;
  }, [onResize, onContextLost, onContextRestored]);

  // Compute clamped DPR
  const dpr = typeof window !== "undefined"
    ? // A maxDpr below 1 wins over the 1x floor, as it always has.
      clamp(window.devicePixelRatio || 1, Math.min(1, maxDpr), maxDpr)
    : 1;

  const bindCanvas = useCallback((canvasElement: HTMLCanvasElement | null) => {
    canvasRefInternal.current = canvasElement;
    setActiveCanvas(canvasElement);
  }, []);

  useEffect(() => {
    const target = directCanvas || canvasRef?.current || null;
    if (target && target !== canvasRefInternal.current) {
      bindCanvas(target);
    }
  }, [directCanvas, canvasRef, bindCanvas]);

  // Context loss event handling
  useEffect(() => {
    const canvasEl = activeCanvas || directCanvas || canvasRef?.current || null;
    if (!canvasEl || !enableContextLossRecovery) return;

    const handleContextLost = (e: Event) => {
      if (e.cancelable) {
        e.preventDefault();
      }
      setIsContextLost(true);
      onContextLostRef.current?.(e);
    };

    const handleContextRestored = (e: Event) => {
      setIsContextLost(false);
      setRecoveryCount((c) => c + 1);
      onContextRestoredRef.current?.(e);
    };

    canvasEl.addEventListener("contextlost", handleContextLost);
    canvasEl.addEventListener("contextrestored", handleContextRestored);

    return () => {
      canvasEl.removeEventListener("contextlost", handleContextLost);
      canvasEl.removeEventListener("contextrestored", handleContextRestored);
    };
  }, [activeCanvas, directCanvas, canvasRef, enableContextLossRecovery]);

  // Resize and coordinate transformation
  const toGameCoordinates = useCallback(
    (clientX: number, clientY: number): { x: number; y: number; inBounds: boolean } => {
      const canvasEl = canvasRefInternal.current || directCanvas || canvasRef?.current || null;
      if (!canvasEl) {
        return { x: 0, y: 0, inBounds: false };
      }

      const rect = canvasEl.getBoundingClientRect();
      const safeWidth = Math.max(1, rect.width);
      const safeHeight = Math.max(1, rect.height);

      const scaleX = internalWidth / safeWidth;
      const scaleY = internalHeight / safeHeight;

      const x = (clientX - rect.left) * scaleX;
      const y = (clientY - rect.top) * scaleY;

      const inBounds = x >= 0 && x <= internalWidth && y >= 0 && y <= internalHeight;

      return { x, y, inBounds };
    },
    [directCanvas, canvasRef, internalWidth, internalHeight]
  );

  return {
    dpr,
    dimensions: { width: internalWidth, height: internalHeight },
    isContextLost,
    recoveryCount,
    toGameCoordinates,
    bindCanvas,
  };
}
