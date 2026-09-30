/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { LaserLoon } from "@/components/LaserLoon";

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

describe("LaserLoon React Component UI Suite", () => {
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

    // Mock HTMLCanvasElement 2D context
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
      quadraticCurveTo: vi.fn(),
      bezierCurveTo: vi.fn(),
      arc: vi.fn(),
      ellipse: vi.fn(),
      clip: vi.fn(),
      drawImage: vi.fn(),
      roundRect: vi.fn(),
      rect: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillText: vi.fn(),
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
      width: 768,
      height: 420,
      right: 768,
      bottom: 420,
      x: 0,
      y: 0,
      toJSON: () => {},
    }));

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    vi.clearAllMocks();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("should mount and render the header HUD and mode tabs", async () => {
    await act(async () => {
      root.render(<LaserLoon />);
    });

    expect(container.textContent).toContain("Campaign");
    expect(container.textContent).toContain("Arcade Survival");
    expect(container.textContent).toContain("Zero-G Sandbox");
    expect(container.textContent).toContain("Ruby (1)");
    expect(container.textContent).toContain("Pulse (2)");
    expect(container.textContent).toContain("SCORE:");
    expect(container.textContent).toContain("HI:");
  });

  it("should enforce keyboard boundary attribute on container", async () => {
    await act(async () => {
      root.render(<LaserLoon />);
    });

    const boundary = container.querySelector('[data-keyboard-boundary="true"]');
    expect(boundary).not.toBeNull();
    expect(boundary?.getAttribute("tabIndex")).toBe("0");
  });

  it("should switch weapon modes when weapon buttons are clicked", async () => {
    await act(async () => {
      root.render(<LaserLoon />);
    });

    const pulseBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Pulse (2)")
    );
    expect(pulseBtn).toBeDefined();

    await act(async () => {
      pulseBtn?.click();
    });

    expect(pulseBtn?.className).toContain("bg-cyan-500/20");
  });

  it("should switch to sandbox mode when clicking Zero-G Sandbox tab", async () => {
    await act(async () => {
      root.render(<LaserLoon />);
    });

    const sandboxBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Zero-G Sandbox")
    );
    expect(sandboxBtn).toBeDefined();

    await act(async () => {
      sandboxBtn?.click();
    });

    expect(container.textContent).toContain("GRAVITY:");
    expect(container.textContent).toContain("Zero-G");
    expect(container.textContent).toContain("Launch Cryo-Mortar");
  });

  it("should toggle screen shake option", async () => {
    await act(async () => {
      root.render(<LaserLoon />);
    });

    const shakeBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Screen Shake: ON")
    );
    expect(shakeBtn).toBeDefined();

    await act(async () => {
      shakeBtn?.click();
    });

    expect(shakeBtn?.textContent).toContain("Screen Shake: OFF");
  });

  it("should start game when Start Campaign button is clicked", async () => {
    await act(async () => {
      root.render(<LaserLoon />);
    });

    const startBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("START CAMPAIGN")
    );
    expect(startBtn).toBeDefined();

    await act(async () => {
      startBtn?.click();
    });

    expect(mockRecordEvent).toHaveBeenCalledWith(
      "laser_loon_start",
      "project_click"
    );
  });

  it("should handle keyboard shortcuts for weapon switching and spacebar start", async () => {
    await act(async () => {
      root.render(<LaserLoon />);
    });

    const boundary = container.querySelector(
      '[data-keyboard-boundary="true"]'
    ) as HTMLDivElement;

    await act(async () => {
      boundary.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: " ",
          bubbles: true,
          cancelable: true,
        })
      );
    });

    expect(mockRecordEvent).toHaveBeenCalledWith(
      "laser_loon_start",
      "project_click"
    );

    await act(async () => {
      boundary.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "3",
          bubbles: true,
          cancelable: true,
        })
      );
    });

    const auroraBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Aurora (3)")
    );
    expect(auroraBtn?.className).toContain("bg-emerald-500/20");
  });

  it("should load existing high score from localStorage", async () => {
    mockStorage.setItem("laser_loon_high_score", "7500");

    await act(async () => {
      root.render(<LaserLoon />);
    });

    expect(container.textContent).toContain("7500");
  });
});
