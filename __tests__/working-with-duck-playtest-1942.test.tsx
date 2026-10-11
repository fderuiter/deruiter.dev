// @vitest-environment jsdom
//
// #1942: playtest fixes for the result card copy, score saving and P.

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
import { safeGetRawItem } from "@/lib/safe-storage";
import {
  createInitialDuckGameState,
  type WorkingWithDuckState,
} from "@/lib/working-with-duck-engine";

describe("Working With Duck playtest fixes (#1942)", () => {
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

  it("does not save the best score while a sprint is still running", async () => {
    await render({
      ...createInitialDuckGameState(1),
      status: "running",
      totalScore: 900,
      highScore: 900,
    });
    // Saved mid-run, the best would already include this run when the result
    // card opens, so a loss read "Tied your best" on a fresh profile.
    expect(safeGetRawItem("working_with_duck_high_score")).toBeNull();
  });

  // These two run first: safe storage keeps written keys in memory across
  // tests, and every finished sprint below saves a score.
  it("calls a first finished run a first score, not a tie", async () => {
    await render({
      ...createInitialDuckGameState(1),
      status: "failed",
      totalScore: 300,
      highScore: 300,
    });
    const card = container.querySelector(
      '[aria-labelledby="duck-fail-dialog-heading"]'
    );
    expect(card?.textContent).toContain("First score on the board");
    expect(card?.textContent).not.toContain("Tied your best");
  });

  it("does not claim every prop survived when some were chewed", async () => {
    const base = createInitialDuckGameState(2);
    await render({
      ...base,
      status: "won",
      totalScore: 900,
      hazards: base.hazards.map((h, i) => ({ ...h, isChewed: i === 0 })),
    });
    const card = container.querySelector(
      '[aria-labelledby="duck-win-dialog-heading"]'
    );
    const text = card?.textContent ?? "";
    expect(text).not.toContain("Every cable survived");
    expect(text).toContain(
      `with ${base.hazards.length - 1} of ${base.hazards.length} props intact`
    );
  });

  it("P resumes the sprint from the focused Resume button", async () => {
    await render({ ...createInitialDuckGameState(1), status: "running" });
    const pause = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Pause Sprint (P)"]'
    );
    await act(async () => {
      pause!.click();
    });
    const resume = container.querySelector<HTMLButtonElement>(
      '[data-testid="duck-pause-overlay"] button'
    );
    expect(resume).not.toBeNull();
    resume!.focus();
    await act(async () => {
      resume!.dispatchEvent(
        new KeyboardEvent("keydown", { key: "p", bubbles: true })
      );
    });
    expect(
      container.querySelector('[data-testid="duck-pause-overlay"]')
    ).toBeNull();
  });
});
