// @vitest-environment jsdom
//
// #2051: an endless run that times out is scored by quarters survived plus
// work done, with its own endless best kept in guarded storage, and the HUD
// names the quarter being played.

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

import { WorkingWithDuck } from "@/components/WorkingWithDuck";
import {
  ENDLESS_QUARTER_WORK,
  createInitialDuckGameState,
  type WorkingWithDuckState,
} from "@/lib/working-with-duck-engine";

const ENDLESS_BEST_KEY = "working_with_duck_endless_best";

/** An endless run in quarter 3 with 250 work units done. */
function endlessRun(
  overrides: Partial<WorkingWithDuckState> = {}
): WorkingWithDuckState {
  return {
    ...createInitialDuckGameState(5, "endless"),
    endlessQuarter: 3,
    workProgress: 2 * ENDLESS_QUARTER_WORK + 10.4,
    totalScore: 4000,
    ...overrides,
  };
}

describe("Working With Duck endless result card (#2051)", () => {
  let container: HTMLDivElement;
  let root: Root;
  let originalRaf: typeof window.requestAnimationFrame;

  beforeEach(() => {
    localStorage.clear();
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

  function card(): HTMLElement {
    const el = container.querySelector<HTMLElement>(
      '[role="dialog"][aria-labelledby="duck-fail-dialog-heading"]'
    );
    expect(el).not.toBeNull();
    return el!;
  }

  it("scores a timed-out run by quarters survived plus work done and saves the endless best", async () => {
    localStorage.setItem("working_with_duck_high_score", "9000");
    localStorage.setItem(ENDLESS_BEST_KEY, "1500");
    await render(endlessRun({ status: "failed" }));

    const text = card().textContent ?? "";
    const endlessScore = 2 * 1000 + 2 * ENDLESS_QUARTER_WORK + 10;
    expect(text).toContain("Endless score");
    expect(text).toContain("Quarters");
    expect(text).toContain("ended in Q3 after 2 quarters survived");
    // The best line compares against the endless best, not the high score.
    expect(text).toContain(
      `New best, ${endlessScore - 1500} over your old record`
    );
    expect(
      container.querySelector('[data-testid="duck-endless-best"]')?.textContent
    ).toContain(String(endlessScore));
    expect(text).toContain("Retry Endless Run");
    expect(localStorage.getItem(ENDLESS_BEST_KEY)).toBe(String(endlessScore));
    expect(localStorage.getItem("working_with_duck_high_score")).toBe("9000");
  });

  it("keeps a higher endless best and shows the gap", async () => {
    localStorage.setItem(ENDLESS_BEST_KEY, "9999");
    await render(endlessRun({ status: "failed" }));

    const endlessScore = 2 * 1000 + 2 * ENDLESS_QUARTER_WORK + 10;
    expect(card().textContent).toContain(
      `${9999 - endlessScore} short of your best (9999)`
    );
    expect(
      container.querySelector('[data-testid="duck-endless-best"]')?.textContent
    ).toContain("9999");
    expect(localStorage.getItem(ENDLESS_BEST_KEY)).toBe("9999");
  });

  it("names the quarter in the HUD and the endless best on the briefing", async () => {
    localStorage.setItem(ENDLESS_BEST_KEY, "3210");
    await render(endlessRun());

    const hud = container.querySelector('[data-testid="duck-hud-meters"]');
    expect(hud?.textContent).toContain("Endless");
    expect(hud?.textContent).toContain("Quarter");
    expect(hud?.textContent).toContain("Q3");
    expect(
      container.querySelector('[data-testid="duck-start-highscore"]')
        ?.textContent
    ).toContain("Endless best 3210");
  });
});
