// @vitest-environment jsdom
//
// #2740: a sprint shipped with Duck dressed as a duck earns the Halloween
// trophy, through the same milestone path as the other Duck trophies.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { fromAny } from "@total-typescript/shoehorn";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

// ResizeObserver and IntersectionObserver come from vitest.setup.ts.
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

HTMLCanvasElement.prototype.getContext = vi.fn(() => fromAny(mockCtx));
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
  AudioProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock("@/hooks/useTelemetry", () => ({
  useTelemetry: () => ({
    recordEvent: vi.fn().mockResolvedValue(true),
  }),
}));

const recordArcadeMilestone = vi.hoisted(() =>
  vi.fn<(gameId: string, milestone: string) => unknown[]>(() => [])
);
vi.mock("@/lib/arcade-achievements", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/arcade-achievements")>()),
  recordArcadeMilestone,
}));

import { WorkingWithDuck } from "@/components/WorkingWithDuck";
import {
  createInitialDuckGameState,
  type DuckAccessory,
  type WorkingWithDuckState,
} from "@/lib/working-with-duck-engine";

describe("Working With Duck costume trophy (#2740)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    localStorage.clear();
    recordArcadeMilestone.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  async function finishSprint(activeAccessory: DuckAccessory) {
    const state: WorkingWithDuckState = {
      ...createInitialDuckGameState(1),
      status: "won",
      workProgress: 100,
      totalScore: 1500,
      activeAccessory,
    };
    await act(async () => {
      root.render(<WorkingWithDuck initialState={state} />);
    });
    return recordArcadeMilestone.mock.calls.map((call) => call[1]);
  }

  it("records the costume milestone for a sprint shipped in the duck costume", async () => {
    const milestones = await finishSprint("duck-costume");
    expect(milestones).toContain("sprint_shipped");
    expect(milestones).toContain("duck_costume_sprint");
  });

  it("does not record it for another costume or a bare coat", async () => {
    for (const accessory of ["witch-hat", "none"] as const) {
      recordArcadeMilestone.mockClear();
      const milestones = await finishSprint(accessory);
      expect(milestones).toContain("sprint_shipped");
      expect(milestones).not.toContain("duck_costume_sprint");
      await act(async () => {
        root.unmount();
      });
      root = createRoot(container);
    }
  });
});
