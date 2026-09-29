import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { GarminWatchSimulator } from "@/components/GarminWatchSimulator";
import {
  FLASH_STORAGE_KEY,
  createInitialState,
  type GameEngineState,
} from "@/lib/garmin-engine";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({
    playNote: vi.fn(),
    playSuccess: vi.fn(),
    playError: vi.fn(),
    isMuted: true,
  }),
}));
vi.mock("@/hooks/useTelemetry", () => ({
  useTelemetry: () => ({ recordEvent: vi.fn() }),
}));
vi.mock("@/hooks/useAnnouncer", () => ({
  useAnnouncer: () => ({ announce: vi.fn() }),
}));

describe("Garmin NV flash write and clear (#1210)", () => {
  let container: HTMLDivElement;
  let root: Root;
  let store: Record<string, string>;

  const button = (label: RegExp) =>
    Array.from(container.querySelectorAll("button")).find((b) =>
      label.test(b.textContent ?? "")
    ) as HTMLButtonElement;

  const render = async (initialState?: GameEngineState) => {
    await act(async () => {
      root.render(<GarminWatchSimulator initialState={initialState} />);
    });
  };

  const meter = () => container.textContent ?? "";

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

  it("Write NV Flash adds 8 KB of flash, leaves RAM alone and persists", async () => {
    await render(createInitialState("fenix", 0));
    expect(meter()).toContain("RAM Memory: 1.8");
    await act(async () => {
      button(/Write NV Flash/).click();
    });
    expect(meter()).toContain("RAM Memory: 1.8");
    expect(meter()).toContain("12.0");
    expect(JSON.parse(store[FLASH_STORAGE_KEY])).toHaveLength(2);
  });

  it("refuses an overflowing write with a flash error, without crashing or touching RAM", async () => {
    const base = createInitialState("fenix", 0);
    await render({ ...base, allocatedFlashKb: 60 });
    await act(async () => {
      button(/Write NV Flash/).click();
    });
    expect(meter()).toContain("Out of Storage");
    expect(meter()).toContain("RAM Memory: 1.8");
    expect(store[FLASH_STORAGE_KEY]).toBeUndefined();
  });

  it("Clear Flash empties the meter and persistence, and a restart stays empty", async () => {
    await render(createInitialState("fenix", 0));
    await act(async () => {
      button(/Clear Flash Storage/).click();
    });
    expect(store[FLASH_STORAGE_KEY]).toBe("[]");
    expect(createInitialState("fenix", 0).allocatedFlashKb).toBe(0);
    expect(createInitialState("fenix", 0).flashFiles).toEqual([]);
  });
});
