// @vitest-environment jsdom
//
// #2740: in Halloween mode the game hands the mode to the engine each tick,
// so trick-or-treaters ring where the package would knock; their arrival is
// announced, and Sit (Q) sends them off for the package's 150 points.

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
  createInitialDuckGameState,
  type WorkingWithDuckState,
} from "@/lib/working-with-duck-engine";
import { safeClear, safeSetRawItem } from "@/lib/safe-storage";
import { HALLOWEEN_KEY } from "@/components/working-with-duck/halloween";

/** A calm, running sprint 1, one tick before its first surprise roll. */
function beforeSurprise(): WorkingWithDuckState {
  const base = createInitialDuckGameState(1);
  return {
    ...base,
    status: "running",
    totalScore: 1000,
    ticks: 519,
    lastImpulseTick: 519,
    excitement: 0,
    bladder: 0,
    thirst: 0,
    hunger: 0,
    duck: { ...base.duck, state: "IDLE_ROAM", stateTimer: 600 },
  };
}

const ARRIVAL =
  "Trick-or-treaters at the door. Call Sit (Q) before they leave.";

describe("Working With Duck trick-or-treaters in the cabinet (#2740)", () => {
  let container: HTMLDivElement;
  let root: Root;
  let originalRaf: typeof window.requestAnimationFrame;
  let frame: FrameRequestCallback | null;

  beforeEach(() => {
    safeClear();
    announce.mockClear();
    // A roll under one half is the package's slot on sprint 1.
    vi.spyOn(Math, "random").mockReturnValue(0.1);
    originalRaf = window.requestAnimationFrame;
    frame = null;
    window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      frame = cb;
      return 1;
    }) as typeof window.requestAnimationFrame;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    window.requestAnimationFrame = originalRaf;
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  /** Mounts the sprint and runs a few fixed steps past the surprise tick. */
  async function playPastTheRoll() {
    await act(async () => {
      root.render(<WorkingWithDuck initialState={beforeSurprise()} />);
    });
    let timestamp = 0;
    for (let i = 0; i < 4; i++) {
      await act(async () => {
        frame?.(timestamp);
        timestamp += 1000 / 60;
      });
    }
  }

  const score = () =>
    container.querySelector('[data-testid="duck-hud-score-value"]')
      ?.textContent;

  it("rings the trick-or-treaters and announces them while Halloween mode is on", async () => {
    safeSetRawItem(HALLOWEEN_KEY, "on");
    await playPastTheRoll();
    expect(announce).toHaveBeenCalledWith(ARRIVAL, "polite");
    // No package to sign for: the trick-or-treaters took its place.
    expect(
      container.querySelector('[data-testid="duck-package-button"]')
    ).toBeNull();
  });

  it("knocks with the package as before while Halloween mode is off", async () => {
    safeSetRawItem(HALLOWEEN_KEY, "off");
    await playPastTheRoll();
    expect(announce).not.toHaveBeenCalledWith(ARRIVAL, "polite");
    expect(
      container.querySelector('[data-testid="duck-package-button"]')
    ).not.toBeNull();
  });

  it("pays at least 150 points for a Sit (Q) at the door", async () => {
    await act(async () => {
      root.render(
        <WorkingWithDuck
          initialState={{
            ...beforeSurprise(),
            ticks: 100,
            activeSurpriseEvent: {
              type: "trick-or-treat",
              timer: 300,
              maxTimer: 300,
              resolved: false,
            },
          }}
        />
      );
    });
    const canvas = container.querySelector<HTMLCanvasElement>(
      'canvas[role="application"]'
    )!;
    await act(async () => {
      canvas.focus();
      canvas.dispatchEvent(
        new KeyboardEvent("keydown", { key: "q", code: "KeyQ", bubbles: true })
      );
    });
    const shown = Number((score() ?? "").replace(/\D/g, ""));
    expect(shown).toBeGreaterThanOrEqual(1150);
  });
});
