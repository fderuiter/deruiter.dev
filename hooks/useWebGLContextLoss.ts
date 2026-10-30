"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  createContextLossManager,
  ContextLossStatus,
  ContextLossManager,
} from "@/lib/webgl/context-manager";
import { useOptionalAnnouncer } from "@/hooks/useAnnouncer";

export interface UseWebGLContextLossOptions {
  canvasRef?: React.RefObject<HTMLCanvasElement | null> | null;
  canvas?: HTMLCanvasElement | null;
  onContextLost?: (event: Event) => void;
  onContextRestored?: (event: Event) => void;
  label?: string;
  autoResetIdleDelayMs?: number;
}

export interface UseWebGLContextLossReturn {
  status: ContextLossStatus;
  isLost: boolean;
  recoveryCount: number;
  triggerSimulation: (restoreDelayMs?: number) => boolean;
  bindCanvas: (canvasElement: HTMLCanvasElement | null) => void;
}

/**
 * Hook for managing WebGL and Canvas 2D context loss and restoration lifecycles.
 * Handles event listener binding, preventDefault invocation, screen reader notifications,
 * and state synchronization across GPU power state switches and mobile suspension.
 */
export function useWebGLContextLoss(
  options: UseWebGLContextLossOptions = {}
): UseWebGLContextLossReturn {
  const {
    canvasRef,
    canvas: directCanvas,
    onContextLost,
    onContextRestored,
    label = "3D graphics",
    autoResetIdleDelayMs = 2500,
  } = options;

  const [status, setStatus] = useState<ContextLossStatus>("idle");
  const [recoveryCount, setRecoveryCount] = useState(0);
  const [, setActiveCanvas] = useState<HTMLCanvasElement | null>(null);

  // Announcer for accessible screen reader alerts
  const announcer = useOptionalAnnouncer();

  const managerRef = useRef<ContextLossManager | null>(null);
  const canvasRefInternal = useRef<HTMLCanvasElement | null>(null);

  const onLostRef = useRef(onContextLost);
  const onRestoredRef = useRef(onContextRestored);
  const announcerRef = useRef(announcer);

  useEffect(() => {
    onLostRef.current = onContextLost;
    onRestoredRef.current = onContextRestored;
    announcerRef.current = announcer;
  }, [onContextLost, onContextRestored, announcer]);

  const bindCanvas = useCallback(
    (canvasElement: HTMLCanvasElement | null) => {
      if (managerRef.current) {
        managerRef.current.dispose();
        managerRef.current = null;
      }
      canvasRefInternal.current = canvasElement;
      setActiveCanvas(canvasElement);

      if (canvasElement) {
        const manager = createContextLossManager({
          canvas: canvasElement,
          autoResetIdleDelayMs,
          onStatusChange: (nextStatus) => {
            setStatus(nextStatus);
          },
          onContextLost: (event) => {
            announcerRef.current?.announce(
              `${label} context interrupted. Attempting automatic restoration.`,
              "polite"
            );
            onLostRef.current?.(event);
          },
          onContextRestored: (event) => {
            setRecoveryCount((c) => c + 1);
            announcerRef.current?.announce(`${label} context restored.`, "polite");
            onRestoredRef.current?.(event);
          },
        });
        managerRef.current = manager;
      }
    },
    [autoResetIdleDelayMs, label]
  );

  useEffect(() => {
    const targetCanvas = directCanvas || canvasRef?.current || null;
    if (targetCanvas && targetCanvas !== canvasRefInternal.current) {
      bindCanvas(targetCanvas);
    }
  }, [directCanvas, canvasRef, bindCanvas]);

  useEffect(() => {
    return () => {
      if (managerRef.current) {
        managerRef.current.dispose();
        managerRef.current = null;
      }
    };
  }, []);

  const triggerSimulation = useCallback(
    (restoreDelayMs: number = 800): boolean => {
      if (managerRef.current) {
        return managerRef.current.simulateLoss(restoreDelayMs);
      }
      const targetCanvas = canvasRefInternal.current || directCanvas || canvasRef?.current || null;
      if (targetCanvas) {
        bindCanvas(targetCanvas);
        const activeMgr = managerRef.current as ContextLossManager | null;
        return activeMgr?.simulateLoss(restoreDelayMs) ?? false;
      }
      return false;
    },
    [bindCanvas, directCanvas, canvasRef]
  );

  return {
    status,
    isLost: status === "lost" || status === "restoring",
    recoveryCount,
    triggerSimulation,
    bindCanvas,
  };
}
