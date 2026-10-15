// @vitest-environment jsdom
//
// #2161: the Launch Standup keeps a countdown in the HUD while it runs, and
// its outcome is announced as well as drawn on the canvas.

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

const announce = vi.fn();
vi.mock("@/hooks/useAnnouncer", () => ({
  useAnnouncer: () => ({ announce }),
}));

vi.mock("@/hooks/useTelemetry", () => ({
  useTelemetry: () => ({
    recordEvent: vi.fn().mockResolvedValue(true),
  }),
}));

import { WorkingWithDuck } from "@/components/WorkingWithDuck";
import {
  STANDUP_BONUS,
  STANDUP_START_TICK,
  STANDUP_TICKS,
  createInitialDuckGameState,
  type WorkingWithDuckState,
} from "@/lib/working-with-duck-engine";
import { safeClear } from "@/lib/safe-storage";

function sprintFive(
  overrides: Partial<WorkingWithDuckState> = {}
): WorkingWithDuckState {
  return {
    ...createInitialDuckGameState(5),
    status: "running",
    ...overrides,
  };
}

describe("Working With Duck Launch Standup HUD (#2161)", () => {
  let container: HTMLDivElement;
  let root: Root;
  let originalRaf: typeof window.requestAnimationFrame;

  beforeEach(() => {
    safeClear();
    announce.mockClear();
    originalRaf = window.requestAnimationFrame;
    window.requestAnimationFrame = (() =>
      1) as typeof window.requestAnimationFrame;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    window.requestAnimationFrame = originalRaf;
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  async function render(state: WorkingWithDuckState) {
    await act(async () => {
      root.render(<WorkingWithDuck initialState={state} />);
    });
  }

  const badge = () =>
    container.querySelector('[data-testid="duck-hud-standup"]');

  it("counts the live standup down in the HUD", async () => {
    await render(
      sprintFive({
        standup: "live",
        ticks: STANDUP_START_TICK + STANDUP_TICKS - 10 * 60,
      })
    );
    expect(badge()?.textContent).toBe("Standup 10s");
  });

  it("shows no countdown before the standup or once it is over", async () => {
    await render(sprintFive({ ticks: 60 }));
    expect(badge()).toBeNull();
    await act(async () => {
      root.unmount();
    });
    root = createRoot(container);
    await render(
      sprintFive({ standup: "failed", ticks: STANDUP_START_TICK + 120 })
    );
    expect(badge()).toBeNull();
  });

  it("announces a smooth standup and a crashed one", async () => {
    await render(sprintFive({ standup: "passed" }));
    expect(announce).toHaveBeenCalledWith(
      `Smooth standup! Plus ${STANDUP_BONUS} points.`,
      "polite"
    );
    await act(async () => {
      root.unmount();
    });
    root = createRoot(container);
    announce.mockClear();
    await render(sprintFive({ standup: "failed" }));
    expect(announce).toHaveBeenCalledWith(
      "Duck crashed the standup. No standup bonus.",
      "polite"
    );
  });
});
