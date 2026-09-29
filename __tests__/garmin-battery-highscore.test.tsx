/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
//
// #1308: the battery never drained without the backlight, because rounding
// to two decimals undid each frame's ~0.0017% drain, and the high score was
// never saved, because the engine raises highScore to the score every tick
// so "score > highScore" was never true.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  createInitialState,
  startGame,
  updateGameSimulation,
  type GameEngineState,
} from "@/lib/garmin-engine";

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

async function advanceFrames(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

// A running Fenix session with obstacles cleared, so a random spawn can't
// crash it during the few simulated seconds.
function runningSession(overrides: Partial<GameEngineState> = {}) {
  return {
    ...startGame(createInitialState("fenix", 0), "fenix"),
    obstacles: [],
    lastObstacleTime: Date.now() + 60_000,
    ...overrides,
  };
}

describe("Garmin battery drain (#1308)", () => {
  function drainOver(seconds: number, isLightOn: boolean): number {
    let state = runningSession({ isLightOn, battery: 100 });
    for (let frame = 0; frame < seconds * 60; frame++) {
      state = {
        ...updateGameSimulation(state, 1000 / 60),
        obstacles: [],
        isLightOn,
      };
    }
    return 100 - state.battery;
  }

  it("drains about 0.1% a second with the backlight off", () => {
    expect(drainOver(60, false)).toBeCloseTo(6, 0);
  });

  it("drains about 0.4% a second with the backlight on", () => {
    expect(drainOver(10, true)).toBeCloseTo(4, 0);
  });
});

describe("Garmin high score persistence (#1308)", () => {
  let container: HTMLDivElement;
  let root: Root;
  let store: Record<string, string>;

  beforeEach(() => {
    vi.useFakeTimers();
    store = { garmin_simulator_high_score: "100" };
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => store[key] ?? null,
        setItem: (key: string, value: string) => {
          store[key] = String(value);
        },
        removeItem: (key: string) => {
          delete store[key];
        },
        clear: () => {
          store = {};
        },
      },
    });
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

  it("saves a run that beats the stored best", async () => {
    await act(async () => {
      root.render(
        <GarminWatchSimulator
          initialState={runningSession({ score: 500, highScore: 500 })}
        />
      );
    });
    await advanceFrames(2000);
    expect(Number(store.garmin_simulator_high_score)).toBeGreaterThanOrEqual(
      500
    );
  });

  it("never overwrites a better stored score with a worse run", async () => {
    store.garmin_simulator_high_score = "9000";
    await act(async () => {
      root.render(
        <GarminWatchSimulator
          initialState={runningSession({ score: 50, highScore: 50 })}
        />
      );
    });
    await advanceFrames(2000);
    expect(store.garmin_simulator_high_score).toBe("9000");
  });
});
