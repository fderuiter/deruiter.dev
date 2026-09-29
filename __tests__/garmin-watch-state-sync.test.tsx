/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
//
// Regression coverage for #685: components/GarminWatchSimulator.tsx used to
// keep two independent copies of game state (the authoritative `stateRef`
// driving the 60fps loop, and a `gameState` React state driving the HUD)
// with 13 call sites manually assigning both, the exact pattern #655 fixed
// in WorkingWithDuck.tsx after #598 showed it can silently desync: a call
// site can update the displayed gameState without updating the ref the
// simulation loop actually reads.
//
// This test drives the REAL <GarminWatchSimulator /> component and the REAL
// engine (no engine module mock) through a discrete user action, then keeps
// the real 60fps loop running afterwards. The loop only ever reads
// `stateRef.current` - never `gameState` - so if a future edit ever updates
// one without the other (bypassing the single `applyTransition` gateway),
// the Force GC action's effect would never reach the ticking simulation:
// thermal stress would never rise there, and the next throttled HUD resync
// would show it stuck at 0% instead of climbing while the GC freeze runs.
//
// It uses the `initialState` test seam added by #685 to seed a real
// in-progress run directly, instead of simulating a full playthrough or
// mocking `createInitialState`.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createInitialState, startGame } from "@/lib/garmin-engine";

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
  clip: vi.fn(),
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
  width: 280,
  height: 280,
  right: 280,
  bottom: 280,
  x: 0,
  y: 0,
  toJSON: () => {},
}));

vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({
    playNote: vi.fn(),
    playSuccess: vi.fn(),
    playHover: vi.fn(),
  }),
  AudioProvider: ({ children }: any) => <>{children}</>,
}));

vi.mock("@/hooks/useTelemetry", () => ({
  useTelemetry: () => ({
    recordEvent: vi.fn().mockResolvedValue(true),
  }),
}));

import { GarminWatchSimulator } from "@/components/GarminWatchSimulator";

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

describe("Garmin Watch Simulator - stateRef/gameState stay in lockstep (#685)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
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

  it("keeps a Force GC action's effect alive in the running 60fps loop instead of it being dropped on the next throttled HUD sync", async () => {
    // A real, already-running session with no other thermal stressors
    // (light off, RAM far under 80%) and obstacles cleared so a random
    // spawn can't crash the run mid-test. Force GC's own guard
    // (`gameState !== "playing"`) would silently no-op the click against
    // the component's real idle default, so this specifically requires the
    // seam to be honored rather than ignored.
    // Force GC only acts when something collectible is on the heap (#1213),
    // so seed one leaked allocation alongside the protected base variables.
    const started = startGame(createInitialState("fenix", 0), "fenix");
    const seed = {
      ...started,
      variables: [
        ...started.variables,
        {
          id: 9001,
          name: "leakedBuffer",
          type: "array" as const,
          sizeKb: 8,
          allocatedAt: 0,
        },
      ],
      obstacles: [],
      lastObstacleTime: Date.now(),
    };

    await act(async () => {
      root.render(<GarminWatchSimulator initialState={seed} />);
    });

    // Force GC (BACK button): sets isGcActive + a 500ms freeze timer.
    // triggerGarbageCollection doesn't touch thermalStress itself, so it's
    // still 0 immediately after the click either way.
    await clickByText(container, "BACK");
    expect(container.textContent).toContain("THERMAL: 0%");

    // Run the real 60fps loop forward. While isGcActive is true, thermal
    // stress climbs toward 1.0 every tick inside updateGameSimulation - but
    // only if the loop's stateRef actually has isGcActive=true. If the
    // click above only reached gameState (not stateRef), the loop keeps
    // simulating the pre-click ref (isGcActive=false), thermal stress never
    // rises there, and the next throttled HUD resync (every 6 ticks)
    // overwrites the display back to a value stuck at 0% instead of
    // climbing.
    await advanceFrames(500);

    const thermalMatch = container.textContent?.match(/THERMAL:\s*(\d+)%/);
    expect(thermalMatch).not.toBeNull();
    expect(Number(thermalMatch?.[1])).toBeGreaterThan(0);
  });
});
