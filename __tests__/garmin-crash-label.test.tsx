/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  createInitialState,
  startGame,
  type CrashReport,
} from "@/lib/garmin-engine";

global.ResizeObserver = class {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
} as any;

global.IntersectionObserver = class {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
} as any;

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
  clip: vi.fn(),
  fill: vi.fn(),
  stroke: vi.fn(),
  fillText: vi.fn(),
  measureText: vi.fn(() => ({ width: 40 })),
  createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  setLineDash: vi.fn(),
};

HTMLCanvasElement.prototype.getContext = vi.fn(() => mockCtx as any);
HTMLCanvasElement.prototype.getBoundingClientRect = vi.fn(() => ({
  left: 0,
  top: 0,
  width: 280,
  height: 280,
  right: 280,
  bottom: 280,
  x: 0,
  y: 0,
  toJSON: () => {},
}));

vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({
    playNote: vi.fn(),
    playSuccess: vi.fn(),
    playHover: vi.fn(),
  }),
  AudioProvider: ({ children }: any) => <>{children}</>,
}));

vi.mock("@/hooks/useTelemetry", () => ({
  useTelemetry: () => ({
    recordEvent: vi.fn().mockResolvedValue(true),
  }),
}));

import { GarminWatchSimulator } from "@/components/GarminWatchSimulator";

function crashedWith(errorType: CrashReport["errorType"]) {
  return {
    ...startGame(createInitialState("fenix", 0), "fenix"),
    gameState: "crashed" as const,
    crashReport: {
      errorType,
      file: "Garmin_Schvitz_App.mc",
      line: 42,
      stackTrace: [],
      heapUsedKb: 10,
      heapLimitKb: 128,
    },
  };
}

describe("Garmin Watch crash overlay names the real cause (#1177)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it.each([
    ["Out Of Memory", "OUT OF MEMORY", "force GC"],
    ["Out Of Storage", "OUT OF FLASH STORAGE", "flash tokens"],
    ["Watchdog Tripped", "WATCHDOG TRIPPED", "Jump (Up)"],
    ["Null Pointer", "NULL POINTER", "Jump (Up)"],
    ["Symbol Not Found", "SYMBOL NOT FOUND", "Jump (Up)"],
    ["Stack Overflow", "STACK OVERFLOW", "Jump (Up)"],
  ] as const)(
    "titles a %s crash as %s with a hint",
    async (type, title, hint) => {
      await act(async () => {
        root.render(<GarminWatchSimulator initialState={crashedWith(type)} />);
      });
      expect(container.textContent).toContain(title);
      expect(container.textContent).toContain(hint);
      expect(container.textContent).not.toContain("CRASH / OOM");
    }
  );

  // #1557: a translucent DOM card over the canvas crash screen let both
  // titles show at once. The crash now has one layer (#1520): the canvas
  // draws the IQ! error face and no DOM text sits over the watch screen;
  // the words live in the result card beside the watch.
  it("draws the crash on the watch screen in one layer", async () => {
    await act(async () => {
      root.render(
        <GarminWatchSimulator initialState={crashedWith("Null Pointer")} />
      );
    });
    const screen = container.querySelector('[data-testid="garmin-screen"]');
    expect(screen).not.toBeNull();
    expect(screen?.textContent?.trim()).toBe("");
    expect(
      container.querySelector('[data-testid="garmin-end-overlay"]')
    ).toBeNull();
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain("NULL POINTER");
    expect(screen?.contains(dialog)).toBe(false);
  });
});
