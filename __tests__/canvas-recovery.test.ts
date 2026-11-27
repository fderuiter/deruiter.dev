import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createContextLossManager,
  simulateContextLoss,
  ContextLossStatus,
} from "@/lib/webgl/context-manager";

describe("WebGL & Canvas 2D Context Loss Manager", () => {
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    canvas = document.createElement("canvas");
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("initializes in idle status with 0 recoveries", () => {
    const manager = createContextLossManager({ canvas });
    expect(manager.getStatus()).toBe("idle");
    expect(manager.isContextLost()).toBe(false);
    expect(manager.getRecoveryCount()).toBe(0);
    manager.dispose();
  });

  it("handles webglcontextlost by calling preventDefault and transitioning to lost", () => {
    const onLost = vi.fn();
    const onStatusChange = vi.fn();

    const manager = createContextLossManager({
      canvas,
      onContextLost: onLost,
      onStatusChange,
    });

    const lostEvent = new Event("webglcontextlost", { cancelable: true });
    canvas.dispatchEvent(lostEvent);

    expect(lostEvent.defaultPrevented).toBe(true);
    expect(manager.getStatus()).toBe("lost");
    expect(manager.isContextLost()).toBe(true);
    expect(onLost).toHaveBeenCalledTimes(1);
    expect(onStatusChange).toHaveBeenCalledWith("lost");

    manager.dispose();
  });

  it("handles contextlost for 2D Canvas by calling preventDefault and updating state", () => {
    const onLost = vi.fn();
    const manager = createContextLossManager({
      canvas,
      onContextLost: onLost,
    });

    const lostEvent = new Event("contextlost", { cancelable: true });
    canvas.dispatchEvent(lostEvent);

    expect(lostEvent.defaultPrevented).toBe(true);
    expect(manager.getStatus()).toBe("lost");
    expect(onLost).toHaveBeenCalledTimes(1);

    manager.dispose();
  });

  it("handles webglcontextrestored by transitioning to restored and incrementing recoveryCount", () => {
    const onRestored = vi.fn();
    const statuses: ContextLossStatus[] = [];

    const manager = createContextLossManager({
      canvas,
      onContextRestored: onRestored,
      onStatusChange: (s) => statuses.push(s),
      autoResetIdleDelayMs: 1500,
    });

    // 1. Loss
    canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
    expect(manager.getStatus()).toBe("lost");

    // 2. Restored
    canvas.dispatchEvent(
      new Event("webglcontextrestored", { cancelable: true })
    );
    expect(onRestored).toHaveBeenCalledTimes(1);
    expect(manager.getRecoveryCount()).toBe(1);
    expect(manager.getStatus()).toBe("restored");

    // 3. Auto-reset to idle after timer
    vi.advanceTimersByTime(1500);
    expect(manager.getStatus()).toBe("idle");
    expect(manager.isContextLost()).toBe(false);

    manager.dispose();
  });

  it("cleans up event listeners when dispose() is called", () => {
    const onLost = vi.fn();
    const manager = createContextLossManager({
      canvas,
      onContextLost: onLost,
    });

    manager.dispose();

    canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
    expect(onLost).not.toHaveBeenCalled();
  });

  it("simulates context loss and scheduled restoration via simulateLoss", () => {
    const onLost = vi.fn();
    const onRestored = vi.fn();

    const manager = createContextLossManager({
      canvas,
      onContextLost: onLost,
      onContextRestored: onRestored,
    });

    const result = manager.simulateLoss(500);
    expect(result).toBe(true);
    expect(onLost).toHaveBeenCalledTimes(1);
    expect(manager.getStatus()).toBe("lost");

    vi.advanceTimersByTime(500);
    expect(onRestored).toHaveBeenCalledTimes(1);
    expect(manager.getStatus()).toBe("restored");

    manager.dispose();
  });

  it("handles simulateContextLoss gracefully with null canvas", () => {
    // @ts-expect-error testing null safety
    const result = simulateContextLoss(null);
    expect(result).toBe(false);
  });
});
