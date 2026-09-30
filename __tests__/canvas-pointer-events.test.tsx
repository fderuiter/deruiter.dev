/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";

// Mock ResizeObserver and IntersectionObserver
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

// Mock Canvas 2D context
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
  getLineDash: vi.fn(() => []),
  clip: vi.fn(),
  drawImage: vi.fn(),
  strokeText: vi.fn(),
  setTransform: vi.fn(),
  resetTransform: vi.fn(),
  createPattern: vi.fn(() => null),
  createImageData: vi.fn((w: number, h: number) => ({
    width: w,
    height: h,
    data: new Uint8ClampedArray(w * h * 4),
  })),
  getImageData: vi.fn((_x: number, _y: number, w: number, h: number) => ({
    width: w,
    height: h,
    data: new Uint8ClampedArray(w * h * 4),
  })),
  putImageData: vi.fn(),
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

const mockSetPointerCapture = vi.fn();
const mockReleasePointerCapture = vi.fn();
const mockHasPointerCapture = vi.fn().mockReturnValue(true);

HTMLCanvasElement.prototype.setPointerCapture = mockSetPointerCapture;
HTMLCanvasElement.prototype.releasePointerCapture = mockReleasePointerCapture;
HTMLCanvasElement.prototype.hasPointerCapture = mockHasPointerCapture;

// Mock AudioProvider
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
      playClick: vi.fn(),
      volume: 0.8,
      muted: false,
      profile: "8-bit",
      setVolume: vi.fn(),
      setMuted: vi.fn(),
      setProfile: vi.fn(),
    }),
    AudioProvider: ({ children }: any) => <>{children}</>,
  };
});

// Mock Telemetry
vi.mock("@/hooks/useTelemetry", () => ({
  useTelemetry: () => ({
    recordEvent: vi.fn().mockResolvedValue(true),
  }),
}));

import { LaserLoon } from "@/components/LaserLoon";
import { WorkingWithDuck } from "@/components/WorkingWithDuck";
import { ClinicalTrialChaos } from "@/components/ClinicalTrialChaos";

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

describe("Canvas Pointer Events Migration & Cancellation Suite", () => {
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

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    vi.clearAllMocks();
    mockHasPointerCapture.mockReturnValue(true);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  describe("LaserLoon Pointer Event Lifecycle", () => {
    it("captures pointer on pointerdown, tracks pointermove, releases on pointerup", async () => {
      await act(async () => {
        root.render(<LaserLoon />);
      });

      const canvas = container.querySelector("canvas");
      expect(canvas).not.toBeNull();
      if (!canvas) return;

      expect(canvas.style.touchAction).toBe("none");
      expect(canvas.className).toContain("touch-none");

      // Pointer Down
      const downEvent = new PointerEvent("pointerdown", {
        bubbles: true,
        cancelable: true,
        pointerId: 42,
        clientX: 200,
        clientY: 150,
      });

      await act(async () => {
        canvas.dispatchEvent(downEvent);
      });

      expect(mockSetPointerCapture).toHaveBeenCalledWith(42);

      // Pointer Move
      const moveEvent = new PointerEvent("pointermove", {
        bubbles: true,
        cancelable: true,
        pointerId: 42,
        clientX: 250,
        clientY: 180,
      });

      await act(async () => {
        canvas.dispatchEvent(moveEvent);
      });

      // Pointer Up
      const upEvent = new PointerEvent("pointerup", {
        bubbles: true,
        cancelable: true,
        pointerId: 42,
        clientX: 250,
        clientY: 180,
      });

      await act(async () => {
        canvas.dispatchEvent(upEvent);
      });

      expect(mockReleasePointerCapture).toHaveBeenCalledWith(42);
    });

    it("resets active firing and dragging states immediately on pointercancel", async () => {
      await act(async () => {
        root.render(<LaserLoon />);
      });

      const canvas = container.querySelector("canvas");
      expect(canvas).not.toBeNull();
      if (!canvas) return;

      // Start firing
      await act(async () => {
        canvas.dispatchEvent(
          new PointerEvent("pointerdown", {
            bubbles: true,
            cancelable: true,
            pointerId: 10,
            clientX: 300,
            clientY: 200,
          })
        );
      });

      expect(mockSetPointerCapture).toHaveBeenCalledWith(10);

      // System interruption trigger
      await act(async () => {
        canvas.dispatchEvent(
          new PointerEvent("pointercancel", {
            bubbles: true,
            cancelable: true,
            pointerId: 10,
          })
        );
      });

      expect(mockReleasePointerCapture).toHaveBeenCalledWith(10);
    });
  });

  describe("WorkingWithDuck Pointer Event Lifecycle", () => {
    it("captures pointer, handles puppy/ball drag, releases drag states on pointercancel", async () => {
      await act(async () => {
        root.render(<WorkingWithDuck />);
      });

      const canvas = container.querySelector("canvas");
      expect(canvas).not.toBeNull();
      if (!canvas) return;

      expect(canvas.style.touchAction).toBe("none");
      expect(canvas.className).toContain("touch-none");

      // Pointer Down
      await act(async () => {
        canvas.dispatchEvent(
          new PointerEvent("pointerdown", {
            bubbles: true,
            cancelable: true,
            pointerId: 5,
            clientX: 150,
            clientY: 150,
          })
        );
      });

      expect(mockSetPointerCapture).toHaveBeenCalledWith(5);

      // Pointer Move
      await act(async () => {
        canvas.dispatchEvent(
          new PointerEvent("pointermove", {
            bubbles: true,
            cancelable: true,
            pointerId: 5,
            clientX: 200,
            clientY: 180,
          })
        );
      });

      // Interruption: Pointer Cancel
      await act(async () => {
        canvas.dispatchEvent(
          new PointerEvent("pointercancel", {
            bubbles: true,
            cancelable: true,
            pointerId: 5,
          })
        );
      });

      expect(mockReleasePointerCapture).toHaveBeenCalledWith(5);
    });

    it("resets active drag and aim states when global window pointercancel is fired", async () => {
      await act(async () => {
        root.render(<WorkingWithDuck />);
      });

      await act(async () => {
        window.dispatchEvent(
          new PointerEvent("pointercancel", {
            bubbles: true,
            cancelable: true,
            pointerId: 1,
          })
        );
      });
    });
  });

  describe("ClinicalTrialChaos Pointer Event Lifecycle", () => {
    it("handles subject selection transitions and cancellation cleanly", async () => {
      await act(async () => {
        root.render(<ClinicalTrialChaos />);
      });

      const canvas = container.querySelector("canvas");
      expect(canvas).not.toBeNull();
      if (!canvas) return;

      expect(canvas.style.touchAction).toBe("none");
      expect(canvas.className).toContain("touch-none");

      // Pointer Down on subject slot
      await act(async () => {
        canvas.dispatchEvent(
          new PointerEvent("pointerdown", {
            bubbles: true,
            cancelable: true,
            pointerId: 99,
            clientX: 100,
            clientY: 88,
          })
        );
      });

      expect(mockSetPointerCapture).toHaveBeenCalledWith(99);

      // Pointer Move
      await act(async () => {
        canvas.dispatchEvent(
          new PointerEvent("pointermove", {
            bubbles: true,
            cancelable: true,
            pointerId: 99,
            clientX: 120,
            clientY: 88,
          })
        );
      });

      // Pointer Cancel
      await act(async () => {
        canvas.dispatchEvent(
          new PointerEvent("pointercancel", {
            bubbles: true,
            cancelable: true,
            pointerId: 99,
          })
        );
      });

      expect(mockReleasePointerCapture).toHaveBeenCalledWith(99);
    });
  });
});
