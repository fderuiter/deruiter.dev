// @vitest-environment jsdom
//
// #1677: a finished sprint opens the shared arcade result card with the
// run's recap, the scrapbook photo it earned and a best-score line measured
// against the best saved before the run.

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
  createInitialDuckGameState,
  type WorkingWithDuckState,
} from "@/lib/working-with-duck-engine";

function finished(
  status: "won" | "failed",
  overrides: Partial<WorkingWithDuckState> = {}
): WorkingWithDuckState {
  const base = createInitialDuckGameState(2);
  return {
    ...base,
    status,
    workProgress: base.targetWorkProgress / 2,
    naughtyVsGood: 30,
    totalScore: 900,
    hazards: base.hazards.map((h, i) => ({ ...h, isChewed: i === 0 })),
    ...overrides,
  };
}

describe("Working With Duck sprint result card (#1677)", () => {
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

  function dialog(headingId: string): HTMLElement {
    const el = container.querySelector<HTMLElement>(
      `[role="dialog"][aria-labelledby="${headingId}"]`
    );
    expect(el).not.toBeNull();
    return el!;
  }

  it("recaps a cleared sprint and measures the score against the best saved before it", async () => {
    localStorage.setItem("working_with_duck_high_score", "500");
    await render(finished("won", { highScore: 900 }));

    const card = dialog("duck-win-dialog-heading");
    const text = card.textContent ?? "";
    expect(text).toContain("Shipped");
    expect(text).toContain("Completed!");
    expect(text).toContain("Work shipped");
    expect(text).toContain("50%");
    const hazards = createInitialDuckGameState(2).hazards.length;
    expect(text).toContain(`${hazards - 1}/${hazards}`);
    expect(text).toContain("New best, 400 over your old record");
    expect(
      Array.from(card.querySelectorAll("button")).map((b) => b.textContent)
    ).toEqual(
      expect.arrayContaining(["Replay Sprint 2", "Proceed to Sprint 3"])
    );
  });

  it("shows how far a timed-out sprint fell short and Escape retries it", async () => {
    localStorage.setItem("working_with_duck_high_score", "2000");
    await render(finished("failed", { totalScore: 300 }));

    const card = dialog("duck-fail-dialog-heading");
    expect(card.textContent).toContain("Time-out");
    expect(card.textContent).toContain("1700 short of your best (2000)");

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(
      container.querySelector('[aria-labelledby="duck-fail-dialog-heading"]')
    ).toBeNull();
  });
});
