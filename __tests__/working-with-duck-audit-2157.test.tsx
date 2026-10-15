// @vitest-environment jsdom
//
// #2156, #2157, #2158: 10/10 audit fixes for the scrapbook photos, the
// result card keyboard guard, Escape pause and the Dog Park cooldown.

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
  DUCK_FACTS,
  type WorkingWithDuckState,
} from "@/lib/working-with-duck-engine";

describe("Working With Duck scrapbook photos (#2156)", () => {
  it("shows Duck in every late scrapbook photo", () => {
    const late = DUCK_FACTS.filter((fact) => fact.id >= 9);
    expect(late.map((fact) => fact.photoUrl)).toEqual([
      "/duck/duck-flop.jpg",
      "/duck/duck-car.jpg",
    ]);
    for (const fact of late) {
      expect(fact.fact).toMatch(/Duck/);
      expect(fact.photoUrl).not.toMatch(/\/images\/sports\//);
    }
  });
});

describe("Working With Duck audit fixes (#2157, #2158)", () => {
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
    vi.useRealTimers();
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

  const canvas = () =>
    container.querySelector<HTMLCanvasElement>("canvas[role=application]")!;
  const pauseOverlay = () =>
    container.querySelector('[data-testid="duck-pause-overlay"]');

  function key(target: Element, init: KeyboardEventInit, type = "keydown") {
    target.dispatchEvent(new KeyboardEvent(type, { bubbles: true, ...init }));
  }

  it("pauses a running sprint on Escape", async () => {
    await render({ ...createInitialDuckGameState(1), status: "running" });
    canvas().focus();
    await act(async () => {
      key(canvas(), { key: "Escape" });
    });
    expect(pauseOverlay()).not.toBeNull();
  });

  it("leaves Escape to the pause overlay, which resumes", async () => {
    await render({ ...createInitialDuckGameState(1), status: "running" });
    canvas().focus();
    await act(async () => {
      key(canvas(), { key: "Escape" });
    });
    const overlay = pauseOverlay();
    expect(overlay).not.toBeNull();
    const resume = overlay!.querySelector<HTMLButtonElement>("button");
    resume!.focus();
    await act(async () => {
      key(resume!, { key: "Escape" });
    });
    expect(pauseOverlay()).toBeNull();
  });

  it("shows the Dog Park cooldown on its button", async () => {
    await render({
      ...createInitialDuckGameState(1),
      status: "running",
      ticks: 600,
      parkReadyAtTick: 600 + 12 * 60,
    });
    const park = [...container.querySelectorAll("button")].find((b) =>
      /^Dog Park/.test(b.textContent?.trim() ?? "")
    );
    expect(park?.textContent).toMatch(/Dog Park 12s/);
    expect(park?.getAttribute("aria-disabled")).toBe("true");
  });

  function wonState(): WorkingWithDuckState {
    return {
      ...createInitialDuckGameState(1),
      status: "won",
      workProgress: 100,
      totalScore: 1500,
    };
  }

  const proceed = () =>
    [...container.querySelectorAll<HTMLButtonElement>("button")].find((b) =>
      /Proceed to Sprint 2/.test(b.textContent ?? "")
    )!;

  // A keyboard activation of a focused button: the key event, then the click
  // the browser sends with a detail of 0.
  async function pressSpaceOn(button: HTMLButtonElement) {
    await act(async () => {
      key(button, { key: " ", code: "Space" });
      key(button, { key: " ", code: "Space" }, "keyup");
      button.dispatchEvent(
        new MouseEvent("click", { bubbles: true, detail: 0 })
      );
    });
  }

  it("ignores a Space press the moment the result card opens", async () => {
    vi.useFakeTimers({ toFake: ["performance"] });
    await render(wonState());
    await pressSpaceOn(proceed());
    expect(container.querySelector("#duck-win-dialog-heading")).not.toBeNull();
  });

  it("ignores mashed Space presses but takes a deliberate one", async () => {
    vi.useFakeTimers({ toFake: ["performance"] });
    await render(wonState());
    // Still mashing from play: one press every 150 ms across the opening.
    for (let i = 0; i < 5; i++) {
      await pressSpaceOn(proceed());
      vi.advanceTimersByTime(150);
    }
    expect(container.querySelector("#duck-win-dialog-heading")).not.toBeNull();

    // The player stops, reads the card, then presses once.
    vi.advanceTimersByTime(800);
    await pressSpaceOn(proceed());
    expect(container.querySelector("#duck-win-dialog-heading")).toBeNull();
  });

  it("still takes a mouse click straight away", async () => {
    await render(wonState());
    await act(async () => {
      proceed().dispatchEvent(
        new MouseEvent("click", { bubbles: true, detail: 1 })
      );
    });
    expect(container.querySelector("#duck-win-dialog-heading")).toBeNull();
  });
});
