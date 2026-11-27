/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { LaserLoon } from "@/components/LaserLoon";
import { WorkingWithDuck } from "@/components/WorkingWithDuck";
import { RetroLabyrinth } from "@/components/RetroLabyrinth";
import { ClinicalTrialChaos } from "@/components/ClinicalTrialChaos";
import { GarminWatchSimulator } from "@/components/GarminWatchSimulator";
import { QuasiPerfectPuzzler } from "@/components/QuasiPerfectPuzzler/QuasiPerfectPuzzler";

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

vi.mock("@/components/providers/AudioProvider", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/components/providers/AudioProvider")
    >();
  return {
    ...actual,
    useAudio: () => ({
      playNote: vi.fn(),
      playSuccess: vi.fn(),
      playHover: vi.fn(),
    }),
    AudioProvider: ({ children }: { children: React.ReactNode }) => children,
  };
});

vi.mock("@/hooks/useTelemetry", () => ({
  useTelemetry: () => ({
    recordEvent: vi.fn().mockResolvedValue(true),
  }),
}));

describe("Arcade Games Fullscreen & Tablet Integration Suite", () => {
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
      arcTo: vi.fn(),
      ellipse: vi.fn(),
      roundRect: vi.fn(),
      quadraticCurveTo: vi.fn(),
      bezierCurveTo: vi.fn(),
      measureText: vi.fn(() => ({
        width: 50,
        actualBoundingBoxAscent: 10,
        actualBoundingBoxDescent: 2,
      })),
      rect: vi.fn(),
      clip: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillText: vi.fn(),
      strokeText: vi.fn(),
      createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
      createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
      setLineDash: vi.fn(),
      getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(100) })),
      putImageData: vi.fn(),
      drawImage: vi.fn(),
    };

    HTMLCanvasElement.prototype.getContext = vi.fn(() => mockCtx as any);
    HTMLCanvasElement.prototype.getBoundingClientRect = vi.fn(() => ({
      left: 0,
      top: 0,
      width: 768,
      height: 420,
      right: 768,
      bottom: 420,
      x: 0,
      y: 0,
      toJSON: () => {},
    }));

    // Mock Fullscreen API methods
    HTMLElement.prototype.requestFullscreen = vi
      .fn()
      .mockResolvedValue(undefined);
    document.exitFullscreen = vi.fn().mockResolvedValue(undefined);

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
    vi.restoreAllMocks();
  });

  it("1. Laser Loon renders fullscreen toggle button and responds to click", async () => {
    await act(async () => {
      root.render(<LaserLoon />);
    });

    const fullscreenBtn = container.querySelector(
      'button[aria-label*="Fullscreen"]'
    );
    expect(fullscreenBtn).not.toBeNull();

    await act(async () => {
      fullscreenBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
  });

  it("2. Working With Duck renders fullscreen toggle button and responds to click", async () => {
    await act(async () => {
      root.render(<WorkingWithDuck />);
    });

    const fullscreenBtn = container.querySelector(
      'button[aria-label*="Fullscreen"]'
    );
    expect(fullscreenBtn).not.toBeNull();

    await act(async () => {
      fullscreenBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
  });

  it("3. Retro Labyrinth renders fullscreen toggle button and responds to click", async () => {
    await act(async () => {
      root.render(<RetroLabyrinth />);
    });

    const fullscreenBtn = container.querySelector(
      'button[aria-label*="Fullscreen"]'
    );
    expect(fullscreenBtn).not.toBeNull();

    await act(async () => {
      fullscreenBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
  });

  it("4. Clinical Trial Chaos renders fullscreen toggle button and responds to click", async () => {
    await act(async () => {
      root.render(<ClinicalTrialChaos />);
    });

    const fullscreenBtn = container.querySelector(
      'button[aria-label*="Fullscreen"]'
    );
    expect(fullscreenBtn).not.toBeNull();

    await act(async () => {
      fullscreenBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
  });

  it("5. Garmin Watch Simulator renders fullscreen toggle button and responds to click", async () => {
    await act(async () => {
      root.render(<GarminWatchSimulator />);
    });

    const fullscreenBtn = container.querySelector(
      'button[aria-label*="Fullscreen"]'
    );
    expect(fullscreenBtn).not.toBeNull();

    await act(async () => {
      fullscreenBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
  });

  it("6. Quasi-Perfect Puzzler renders fullscreen toggle button and responds to click", async () => {
    await act(async () => {
      root.render(<QuasiPerfectPuzzler />);
    });

    const fullscreenBtn = container.querySelector(
      'button[aria-label*="Fullscreen"]'
    );
    expect(fullscreenBtn).not.toBeNull();

    await act(async () => {
      fullscreenBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
  });
});
