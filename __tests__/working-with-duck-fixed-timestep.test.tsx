/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
//
// Regression coverage for #600: duck simulation speed must be independent of
// display refresh rate. Drives the REAL <WorkingWithDuck /> component through
// its real requestAnimationFrame game loop and the real deterministic engine
// in lib/working-with-duck-engine.ts, with requestAnimationFrame stubbed so
// the test controls exactly how many callbacks fire and at what timestamps —
// simulating 30Hz, 60Hz, and 120Hz displays precisely.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot } from "react-dom/client";

global.ResizeObserver = class {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
} as any;

global.IntersectionObserver = class {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
} as any;

const mockCtx = {
  save: vi.fn(),
  restore: vi.fn(),
  translate: vi.fn(),
  rotate: vi.fn(),
  scale: vi.fn(),
  fillRect: vi.fn(),
  strokeRect: vi.fn(),
  clearRect: vi.fn(),
  beginPath: vi.fn(),
  closePath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  bezierCurveTo: vi.fn(),
  quadraticCurveTo: vi.fn(),
  arcTo: vi.fn(),
  arc: vi.fn(),
  ellipse: vi.fn(),
  roundRect: vi.fn(),
  rect: vi.fn(),
  fill: vi.fn(),
  stroke: vi.fn(),
  fillText: vi.fn(),
  measureText: vi.fn(() => ({ width: 40 })),
  createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  setLineDash: vi.fn(),
};

HTMLCanvasElement.prototype.getContext = vi.fn(() => mockCtx as any);
HTMLCanvasElement.prototype.getBoundingClientRect = vi.fn(() => ({
  left: 0,
  top: 0,
  width: 800,
  height: 500,
  right: 800,
  bottom: 500,
  x: 0,
  y: 0,
  toJSON: () => {},
}));

vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({
    playNote: vi.fn(),
    playSuccess: vi.fn(),
    playHover: vi.fn(),
    volume: 0.8,
    muted: true,
    profile: "8-bit",
    setVolume: vi.fn(),
    setMuted: vi.fn(),
    setProfile: vi.fn(),
  }),
  AudioProvider: ({ children }: any) => <>{children}</>,
}));

vi.mock("@/hooks/useTelemetry", () => ({
  useTelemetry: () => ({
    recordEvent: vi.fn().mockResolvedValue(true),
  }),
}));

import { WorkingWithDuck } from "@/components/WorkingWithDuck";

const storageStore: Record<string, string> = {};
Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem: (k: string) => storageStore[k] || null,
    setItem: (k: string, v: string) => {
      storageStore[k] = String(v);
    },
    removeItem: (k: string) => {
      delete storageStore[k];
    },
    clear: () => {
      Object.keys(storageStore).forEach((k) => delete storageStore[k]);
    },
    key: () => null,
    length: 0,
  },
  writable: true,
});

async function clickByText(container: HTMLElement, text: string | RegExp) {
  const btn = Array.from(container.querySelectorAll("button")).find((b) =>
    typeof text === "string"
      ? b.textContent?.includes(text)
      : text.test(b.textContent || "")
  );
  expect(btn).toBeDefined();
  await act(async () => {
    btn!.click();
  });
  return btn!;
}

function readMeterPercent(container: HTMLElement, ariaLabel: string): number {
  const bar = container.querySelector(`[aria-label="${ariaLabel}"]`);
  expect(bar).not.toBeNull();
  return Number(bar!.getAttribute("aria-valuenow"));
}

function readWorkProgressPercent(container: HTMLElement): number {
  return readMeterPercent(container, "Work Progress");
}

// Bladder accumulates monotonically every simulated tick (independent of
// work-progress's multiplier/combo/puddle-penalty math), so it's a second,
// differently-derived signal for the same equal-elapsed-time-at-different-Hz
// equivalence this ticket requires ("need accumulation").
function readBladderPercent(container: HTMLElement): number {
  return readMeterPercent(container, "Duck Bladder Clock Meter");
}

/**
 * Mounts a fresh <WorkingWithDuck />, starts Sprint 1, and drives its real
 * RAF loop with `frameCount` callbacks spaced `frameDurationMs` apart —
 * simulating a display running at 1000 / frameDurationMs Hz — for a total of
 * (frameCount - 1) * frameDurationMs of elapsed wall-clock time. Returns the
 * resulting displayed work-progress percent, score, and bladder reading.
 */
async function runAtFrameRate(frameDurationMs: number, frameCount: number) {
  const rafCallback: { current: FrameRequestCallback | null } = {
    current: null,
  };
  const originalRaf = window.requestAnimationFrame;
  const originalCancelRaf = window.cancelAnimationFrame;
  window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    rafCallback.current = cb;
    return 1;
  }) as any;
  window.cancelAnimationFrame = (() => {}) as any;

  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(<WorkingWithDuck />);
  });
  await clickByText(container, /Start Sprint 1/);

  // The loop keeps its simulation in refs and reads the clock only from the
  // timestamps passed here, so several callbacks can share one React commit.
  // Committing about every 250ms of display time, rather than per callback,
  // gives the three rates about the same 40 renders each: a commit per
  // callback made the 120Hz run 1,200 renders, and on a loaded machine the
  // test ran past the per-test time limit (#2601).
  const framesPerCommit = Math.max(1, Math.round(250 / frameDurationMs));
  let timestamp = 0;
  for (let i = 0; i < frameCount; i += framesPerCommit) {
    await act(async () => {
      for (let j = i; j < Math.min(i + framesPerCommit, frameCount); j++) {
        timestamp += j === 0 ? 0 : frameDurationMs;
        const cb = rafCallback.current;
        expect(cb).not.toBeNull();
        cb!(timestamp);
      }
    });
  }

  const result = {
    workProgressPercent: readWorkProgressPercent(container),
    bladderPercent: readBladderPercent(container),
  };

  await act(async () => {
    root.unmount();
  });
  container.remove();
  window.requestAnimationFrame = originalRaf;
  window.cancelAnimationFrame = originalCancelRaf;

  return result;
}

describe("Working With Duck - Fixed-Timestep Simulation (#600)", () => {
  let randomSpy: ReturnType<typeof vi.spyOn>;

  const realRaf = window.requestAnimationFrame;
  const realCancelRaf = window.cancelAnimationFrame;

  beforeEach(() => {
    // Deterministic: avoid low-probability random events (surprise
    // deliveries, impulse rolls) diverging the three Hz runs for reasons
    // unrelated to timing.
    randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.95);
    // The sound cues' delayed notes are timers; with fake timers they never
    // fire on the wall clock while a test runs (#2601).
    vi.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"],
    });
  });

  afterEach(() => {
    randomSpy.mockRestore();
    vi.clearAllTimers();
    vi.useRealTimers();
    // A test that fails part-way leaves its frame stub installed.
    window.requestAnimationFrame = realRaf;
    window.cancelAnimationFrame = realCancelRaf;
    document.body.innerHTML = "";
  });

  it("advances equivalent progress and score over equal elapsed time at 30Hz, 60Hz, and 120Hz", async () => {
    // Same total elapsed wall-clock time (10s) delivered via a different
    // number of animation callbacks per display refresh rate.
    const at30Hz = await runAtFrameRate(1000 / 30, 300);
    const at60Hz = await runAtFrameRate(1000 / 60, 600);
    const at120Hz = await runAtFrameRate(1000 / 120, 1200);

    // Before the fix, 120Hz produced ~2x the ticks (and therefore ~2x the
    // score/progress) of 60Hz over the same wall-clock duration, and 60Hz
    // ~2x that of 30Hz. A small absolute tolerance (a rounding artifact at
    // the fixed-step boundary of each run's very first frame) distinguishes
    // "fixed" (within a tick or two regardless of Hz) from "broken" (scales
    // with Hz).
    expect(at60Hz.workProgressPercent).toBeGreaterThan(0);
    expect(
      Math.abs(at30Hz.workProgressPercent - at60Hz.workProgressPercent)
    ).toBeLessThanOrEqual(2);
    expect(
      Math.abs(at120Hz.workProgressPercent - at60Hz.workProgressPercent)
    ).toBeLessThanOrEqual(2);

    expect(at60Hz.bladderPercent).toBeGreaterThan(0);
    const bladderReadings = [
      at30Hz.bladderPercent,
      at60Hz.bladderPercent,
      at120Hz.bladderPercent,
    ];
    const maxBladder = Math.max(...bladderReadings);
    const minBladder = Math.min(...bladderReadings);
    // Within 5% of each other, not the ~2x/4x spread the bug produced.
    expect(maxBladder - minBladder).toBeLessThan(maxBladder * 0.05);
  });

  it("bounds catch-up work after a long delayed frame instead of bursting", async () => {
    const rafCallback: { current: FrameRequestCallback | null } = {
      current: null,
    };
    const originalRaf = window.requestAnimationFrame;
    const originalCancelRaf = window.cancelAnimationFrame;
    window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      rafCallback.current = cb;
      return 1;
    }) as any;
    window.cancelAnimationFrame = (() => {}) as any;

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<WorkingWithDuck />);
    });
    await clickByText(container, /Start Sprint 1/);

    // Frame 1 primes the clock with exactly one fixed step.
    await act(async () => {
      rafCallback.current!(0);
    });
    const afterFirstFrame = readWorkProgressPercent(container);

    // Simulate a 5-second stall (backgrounded tab, dropped frames) between
    // one callback and the next.
    await act(async () => {
      rafCallback.current!(5000);
    });
    const afterStall = readWorkProgressPercent(container);

    // A naive accumulator would replay ~5000ms / 16.67ms ≈ 300 queued steps
    // in one frame. The bound caps it far below that.
    const targetBar = container.querySelector('[role="progressbar"]');
    const target = Number(targetBar?.getAttribute("aria-valuemax") ?? 100);
    const deltaPercent = afterStall - afterFirstFrame;
    // 8 bounded steps is a small fraction of the sprint; it should not have
    // jumped anywhere near the full remaining distance to completion.
    expect(deltaPercent).toBeLessThan((target - afterFirstFrame) * 0.5);

    await act(async () => {
      root.unmount();
    });
    container.remove();
    window.requestAnimationFrame = originalRaf;
    window.cancelAnimationFrame = originalCancelRaf;
  });

  it("does not burst-replay elapsed time across a canvas context-loss/restore gap", async () => {
    const rafCallback: { current: FrameRequestCallback | null } = {
      current: null,
    };
    const originalRaf = window.requestAnimationFrame;
    const originalCancelRaf = window.cancelAnimationFrame;
    window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      rafCallback.current = cb;
      return 1;
    }) as any;
    window.cancelAnimationFrame = (() => {}) as any;

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<WorkingWithDuck />);
    });
    await clickByText(container, /Start Sprint 1/);

    await act(async () => {
      rafCallback.current!(0);
    });
    const beforeLoss = readWorkProgressPercent(container);

    const canvas = container.querySelector("canvas")!;
    await act(async () => {
      canvas.dispatchEvent(new Event("contextlost"));
    });

    // A long real-world gap while the context is lost (e.g. GPU reset,
    // backgrounded tab) must not be replayed as simulation time on restore.
    await act(async () => {
      canvas.dispatchEvent(new Event("contextrestored"));
    });

    // First frame after restore only primes the new clock baseline again.
    await act(async () => {
      rafCallback.current!(60000);
    });
    const justAfterRestore = readWorkProgressPercent(container);

    // One fixed step's worth of progress at most, not 60 seconds' worth.
    expect(justAfterRestore - beforeLoss).toBeLessThan(2);

    await act(async () => {
      root.unmount();
    });
    container.remove();
    window.requestAnimationFrame = originalRaf;
    window.cancelAnimationFrame = originalCancelRaf;
  });

  it("resets step accumulation across pause and resume without bursting on resume (#602)", async () => {
    const rafCallback: { current: FrameRequestCallback | null } = {
      current: null,
    };
    const originalRaf = window.requestAnimationFrame;
    const originalCancelRaf = window.cancelAnimationFrame;
    window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      rafCallback.current = cb;
      return 1;
    }) as any;
    window.cancelAnimationFrame = (() => {}) as any;

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<WorkingWithDuck />);
    });
    await clickByText(container, /Start Sprint 1/);

    await act(async () => {
      rafCallback.current!(0);
    });
    const beforePause = readWorkProgressPercent(container);

    // Pause the game
    const pauseBtn = container.querySelector<HTMLElement>(
      'button[title="Pause Sprint (P)"]'
    );
    expect(pauseBtn).not.toBeNull();
    await act(async () => {
      pauseBtn!.click();
    });

    // Advance RAF frames with large time increments during pause
    await act(async () => {
      rafCallback.current!(5000);
      rafCallback.current!(10000);
    });
    const duringPause = readWorkProgressPercent(container);
    expect(duringPause).toBe(beforePause);

    // Resume the game
    const resumeBtn = container.querySelector<HTMLElement>(
      'button[title="Resume Sprint (P)"]'
    );
    expect(resumeBtn).not.toBeNull();
    await act(async () => {
      resumeBtn!.click();
    });

    // First frame after resume
    await act(async () => {
      rafCallback.current!(10000 + 1000 / 60);
    });
    const justAfterResume = readWorkProgressPercent(container);

    // Only one fixed step's worth of progress, zero catch-up burst
    expect(justAfterResume - duringPause).toBeLessThanOrEqual(2);

    await act(async () => {
      root.unmount();
    });
    container.remove();
    window.requestAnimationFrame = originalRaf;
    window.cancelAnimationFrame = originalCancelRaf;
  });
});
