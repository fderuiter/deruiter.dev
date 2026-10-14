// @vitest-environment jsdom
//
// #2050: the sprint result card shows the three stars, and the wardrobe and
// best stars persist across reloads.

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

describe("Working With Duck stars and wardrobe persistence (#2050)", () => {
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

  async function render(state?: WorkingWithDuckState) {
    await act(async () => {
      root.render(<WorkingWithDuck initialState={state} />);
    });
  }

  it("shows the stars earned and which goals were missed on the win card", async () => {
    const base = createInitialDuckGameState(2);
    await render({
      ...base,
      status: "won",
      workProgress: base.targetWorkProgress,
      naughtyVsGood: 80,
      sprintStars: {
        propsSaved: true,
        noAccidents: false,
        goodBoy: true,
        goodBoyAtFinish: 62,
        count: 2,
      },
      bestStars: { 2: 3 },
    });
    const card = container.querySelector<HTMLElement>(
      '[role="dialog"][aria-labelledby="duck-win-dialog-heading"]'
    );
    expect(card).not.toBeNull();
    expect(card!.querySelector('[aria-label="2 of 3 stars"]')).not.toBeNull();
    const text = card!.textContent ?? "";
    expect(text).toContain("Best 3/3");
    expect(text).toContain("Earned: All props saved");
    expect(text).toContain("Missed: No accidents");
    expect(text).toContain("Good Boy above 50 at the finish (62)");
  });

  it("saves best stars and the wardrobe to storage", async () => {
    const base = createInitialDuckGameState(3);
    await render({
      ...base,
      activeAccessory: "bandana",
      bestStars: { 1: 3, 2: 1 },
    });
    expect(
      JSON.parse(localStorage.getItem("working_with_duck_best_stars")!)
    ).toEqual({ 1: 3, 2: 1 });
    const saved = JSON.parse(
      localStorage.getItem("working_with_duck_accessories")!
    );
    expect(saved.equipped).toBe("bandana");
    expect(saved.unlocked).toEqual(
      expect.arrayContaining(["bucket-hat", "bowtie", "bandana"])
    );
  });

  it("restores the wardrobe, stars and star-milestone facts after a reload", async () => {
    localStorage.setItem(
      "working_with_duck_accessories",
      JSON.stringify({
        unlocked: ["none", "bowtie", "graduation-hat", "jetpack"],
        equipped: "graduation-hat",
      })
    );
    localStorage.setItem(
      "working_with_duck_best_stars",
      JSON.stringify({ 1: 3, 2: 3, 3: 2, 9: 3 })
    );
    await render();
    expect(container.textContent).toContain(
      "Equipped Accessory: graduation-hat"
    );
    // Eight valid stars: the 5- and 8-star facts unlocked, not the 11-star one.
    const facts = JSON.parse(
      localStorage.getItem("working_with_duck_unlocked_facts")!
    );
    expect(facts).toEqual(expect.arrayContaining([1, 6, 7]));
    expect(facts).not.toContain(8);
  });

  it("falls back to defaults when stored progress is malformed", async () => {
    localStorage.setItem("working_with_duck_accessories", "{not json");
    localStorage.setItem("working_with_duck_best_stars", "[1,2,3]");
    await render();
    expect(container.textContent).toContain("Equipped Accessory: none");
  });
});
