/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
//
// Regression coverage for #598: sprint completion, retry, and progression
// reliability. Drives the REAL <WorkingWithDuck /> component through its
// real 60 FPS requestAnimationFrame game loop (advanced via fake timers) and
// the real deterministic engine in lib/working-with-duck-engine.ts.
//
// The only seam that is stubbed is the initial state returned by
// createInitialDuckGameState on the component's very first call (mount),
// which is nudged to be one tick away from a win/fail so each terminal tick
// phase (remainder 0-3) can be exercised deterministically and quickly.
// Every subsequent call (Retry, Proceed to Sprint N, endless handoff) goes
// through the real, unmodified engine.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  createInitialDuckGameState as realCreateInitialDuckGameState,
  type WorkingWithDuckState,
} from "@/lib/working-with-duck-engine";

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

// While active, every createInitialDuckGameState call (the component calls it
// twice independently at mount, for gameStateRef and uiState, plus extra
// discarded evaluations from React re-renders) returns the same scripted
// object so both the authoritative ref and the displayed UI state agree.
// Tests clear this right after starting the sprint so later calls (Retry,
// advanceToNextLevel's internal state creation, etc.) fall through to the
// real, unmodified engine implementation.
let scriptedInitialState: WorkingWithDuckState | null = null;

vi.mock("@/lib/working-with-duck-engine", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/working-with-duck-engine")>();
  return {
    ...actual,
    createInitialDuckGameState: (
      level?: number,
      mode?: "campaign" | "endless",
      preservedAccessories?: any
    ) => {
      if (scriptedInitialState) {
        return scriptedInitialState;
      }
      return actual.createInitialDuckGameState(
        level,
        mode,
        preservedAccessories
      );
    },
  };
});

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

// Craft a state that is a single simulation tick away from winning/failing,
// with `ticks` pinned to a specific value so the terminal state lands on a
// chosen mod-4 remainder (stepDuckGame's win/fail branches preserve `ticks`
// from the input state unchanged).
function scriptOneTickFromWin(level: number, ticksRemainder: number) {
  const base = realCreateInitialDuckGameState(level, "campaign");
  scriptedInitialState = {
    ...base,
    status: "idle",
    ticks: ticksRemainder,
    workProgress: base.targetWorkProgress - 0.01,
    naughtyVsGood: 15,
  };
}

function scriptOneTickFromFail(level: number, ticksRemainder: number) {
  const base = realCreateInitialDuckGameState(level, "campaign");
  scriptedInitialState = {
    ...base,
    status: "idle",
    ticks: ticksRemainder,
    workProgress: 0,
    naughtyVsGood: -95,
  };
}

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

async function advanceFrames(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

// Clicks the Start button, then stops serving the scripted mount state so
// any later createInitialDuckGameState call (Retry, advance to next sprint)
// exercises the real, unmodified engine.
async function startSprint(container: HTMLElement, text: string | RegExp) {
  const btn = await clickByText(container, text);
  scriptedInitialState = null;
  return btn;
}

describe("Working With Duck - Sprint Completion, Retry & Progression Reliability (#598)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    scriptedInitialState = null;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.useRealTimers();
  });

  it.each([0, 1, 2, 3])(
    "shows the victory panel immediately at tick remainder %i",
    async (remainder) => {
      scriptOneTickFromWin(1, remainder);

      await act(async () => {
        root.render(<WorkingWithDuck />);
      });

      await startSprint(container, /Start Sprint 1/);

      // One 60 FPS frame is enough to cross the win threshold.
      await advanceFrames(20);

      expect(container.textContent).toContain("Completed!");
      expect(container.textContent).toContain("Duck is Asleep");
    }
  );

  it.each([0, 1, 2, 3])(
    "shows the failure panel immediately at tick remainder %i",
    async (remainder) => {
      scriptOneTickFromFail(1, remainder);

      await act(async () => {
        root.render(<WorkingWithDuck />);
      });

      await startSprint(container, /Start Sprint 1/);
      await advanceFrames(20);

      expect(container.textContent).toContain("Duck Got a Time-Out!");
    }
  );

  it("Proceed to Sprint button resumes the authoritative simulation for the next sprint", async () => {
    scriptOneTickFromWin(1, 0);

    await act(async () => {
      root.render(<WorkingWithDuck />);
    });

    await startSprint(container, /Start Sprint 1/);
    await advanceFrames(20);
    expect(container.textContent).toContain("Completed!");

    await clickByText(container, /Proceed to Sprint 2/);

    // Regression: previously the ref driving the deterministic engine stayed
    // "idle" here, so no amount of elapsed time advanced work progress.
    await advanceFrames(500);

    expect(container.textContent).not.toContain("Completed!");
    expect(container.textContent).toContain("Sprint 2");
    const progressText = container.textContent || "";
    expect(progressText).not.toContain("0%");
  });

  it("Escape key on the victory panel also resumes simulation for the next sprint", async () => {
    scriptOneTickFromWin(1, 2);

    await act(async () => {
      root.render(<WorkingWithDuck />);
    });

    await startSprint(container, /Start Sprint 1/);
    await advanceFrames(20);
    expect(container.textContent).toContain("Completed!");

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });

    expect(container.textContent).not.toContain("Completed!");

    await advanceFrames(500);
    expect(container.textContent).toContain("Sprint 2");
  });

  it("Retry button resumes simulation on the same sprint after a failure", async () => {
    scriptOneTickFromFail(1, 1);

    await act(async () => {
      root.render(<WorkingWithDuck />);
    });

    await startSprint(container, /Start Sprint 1/);
    await advanceFrames(20);
    expect(container.textContent).toContain("Duck Got a Time-Out!");

    await clickByText(container, /Retry Sprint 1/);
    await advanceFrames(500);

    expect(container.textContent).not.toContain("Duck Got a Time-Out!");
    expect(container.textContent).toContain("Sprint 1");
  });

  it("Escape key on the failure panel also resumes simulation", async () => {
    scriptOneTickFromFail(1, 3);

    await act(async () => {
      root.render(<WorkingWithDuck />);
    });

    await startSprint(container, /Start Sprint 1/);
    await advanceFrames(20);
    expect(container.textContent).toContain("Duck Got a Time-Out!");

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });

    expect(container.textContent).not.toContain("Duck Got a Time-Out!");
    await advanceFrames(500);
    expect(container.textContent).toContain("Sprint 1");
  });

  it("campaign-to-endless handoff starts the simulation running instead of leaving it idle", async () => {
    scriptOneTickFromWin(5, 1);

    await act(async () => {
      root.render(<WorkingWithDuck />);
    });

    await startSprint(container, /Start Sprint 5/);
    await advanceFrames(20);
    expect(container.textContent).toContain("Completed!");

    await clickByText(container, /Play Endless Mode/);
    await advanceFrames(500);

    expect(container.textContent).toContain("Endless");
    expect(container.textContent).not.toContain("Completed!");
  });
});
