/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
//
// #1318: pausing looked the same as live play, the round bezel clipped the
// top HUD, the STK obstacle crashed as "Symbol Not Found" and NULL's stack
// trace disagreed with its title, Escape (which exits fullscreen) doubled as
// GC, Book Consultation outranked Reboot on game over, and picking another
// device mid-run silently threw the run away.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  createInitialState,
  startGame,
  updateGameSimulation,
  renderCanvasFrame,
  GROUND_Y,
  type GameEngineState,
  type ObstacleType,
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

function running(overrides: Partial<GameEngineState> = {}): GameEngineState {
  return {
    ...startGame(createInitialState("fenix", 0), "fenix"),
    obstacles: [],
    lastObstacleTime: Date.now() + 60_000,
    ...overrides,
  };
}

function textCalls(): Array<[string, number, number]> {
  return mockCtx.fillText.mock.calls.map(
    (c: unknown[]) => [String(c[0]), Number(c[1]), Number(c[2])] as const
  ) as Array<[string, number, number]>;
}

beforeEach(() => {
  mockCtx.fillText.mockClear();
});

describe("Garmin paused frame (#1318)", () => {
  it("draws PAUSED over the frame only while paused", () => {
    renderCanvasFrame(mockCtx as any, running());
    expect(textCalls().some(([t]) => t === "PAUSED")).toBe(false);

    mockCtx.fillText.mockClear();
    renderCanvasFrame(mockCtx as any, running({ gameState: "paused" }));
    expect(textCalls().some(([t]) => t === "PAUSED")).toBe(true);
  });
});

describe("Garmin top HUD stays inside the round display (#1318)", () => {
  // Visible half-width of the r=138 display at a given height.
  const halfChord = (y: number) => Math.sqrt(138 ** 2 - (140 - y) ** 2);

  it("insets BAT and the device name from the bezel", () => {
    renderCanvasFrame(mockCtx as any, running());
    const calls = textCalls();
    const bat = calls.find(([t]) => t.startsWith("BAT:"))!;
    const device = calls.find(([t]) => t === "FENIX")!;
    // 9px labels: check the cap-height row (y - 8), where the chord is narrowest.
    expect(bat[1]).toBeGreaterThanOrEqual(140 - halfChord(bat[2] - 8) + 10);
    // measureText is stubbed at 40px wide for the right-aligned label.
    expect(device[1]).toBeLessThanOrEqual(140 + halfChord(device[2] - 8) - 10);
  });
});

describe("Garmin crash types match their obstacle (#1318)", () => {
  function crashInto(type: ObstacleType, label: string) {
    return updateGameSimulation(
      running({
        obstacles: [
          {
            id: 1,
            x: 52,
            y: GROUND_Y - 20,
            width: 16,
            height: 20,
            type,
            label,
            speed: 2.2,
          },
        ],
      }),
      16.6
    ).crashReport!;
  }

  it("NULL crashes as a null pointer, and its trace says so", () => {
    const report = crashInto("null_pointer", "NULL");
    expect(report.errorType).toBe("Null Pointer");
    expect(report.stackTrace.join(" ")).toMatch(/Null Pointer/);
    expect(report.stackTrace.join(" ")).not.toMatch(/Symbol Not Found/);
  });

  it("STK crashes as a stack overflow, and its trace says so", () => {
    const report = crashInto("stack_overflow", "STK");
    expect(report.errorType).toBe("Stack Overflow");
    expect(report.stackTrace.join(" ")).toMatch(/Stack Overflow/);
    expect(report.stackTrace.join(" ")).not.toMatch(/Symbol Not Found/);
  });
});

describe("Garmin controls (#1318)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function render(state: GameEngineState) {
    await act(async () => {
      root.render(<GarminWatchSimulator initialState={state} />);
    });
  }

  async function press(key: string) {
    const chassis = container.querySelector(".garmin-chassis")!;
    await act(async () => {
      chassis.dispatchEvent(
        new KeyboardEvent("keydown", { key, bubbles: true })
      );
    });
  }

  it("G runs GC and Escape does not", async () => {
    const withGarbage = running({
      variables: [
        ...running().variables,
        { id: 9, name: "tmp", type: "array", sizeKb: 4, allocatedAt: 1 },
      ],
      allocatedRamKb: 5.8,
    });
    await render(withGarbage);
    await press("Escape");
    expect(container.textContent).not.toMatch(
      /Garbage collection (ran|freed)/i
    );
    const ramBefore = container.querySelector(
      'output[for="garmin-ram"]'
    )?.textContent;
    expect(ramBefore).toContain("5.8");

    await press("g");
    await act(async () => {
      vi.advanceTimersByTime(50);
    });
    const ramAfter = container.querySelector(
      'output[for="garmin-ram"]'
    )?.textContent;
    expect(ramAfter).not.toContain("5.8");
  });

  it("makes Reboot & Restart the first, primary game-over action", async () => {
    await render(
      running({
        gameState: "crashed",
        crashReport: {
          errorType: "Null Pointer",
          file: "Garmin_Schvitz_App.mc",
          line: 77,
          stackTrace: [],
          heapUsedKb: 2,
          heapLimitKb: 32,
        },
      })
    );
    const actions = Array.from(container.querySelectorAll("button, a")).filter(
      (el) => /Reboot|Book Consultation/.test(el.textContent || "")
    );
    expect(actions.map((el) => el.textContent?.trim())).toEqual([
      "Reboot & Restart",
      "Book Consultation",
    ]);
    expect(actions[0].className).toContain("bg-emerald-500");
    expect(actions[1].className).not.toContain("bg-emerald-500");
  });

  it("asks before switching device mid-run and keeps the run on Cancel", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    await render(running({ score: 321 }));
    const forerunner = Array.from(container.querySelectorAll("button")).find(
      (b) => /Forerunner/.test(b.textContent || "")
    )!;
    await act(async () => {
      forerunner.click();
    });
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(
      container.querySelector('output[for="garmin-device"]')?.textContent
    ).toMatch(/F.nix/i);

    confirm.mockReturnValue(true);
    await act(async () => {
      forerunner.click();
    });
    expect(
      container.querySelector('output[for="garmin-device"]')?.textContent
    ).toMatch(/Forerunner/i);
  });

  it("switches device without asking while idle", async () => {
    const confirm = vi.spyOn(window, "confirm");
    await render(createInitialState("fenix", 0));
    const edge = Array.from(container.querySelectorAll("button")).find((b) =>
      /Edge/.test(b.textContent || "")
    )!;
    await act(async () => {
      edge.click();
    });
    expect(confirm).not.toHaveBeenCalled();
    expect(
      container.querySelector('output[for="garmin-device"]')?.textContent
    ).toMatch(/Edge/i);
  });
});
