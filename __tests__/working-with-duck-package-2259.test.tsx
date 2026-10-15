// @vitest-environment jsdom
//
// #2259: the package at the back door can be claimed with the D key or a
// dock button, not only by clicking the door, and it pays once.

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
import { safeClear } from "@/lib/safe-storage";

function running(
  overrides: Partial<WorkingWithDuckState> = {}
): WorkingWithDuckState {
  return {
    ...createInitialDuckGameState(1),
    status: "running",
    totalScore: 1000,
    ...overrides,
  };
}

const delivery = {
  type: "amazon-delivery" as const,
  timer: 300,
  maxTimer: 300,
  resolved: false,
};

describe("Working With Duck package delivery controls (#2259)", () => {
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

  const score = () =>
    container.querySelector('[data-testid="duck-hud-score-value"]')
      ?.textContent;
  const button = () =>
    container.querySelector<HTMLButtonElement>(
      '[data-testid="duck-package-button"]'
    );

  async function pressD() {
    const canvas = container.querySelector<HTMLCanvasElement>(
      'canvas[role="application"]'
    )!;
    await act(async () => {
      canvas.focus();
      canvas.dispatchEvent(
        new KeyboardEvent("keydown", { key: "d", code: "KeyD", bubbles: true })
      );
    });
  }

  it("claims the package with D, once", async () => {
    await render(running({ activeSurpriseEvent: delivery }));
    expect(button()).not.toBeNull();
    await pressD();
    expect(score()).toContain("1150");
    expect(button()).toBeNull();
    expect(announce).toHaveBeenCalledWith(
      "Package retrieved. Plus 150 points.",
      "polite"
    );
    await pressD();
    expect(score()).toContain("1150");
  });

  it("claims the package from the dock button", async () => {
    await render(running({ activeSurpriseEvent: delivery }));
    await act(async () => {
      button()!.click();
    });
    expect(score()).toContain("1150");
    expect(button()).toBeNull();
  });

  it("offers no package button and ignores D with nobody at the door", async () => {
    await render(running());
    expect(button()).toBeNull();
    await pressD();
    expect(score()).toContain("1000");
    expect(announce).not.toHaveBeenCalledWith(
      "Package retrieved. Plus 150 points.",
      "polite"
    );
  });
});
