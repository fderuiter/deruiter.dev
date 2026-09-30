// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { act, renderHook } from "@testing-library/react";
import {
  DEFAULT_MAX_DELTA_MS,
  useAnimationFrame,
  type AnimationFrameCallback,
  type UseAnimationFrameOptions,
} from "@/hooks/useAnimationFrame";

/**
 * Deterministic stand-in for the browser frame scheduler: frames only run
 * when a test calls `tick(timestamp)`, and every cancel is recorded.
 */
function installFrameScheduler() {
  let nextId = 1;
  const pending = new Map<number, FrameRequestCallback>();
  const cancelled: number[] = [];

  const request = vi.fn((cb: FrameRequestCallback) => {
    const id = nextId++;
    pending.set(id, cb);
    return id;
  });
  const cancel = vi.fn((id: number) => {
    cancelled.push(id);
    pending.delete(id);
  });

  vi.stubGlobal("requestAnimationFrame", request);
  vi.stubGlobal("cancelAnimationFrame", cancel);

  return {
    request,
    cancel,
    cancelled,
    pendingCount: () => pending.size,
    tick(timestamp: number) {
      const batch = [...pending.entries()];
      pending.clear();
      act(() => {
        for (const [, cb] of batch) cb(timestamp);
      });
    },
  };
}

type HookProps = {
  callback: AnimationFrameCallback;
  options?: UseAnimationFrameOptions;
};

function renderLoop(initial: HookProps) {
  return renderHook(
    ({ callback, options }: HookProps) => useAnimationFrame(callback, options),
    { initialProps: initial }
  );
}

describe("useAnimationFrame", () => {
  let scheduler: ReturnType<typeof installFrameScheduler>;

  beforeEach(() => {
    scheduler = installFrameScheduler();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports a zero delta on the first frame, then real deltas and accumulated time", () => {
    const callback = vi.fn();
    const { unmount } = renderLoop({ callback });

    scheduler.tick(1000);
    scheduler.tick(1016);
    scheduler.tick(1048);

    expect(callback.mock.calls).toEqual([
      [0, 0],
      [16, 16],
      [32, 48],
    ]);
    unmount();
  });

  it("clamps the delta after a background-tab gap to the default ceiling", () => {
    const callback = vi.fn();
    const { unmount } = renderLoop({ callback });

    scheduler.tick(0);
    scheduler.tick(16);
    // Tab hidden for five seconds.
    scheduler.tick(5016);
    scheduler.tick(5032);

    expect(callback.mock.calls.map(([delta]) => delta)).toEqual([
      0,
      16,
      DEFAULT_MAX_DELTA_MS,
      16,
    ]);
    expect(callback).toHaveBeenLastCalledWith(
      16,
      16 + DEFAULT_MAX_DELTA_MS + 16
    );
    unmount();
  });

  it("honours a custom maxDeltaMs and allows Infinity to disable clamping", () => {
    const clamped = vi.fn();
    const first = renderLoop({
      callback: clamped,
      options: { maxDeltaMs: 33 },
    });
    scheduler.tick(0);
    scheduler.tick(500);
    expect(clamped).toHaveBeenLastCalledWith(33, 33);
    first.unmount();

    const unclamped = vi.fn();
    const second = renderLoop({
      callback: unclamped,
      options: { maxDeltaMs: Infinity },
    });
    scheduler.tick(0);
    scheduler.tick(5000);
    expect(unclamped).toHaveBeenLastCalledWith(5000, 5000);
    second.unmount();
  });

  it("falls back to the default ceiling for zero, negative and NaN maxDeltaMs", () => {
    for (const maxDeltaMs of [0, -5, Number.NaN]) {
      const callback = vi.fn();
      const { unmount } = renderLoop({ callback, options: { maxDeltaMs } });
      scheduler.tick(0);
      scheduler.tick(10_000);
      expect(callback).toHaveBeenLastCalledWith(
        DEFAULT_MAX_DELTA_MS,
        DEFAULT_MAX_DELTA_MS
      );
      unmount();
    }
  });

  it("treats a timestamp that steps backwards as no time passing", () => {
    const callback = vi.fn();
    const { unmount } = renderLoop({ callback });
    scheduler.tick(100);
    scheduler.tick(90);
    scheduler.tick(106);
    expect(callback.mock.calls).toEqual([
      [0, 0],
      [0, 0],
      [16, 16],
    ]);
    unmount();
  });

  it("cancels the pending frame on unmount and never calls back afterwards", () => {
    const callback = vi.fn();
    const { unmount } = renderLoop({ callback });
    scheduler.tick(0);
    expect(scheduler.pendingCount()).toBe(1);

    unmount();

    expect(scheduler.cancel).toHaveBeenCalledTimes(1);
    expect(scheduler.pendingCount()).toBe(0);
    scheduler.tick(16);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("ignores a frame that was already dequeued when the loop was cancelled", () => {
    // Simulates a browser that runs a callback whose cancel raced it.
    const callbacks: FrameRequestCallback[] = [];
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((cb: FrameRequestCallback) => callbacks.push(cb))
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    const callback = vi.fn();
    const { unmount } = renderLoop({ callback });
    unmount();
    act(() => callbacks[0](0));

    expect(callback).not.toHaveBeenCalled();
    expect(callbacks).toHaveLength(1);
  });

  it("stops when isActive turns false and restarts with a fresh clock", () => {
    const callback = vi.fn();
    const { rerender, unmount } = renderLoop({ callback });
    scheduler.tick(0);
    scheduler.tick(16);

    rerender({ callback, options: { isActive: false } });
    expect(scheduler.cancel).toHaveBeenCalledTimes(1);
    expect(scheduler.pendingCount()).toBe(0);
    scheduler.tick(32);
    expect(callback).toHaveBeenCalledTimes(2);

    rerender({ callback, options: { isActive: true } });
    scheduler.tick(9000);
    scheduler.tick(9016);
    expect(callback.mock.calls.slice(2)).toEqual([
      [0, 0],
      [16, 16],
    ]);
    unmount();
  });

  it("does not schedule anything while inactive from the start", () => {
    const callback = vi.fn();
    const { unmount } = renderLoop({ callback, options: { isActive: false } });
    expect(scheduler.request).not.toHaveBeenCalled();
    unmount();
    expect(scheduler.cancel).not.toHaveBeenCalled();
  });

  it("keeps one loop and its clock when the callback or options change", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender, unmount } = renderLoop({ callback: first });
    scheduler.tick(0);
    scheduler.tick(16);

    rerender({ callback: second, options: { maxDeltaMs: 20 } });
    scheduler.tick(66);

    expect(scheduler.cancel).not.toHaveBeenCalled();
    expect(first).toHaveBeenCalledTimes(2);
    expect(second).toHaveBeenCalledExactlyOnceWith(20, 36);
    unmount();
  });

  it("restarts with a fresh clock when restartKey changes, and only then", () => {
    const callback = vi.fn();
    const keyA = {};
    const { rerender, unmount } = renderLoop({
      callback,
      options: { restartKey: keyA },
    });
    scheduler.tick(0);
    scheduler.tick(16);

    // Same key on a new render: the loop and its clock carry on.
    rerender({ callback, options: { restartKey: keyA } });
    expect(scheduler.cancel).not.toHaveBeenCalled();
    scheduler.tick(32);

    // New key: the pending frame is cancelled and the clock restarts.
    rerender({ callback, options: { restartKey: {} } });
    expect(scheduler.cancel).toHaveBeenCalledTimes(1);
    expect(scheduler.pendingCount()).toBe(1);
    scheduler.tick(500);
    scheduler.tick(516);

    expect(callback.mock.calls).toEqual([
      [0, 0],
      [16, 16],
      [16, 32],
      [0, 0],
      [16, 16],
    ]);
    unmount();
  });

  it("does not start a loop for a restartKey change while inactive", () => {
    const callback = vi.fn();
    const { rerender, unmount } = renderLoop({
      callback,
      options: { isActive: false, restartKey: 1 },
    });
    rerender({ callback, options: { isActive: false, restartKey: 2 } });
    expect(scheduler.request).not.toHaveBeenCalled();
    unmount();
  });

  it("skips frames under fpsLimit and carries their time into the next delta", () => {
    const callback = vi.fn();
    const { unmount } = renderLoop({ callback, options: { fpsLimit: 30 } });

    // 60 Hz display: frames every ~16.67 ms, limited to 30 fps.
    scheduler.tick(0);
    scheduler.tick(16.67);
    scheduler.tick(33.33);
    scheduler.tick(50);
    scheduler.tick(66.67);

    expect(callback.mock.calls.map(([delta]) => delta)).toEqual([
      0,
      33.33,
      66.67 - 33.33,
    ]);
    expect(scheduler.pendingCount()).toBe(1);
    unmount();
  });

  it("does not drop frames to vsync jitter when fpsLimit equals the display rate", () => {
    const callback = vi.fn();
    const { unmount } = renderLoop({ callback, options: { fpsLimit: 60 } });
    for (const t of [0, 16.4, 33.3, 49.8, 66.7]) scheduler.tick(t);
    expect(callback).toHaveBeenCalledTimes(5);
    unmount();
  });

  it("runs on every frame for a non-positive or NaN fpsLimit", () => {
    for (const fpsLimit of [0, -1, Number.NaN]) {
      const callback = vi.fn();
      const { unmount } = renderLoop({ callback, options: { fpsLimit } });
      for (const t of [0, 4, 8]) scheduler.tick(t);
      expect(callback).toHaveBeenCalledTimes(3);
      unmount();
    }
  });

  it("does nothing when requestAnimationFrame is unavailable", () => {
    vi.stubGlobal("requestAnimationFrame", undefined);
    const callback = vi.fn();
    const { unmount } = renderLoop({ callback });
    expect(callback).not.toHaveBeenCalled();
    expect(() => unmount()).not.toThrow();
  });

  it("renders on the server without scheduling a frame", () => {
    function Probe() {
      useAnimationFrame(() => {});
      return <span>ok</span>;
    }
    expect(renderToString(<Probe />)).toContain("ok");
    expect(scheduler.request).not.toHaveBeenCalled();
  });
});
