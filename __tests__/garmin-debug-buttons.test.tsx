/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
//
// #1317: "Write NV Flash (+8KB)" added a float to RAM instead of 8 KB to
// flash, "Clear Flash Storage" wrote a field the engine never reads and the
// next boot re-seeded sys_log.dat, and "Drain Battery" worked while idle
// only for the next start to refill the battery.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  createInitialState,
  startGame,
  clearFlashStorage,
  FLASH_STORAGE_KEY,
} from "@/lib/garmin-engine";
import { SyncFlashStorageHandler } from "@/lib/services";

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

describe("Garmin flash storage boot (#1317)", () => {
  it("seeds sys_log.dat on a first boot with nothing saved", () => {
    const state = createInitialState("fenix");
    expect(state.flashVariables.map((v) => v.name)).toEqual(["sys_log.dat"]);
    expect(state.allocatedFlashKb).toBe(4);
  });

  it("keeps a cleared store empty on the next boot and the next run", () => {
    clearFlashStorage(createInitialState("fenix"));
    expect(createInitialState("fenix").allocatedFlashKb).toBe(0);
    expect(startGame(createInitialState("fenix")).flashVariables).toEqual([]);
  });

  it("the service's clear action also keeps the store empty", async () => {
    const result = await new SyncFlashStorageHandler().execute({
      action: "clear",
    });
    expect(result.success).toBe(true);
    expect(store[FLASH_STORAGE_KEY]).toBe("[]");
    expect(createInitialState("fenix").allocatedFlashKb).toBe(0);
  });
});

describe("Garmin debug buttons (#1317)", () => {
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
  });

  function button(label: RegExp): HTMLButtonElement {
    const found = Array.from(container.querySelectorAll("button")).find((b) =>
      label.test(b.textContent || "")
    );
    expect(found).toBeDefined();
    return found!;
  }

  function reading(label: "RAM" | "FLASH"): string {
    const span = Array.from(container.querySelectorAll("span")).find((s) =>
      s.textContent?.startsWith(`${label}:`)
    );
    return span?.querySelector("strong")?.textContent ?? "";
  }

  async function render() {
    await act(async () => {
      root.render(<GarminWatchSimulator />);
    });
  }

  it("Write NV Flash adds 8 KB to flash and leaves RAM alone", async () => {
    await render();
    expect(reading("RAM")).toMatch(/^1\.8 /);
    expect(reading("FLASH")).toMatch(/^4\.0 /);

    await act(async () => {
      button(/Write NV Flash/).click();
    });

    expect(reading("RAM")).toMatch(/^1\.8 /);
    expect(reading("FLASH")).toMatch(/^12\.0 /);
    expect(JSON.parse(store[FLASH_STORAGE_KEY])).toHaveLength(2);
  });

  it("Clear Flash Storage empties flash and it stays empty after Start", async () => {
    await render();
    await act(async () => {
      button(/Clear Flash Storage/).click();
    });
    expect(reading("FLASH")).toMatch(/^0\.0 /);

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    });
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    expect(createInitialState("fenix").allocatedFlashKb).toBe(0);
    expect(reading("FLASH")).toMatch(/^0\.0 /);
  });

  it("Drain Battery is disabled until a run starts", async () => {
    await render();
    expect(button(/Drain Battery/).disabled).toBe(true);

    await act(async () => {
      root.render(
        <GarminWatchSimulator
          key="running"
          initialState={{
            ...startGame(createInitialState("fenix", 0), "fenix"),
            obstacles: [],
            lastObstacleTime: Date.now() + 60_000,
          }}
        />
      );
    });
    const drain = button(/Drain Battery/);
    expect(drain.disabled).toBe(false);
    await act(async () => {
      drain.click();
    });
    const battery = container.querySelector('output[for="garmin-battery"]');
    expect(battery?.textContent).toMatch(/Battery Level: 8\d%/);
  });
});
