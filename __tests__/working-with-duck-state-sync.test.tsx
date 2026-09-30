/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
//
// Regression coverage for #655: components/WorkingWithDuck.tsx used to keep
// two independent copies of game state (the authoritative `gameStateRef`
// driving the 60fps loop, and a throttled `uiState` driving the HUD) with
// 45+ call sites manually assigning both. #598 showed that pattern can
// silently desync: a call site can update the displayed uiState without
// updating the ref the simulation loop actually reads.
//
// This test drives the REAL <WorkingWithDuck /> component and the REAL
// engine (no engine module mock) through a discrete user action, then keeps
// the real 60 FPS loop running afterwards. The loop only ever reads
// `gameStateRef.current` - never `uiState` - so if a future edit ever
// updates one without the other (bypassing the single `applyTransition`
// gateway), the combo streak this test seeds would decay to zero on the
// very first simulated tick instead of counting down from the value the
// discrete action set, and the assertions below would fail.
//
// It uses the `initialState` test seam added by #655 to seed a specific,
// deliberately pre-decayed near-terminal state directly, instead of
// simulating hundreds of ticks or mocking `createInitialDuckGameState`.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createInitialDuckGameState } from "@/lib/working-with-duck-engine";

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

async function advanceFrames(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

describe("Working With Duck - gameStateRef/uiState stay in lockstep (#655)", () => {
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

  it("keeps a discrete action's combo state alive across the running 60fps loop instead of decaying on the very next tick", async () => {
    // Deliberately pre-decayed: comboTimer is already 0, so if the click
    // below only reaches uiState and gameStateRef stays on this seed, the
    // very first stepDuckGame tick zeroes comboStreak (engine.ts: a
    // comboTimer that hits 0 resets comboStreak to 0 in the same step).
    const seed = {
      ...createInitialDuckGameState(1, "campaign"),
      status: "running" as const,
      comboStreak: 1,
      comboTimer: 0,
      duck: {
        ...createInitialDuckGameState(1, "campaign").duck,
        state: "NO_TAKE_THROW" as const,
      },
    };

    await act(async () => {
      root.render(<WorkingWithDuck initialState={seed} />);
    });

    // giveTreat's NO_TAKE_THROW branch: comboStreak -> 2, comboTimer -> 180.
    await clickByText(container, "Give Treat");

    expect(container.textContent).toContain("2× COMBO STREAK");

    // Run the real 60fps loop forward. If gameStateRef never received the
    // click's update (only uiState did), stepDuckGame decrements the stale
    // comboTimer (0) to 0 again and resets comboStreak to 0 on tick one,
    // and that reset flushes into uiState within a handful of ticks
    // (throttled sync every 4 ticks) - the overlay would disappear.
    await advanceFrames(150);

    expect(container.textContent).toContain("2× COMBO STREAK");
  });
});
