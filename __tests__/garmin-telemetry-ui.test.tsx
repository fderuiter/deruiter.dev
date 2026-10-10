/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
//
// Run telemetry exports and the configurable ground strip in the companion
// panel.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createInitialState, startGame } from "@/lib/garmin-engine";

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

const downloadFile = vi.hoisted(() => vi.fn(() => true));
vi.mock("@/lib/download", () => ({ downloadFile }));

import { GarminWatchSimulator } from "@/components/GarminWatchSimulator";

let store: Record<string, string>;

beforeEach(() => {
  store = {};
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = String(value);
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        store = {};
      },
    },
  });
});

describe("Garmin telemetry and ground strip", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    downloadFile.mockClear();
    mockCtx.fillText.mockClear();
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
  });

  function button(label: RegExp): HTMLButtonElement {
    const found = Array.from(container.querySelectorAll("button")).find((b) =>
      label.test(b.textContent || "")
    );
    expect(found).toBeDefined();
    return found!;
  }

  function slot(name: string): HTMLSelectElement {
    const label = Array.from(container.querySelectorAll("label")).find((l) =>
      l.textContent?.trim().startsWith(name)
    );
    expect(label).toBeDefined();
    return label!.querySelector("select")!;
  }

  const runningState = () => ({
    ...startGame(createInitialState("fenix", 0), "fenix"),
    obstacles: [],
    lastObstacleTime: Date.now() + 600_000,
  });

  async function renderRunning() {
    await act(async () => {
      root.render(<GarminWatchSimulator initialState={runningState()} />);
    });
  }

  it("starts with no samples and disabled downloads", async () => {
    await act(async () => {
      root.render(<GarminWatchSimulator />);
    });
    expect(container.textContent).toMatch(/0 samples/);
    expect(button(/Download CSV/).disabled).toBe(true);
    expect(button(/Download FIT/).disabled).toBe(true);
  });

  it("records a sample per second of play and downloads both formats", async () => {
    await renderRunning();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3200);
    });
    expect(container.textContent).toMatch(/[1-9]\d* samples?/);

    await act(async () => {
      button(/Download CSV/).click();
    });
    await act(async () => {
      button(/Download FIT/).click();
    });
    expect(downloadFile).toHaveBeenCalledTimes(2);
    const [csv, csvName] = downloadFile.mock.calls[0] as unknown as [
      string,
      string,
    ];
    expect(csv.split("\n")[0]).toMatch(/^t_sec,heart_rate_bpm/);
    expect(csvName).toMatch(/^garmin-run-\d{8}-\d{6}\.csv$/);
    const [fit, fitName] = downloadFile.mock.calls[1] as unknown as [
      Uint8Array,
      string,
    ];
    expect(fit).toBeInstanceOf(Uint8Array);
    expect(fitName).toMatch(/\.fit$/);
  });

  it("offers every field in each slot and defaults to steps, distance, vars", async () => {
    await act(async () => {
      root.render(<GarminWatchSimulator />);
    });
    expect(slot("Left").value).toBe("steps");
    expect(slot("Center").value).toBe("distance");
    expect(slot("Right").value).toBe("vars");
    expect(slot("Left").options).toHaveLength(8);
  });

  it("saves a changed slot, draws it, and restores the defaults on reset", async () => {
    await renderRunning();
    await act(async () => {
      const select = slot("Left");
      select.value = "heartRate";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(JSON.parse(store.garmin_ground_strip)).toEqual([
      "heartRate",
      "distance",
      "vars",
    ]);
    mockCtx.fillText.mockClear();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    const drawn = mockCtx.fillText.mock.calls.map((c) => String(c[0]));
    expect(drawn).toContain("BPM");
    expect(drawn).not.toContain("STEPS");

    await act(async () => {
      button(/Reset strip/).click();
    });
    expect(JSON.parse(store.garmin_ground_strip)).toEqual([
      "steps",
      "distance",
      "vars",
    ]);
    expect(slot("Left").value).toBe("steps");
  });

  it("loads a saved layout after mount", async () => {
    store.garmin_ground_strip = JSON.stringify(["fog", "thermal", "ram"]);
    await act(async () => {
      root.render(<GarminWatchSimulator />);
    });
    expect(slot("Left").value).toBe("fog");
    expect(slot("Center").value).toBe("thermal");
    expect(slot("Right").value).toBe("ram");
  });
});
