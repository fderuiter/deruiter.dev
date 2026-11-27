/**
 * WebGL and Canvas 2D Context Loss Lifecycle Manager
 *
 * Provides isolated event handling for webglcontextlost, webglcontextrestored,
 * contextlost, and contextrestored events to protect rendering pipelines from GPU
 * interruptions, laptop power-saving switches, and mobile tab suspension.
 */

export type ContextLossStatus = "idle" | "lost" | "restoring" | "restored";

export interface ContextManagerOptions {
  canvas: HTMLCanvasElement | null;
  onContextLost?: (event: Event) => void;
  onContextRestored?: (event: Event) => void;
  onStatusChange?: (status: ContextLossStatus) => void;
  autoResetIdleDelayMs?: number;
}

export interface ContextLossManager {
  getStatus: () => ContextLossStatus;
  isContextLost: () => boolean;
  getRecoveryCount: () => number;
  simulateLoss: (restoreDelayMs?: number) => boolean;
  dispose: () => void;
}

/**
 * Creates and binds an isolated context loss manager to a canvas element.
 */
export function createContextLossManager(
  options: ContextManagerOptions
): ContextLossManager {
  const {
    canvas,
    onContextLost,
    onContextRestored,
    onStatusChange,
    autoResetIdleDelayMs = 2500,
  } = options;

  let currentStatus: ContextLossStatus = "idle";
  let recoveryCount = 0;
  let resetTimer: ReturnType<typeof setTimeout> | null = null;

  const setStatus = (nextStatus: ContextLossStatus) => {
    currentStatus = nextStatus;
    onStatusChange?.(nextStatus);
  };

  const handleLost = (event: Event) => {
    // CRITICAL: Calling preventDefault() informs the browser that the application
    // handles context loss and requests that the WebGL context be restored when possible.
    if (event.cancelable) {
      event.preventDefault();
    }

    if (resetTimer) {
      clearTimeout(resetTimer);
      resetTimer = null;
    }

    setStatus("lost");
    onContextLost?.(event);
  };

  const handleRestored = (event: Event) => {
    recoveryCount += 1;
    setStatus("restoring");
    onContextRestored?.(event);
    setStatus("restored");

    if (resetTimer) {
      clearTimeout(resetTimer);
    }
    resetTimer = setTimeout(() => {
      setStatus("idle");
      resetTimer = null;
    }, autoResetIdleDelayMs);
  };

  if (canvas) {
    // WebGL context event listeners
    canvas.addEventListener("webglcontextlost", handleLost, false);
    canvas.addEventListener("webglcontextrestored", handleRestored, false);

    // Canvas 2D context event listeners
    canvas.addEventListener("contextlost", handleLost, false);
    canvas.addEventListener("contextrestored", handleRestored, false);
  }

  const simulateLoss = (restoreDelayMs: number = 800): boolean => {
    if (!canvas) return false;
    return simulateContextLoss(canvas, restoreDelayMs);
  };

  const dispose = () => {
    if (resetTimer) {
      clearTimeout(resetTimer);
      resetTimer = null;
    }
    if (canvas) {
      canvas.removeEventListener("webglcontextlost", handleLost, false);
      canvas.removeEventListener("webglcontextrestored", handleRestored, false);
      canvas.removeEventListener("contextlost", handleLost, false);
      canvas.removeEventListener("contextrestored", handleRestored, false);
    }
  };

  return {
    getStatus: () => currentStatus,
    isContextLost: () =>
      currentStatus === "lost" || currentStatus === "restoring",
    getRecoveryCount: () => recoveryCount,
    simulateLoss,
    dispose,
  };
}

/**
 * Triggers a simulated context loss and subsequent restoration on a canvas element.
 * Uses WEBGL_lose_context extension when available, falling back to synthetic event dispatch.
 */
export function simulateContextLoss(
  canvas: HTMLCanvasElement,
  restoreDelayMs: number = 800
): boolean {
  if (!canvas) return false;

  let loseExtension: {
    loseContext: () => void;
    restoreContext: () => void;
  } | null = null;

  try {
    const gl =
      (canvas.getContext("webgl2") as WebGL2RenderingContext | null) ||
      (canvas.getContext("webgl") as WebGLRenderingContext | null) ||
      (canvas.getContext("experimental-webgl") as WebGLRenderingContext | null);

    if (gl && typeof gl.getExtension === "function") {
      loseExtension = gl.getExtension("WEBGL_lose_context");
    }
  } catch {
    loseExtension = null;
  }

  if (loseExtension) {
    loseExtension.loseContext();
    setTimeout(() => {
      loseExtension?.restoreContext();
    }, restoreDelayMs);
    return true;
  }

  // Fallback synthetic event dispatch for headless test environments / Canvas 2D
  const is2D = !canvas.getContext("webgl") && !canvas.getContext("webgl2");
  const lostEventName = is2D ? "contextlost" : "webglcontextlost";
  const restoredEventName = is2D ? "contextrestored" : "webglcontextrestored";

  const lostEvt = new Event(lostEventName, { bubbles: true, cancelable: true });
  canvas.dispatchEvent(lostEvt);

  setTimeout(() => {
    const restoredEvt = new Event(restoredEventName, {
      bubbles: true,
      cancelable: true,
    });
    canvas.dispatchEvent(restoredEvt);
  }, restoreDelayMs);

  return true;
}
