// @vitest-environment jsdom
//
// #2160: each sprint opens with its clock stopped. In a cabinet, Sprint 1
// waits in the room for the first key or click (the one-title-screen rule,
// #1516); every other sprint opens on its briefing card until Start, and a
// briefing that follows a result card ignores keys left over from it.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { fromAny } from "@total-typescript/shoehorn";
import { CabinetSetupContext } from "@/components/arcade/CabinetSetupContext";
import { getSavedSetupConfig } from "@/components/arcade/PreGameSetupWizard";

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
import { safeClear } from "@/lib/safe-storage";
import {
  createInitialDuckGameState,
  type WorkingWithDuckState,
} from "@/lib/working-with-duck-engine";

describe("Working With Duck sprint start (#2160)", () => {
  let container: HTMLDivElement;
  let root: Root;
  let originalRaf: typeof window.requestAnimationFrame;
  let now = 1000;

  beforeEach(() => {
    safeClear();
    now = 1000;
    vi.spyOn(performance, "now").mockImplementation(() => now);
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
    vi.restoreAllMocks();
  });

  async function render(node: React.ReactNode) {
    await act(async () => {
      root.render(node);
    });
  }

  function inCabinet(node: React.ReactNode) {
    return (
      <CabinetSetupContext.Provider
        value={{
          config: getSavedSetupConfig("working-with-duck"),
          runRevision: 0,
          isSetupOpen: false,
          skipTitleScreen: true,
        }}
      >
        {node}
      </CabinetSetupContext.Provider>
    );
  }

  const briefing = () =>
    container.querySelector('[data-testid="duck-sprint-briefing"]');
  // The screen-reader dock's start button is disabled once a sprint runs.
  const launchButton = () =>
    Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.startsWith("Launch Sprint")
    )!;

  async function pressOnCanvas(key: string, code = key, repeat = false) {
    const canvas = container.querySelector<HTMLElement>(
      '[role="application"]'
    )!;
    canvas.focus();
    await act(async () => {
      canvas.dispatchEvent(
        new KeyboardEvent("keydown", { key, code, repeat, bubbles: true })
      );
    });
  }

  it("holds the cabinet's Sprint 1 in the room until the first key", async () => {
    await render(inCabinet(<WorkingWithDuck />));

    expect(briefing()).toBeNull();
    expect(container.textContent).toContain("start the clock");
    expect(launchButton().disabled).toBe(false);

    now += 1000;
    await pressOnCanvas("q", "KeyQ");
    expect(launchButton().disabled).toBe(true);
  });

  it("starts the cabinet's Sprint 1 on a click in the room", async () => {
    await render(inCabinet(<WorkingWithDuck />));
    const canvas = container.querySelector("canvas")!;
    await act(async () => {
      canvas.dispatchEvent(
        new MouseEvent("mousedown", { clientX: 10, clientY: 10, bubbles: true })
      );
    });
    expect(launchButton().disabled).toBe(true);
  });

  it("opens the next sprint on its briefing, Start focused, ignoring leftover keys", async () => {
    const won: WorkingWithDuckState = {
      ...createInitialDuckGameState(1),
      status: "won",
      totalScore: 900,
    };
    await render(<WorkingWithDuck initialState={won} />);

    const proceed = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Proceed to Sprint 2")
    )!;
    await act(async () => {
      proceed.dispatchEvent(
        new MouseEvent("click", { detail: 1, bubbles: true })
      );
    });

    expect(briefing()?.textContent).toContain("Sprint 2 of 5");
    const start = Array.from(briefing()!.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Start Sprint 2")
    )!;
    expect(document.activeElement).toBe(start);
    expect(launchButton().disabled).toBe(false);

    // An Enter pressed as the briefing opens is left over from the card.
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
      start.click();
    });
    expect(briefing()).not.toBeNull();

    now += 1000;
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
      start.click();
    });
    expect(briefing()).toBeNull();
    expect(launchButton().disabled).toBe(true);
  });

  it("starts from the briefing with Space, not a held key", async () => {
    await render(<WorkingWithDuck />);
    expect(briefing()?.textContent).toContain("Press Space or Enter to start");

    now += 1000;
    await pressOnCanvas(" ", "Space", true);
    expect(briefing()).not.toBeNull();

    await pressOnCanvas(" ", "Space");
    expect(briefing()).toBeNull();
  });
});
