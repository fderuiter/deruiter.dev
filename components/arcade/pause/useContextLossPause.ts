"use client";

import { useEffect } from "react";
import { createContextLossManager } from "@/lib/webgl/context-manager";
import { useCabinetPauseController } from "./CabinetPause";

/**
 * Pauses the cabinet with reason `hidden` when the canvas loses its WebGL or
 * 2D context, through `lib/webgl/context-manager.ts` (#2357). The run waits
 * for Resume, as after any automatic pause, so it does not restart under a
 * context that is still being restored. A view calls this with the canvas it
 * owns; the session never holds the canvas (ADR 0062).
 *
 * @param canvas - The view's canvas, or null before it mounts.
 */
export function useContextLossPause(canvas: HTMLCanvasElement | null): void {
  const controller = useCabinetPauseController();
  useEffect(() => {
    if (!canvas) return;
    const manager = createContextLossManager({
      canvas,
      onContextLost: () => controller.pause("hidden"),
    });
    return () => manager.dispose();
  }, [canvas, controller]);
}
