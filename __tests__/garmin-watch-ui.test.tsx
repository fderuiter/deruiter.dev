/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { GarminWatchSimulator } from "@/components/GarminWatchSimulator";

class LocalStorageMock {
  private store: Record<string, string> = {};

  getItem(key: string): string | null {
    return this.store[key] ?? null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  clear(): void {
    this.store = {};
  }

  get length(): number {
    return Object.keys(this.store).length;
  }

  key(index: number): string | null {
    return Object.keys(this.store)[index] ?? null;
  }
}

const mockPlayNote = vi.fn();
const mockPlaySuccess = vi.fn();

vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({
    playNote: mockPlayNote,
    playSuccess: mockPlaySuccess,
    playHover: vi.fn(),
  }),
  AudioProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const mockRecordEvent = vi.fn().mockResolvedValue(true);
vi.mock("@/hooks/useTelemetry", () => ({
  useTelemetry: () => ({
    recordEvent: mockRecordEvent,
  }),
}));

describe("GarminWatchSimulator React Component UI Suite", () => {
  let container: HTMLDivElement;
  let root: Root;
  let mockStorage: LocalStorageMock;

  beforeEach(() => {
    mockStorage = new LocalStorageMock();
    Object.defineProperty(window, "localStorage", {
      value: mockStorage,
      writable: true,
      configurable: true,
    });

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
      arc: vi.fn(),
      clip: vi.fn(),
      ellipse: vi.fn(),
      roundRect: vi.fn(),
      rect: vi.fn(),
      quadraticCurveTo: vi.fn(),
      bezierCurveTo: vi.fn(),
      arcTo: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn(() => ({ width: 40 })),
      createRadialGradient: vi.fn(() => ({
        addColorStop: vi.fn(),
      })),
      createLinearGradient: vi.fn(() => ({
        addColorStop: vi.fn(),
      })),
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

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    vi.clearAllMocks();
  });

  // These cover the firmware rules, which only run in Dev Mode.
  beforeEach(() => {
    window.localStorage.setItem("garmin_dev_mode", "1");
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("should mount and display hardware controls and telemetry", async () => {
    await act(async () => {
      root.render(<GarminWatchSimulator />);
    });

    expect(container.textContent).toContain("Fēnix (32KB)");
    expect(container.textContent).toContain("Forerunner (64KB)");
    expect(container.textContent).toContain("Edge (128KB)");
    expect(container.textContent).toContain("RAM:");
    expect(container.textContent).toContain("BATTERY:");
    expect(container.textContent).toContain("CONDENSATION:");
  });

  it("should enforce keyboard boundary attribute", async () => {
    await act(async () => {
      root.render(<GarminWatchSimulator />);
    });

    const boundary = container.querySelector('[data-keyboard-boundary="true"]');
    expect(boundary).not.toBeNull();
    expect(boundary?.getAttribute("tabIndex")).toBe("0");
  });

  it("should switch device targets when profile buttons are clicked", async () => {
    await act(async () => {
      root.render(<GarminWatchSimulator />);
    });

    const edgeBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Edge (128KB)")
    );
    expect(edgeBtn).toBeDefined();

    await act(async () => {
      edgeBtn?.click();
    });

    expect(container.textContent).toContain("128 KB");
  });

  it("should start simulation when START button is clicked", async () => {
    await act(async () => {
      root.render(<GarminWatchSimulator />);
    });

    const startBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("START")
    );
    expect(startBtn).toBeDefined();

    await act(async () => {
      startBtn?.click();
    });

    expect(mockRecordEvent).toHaveBeenCalledWith(
      "garmin_simulator_start",
      "project_click"
    );
    expect(mockPlaySuccess).toHaveBeenCalled();
  });

  it("should handle physical watch bezel buttons (LIGHT, UP, DOWN, GC)", async () => {
    await act(async () => {
      root.render(<GarminWatchSimulator />);
    });

    const lightBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("LIGHT")
    );
    const upBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("UP")
    );
    const downBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("DOWN")
    );
    const backBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("BACK")
    );

    expect(lightBtn).toBeDefined();
    expect(upBtn).toBeDefined();
    expect(downBtn).toBeDefined();
    expect(backBtn).toBeDefined();

    await act(async () => {
      lightBtn?.click();
      upBtn?.click();
      downBtn?.click();
      backBtn?.click();
    });

    expect(mockPlayNote).toHaveBeenCalled();
  });

  it("should load high score from localStorage", async () => {
    mockStorage.setItem("garmin_simulator_high_score", "1250");

    await act(async () => {
      root.render(<GarminWatchSimulator />);
    });

    expect(container.textContent).toContain("1250");
  });
});
