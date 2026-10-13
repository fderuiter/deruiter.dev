/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { GarminWatchSimulator } from "@/components/GarminWatchSimulator";
import { triggerHaptic } from "@/lib/haptics";

const mockAnnounce = vi.fn();
vi.mock("@/hooks/useAnnouncer", () => ({
  useAnnouncer: () => ({
    announce: mockAnnounce,
  }),
}));

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

describe("GarminWatchSimulator Accessibility & Gesture Suite", () => {
  let container: HTMLDivElement;
  let root: Root;
  let mockVibrate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockVibrate = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, "vibrate", {
      value: mockVibrate,
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

  it("should trigger triggerHaptic gracefully without crashing when vibrate is available", () => {
    triggerHaptic(15);
    expect(mockVibrate).toHaveBeenCalledWith(15);
  });

  it("should render canvas with image semantics (role='img') and dynamic aria-label", async () => {
    await act(async () => {
      root.render(<GarminWatchSimulator />);
    });

    const canvas = container.querySelector("canvas");
    expect(canvas).not.toBeNull();
    expect(canvas?.getAttribute("role")).toBe("img");
    expect(canvas?.getAttribute("aria-label")).toContain(
      "Smartwatch display simulator"
    );
    expect(canvas?.getAttribute("aria-label")).toContain("Memory:");
  });

  it("should render off-screen polite telemetry mirror and assertive alert regions", async () => {
    await act(async () => {
      root.render(<GarminWatchSimulator />);
    });

    const politeRegion = container.querySelector('[aria-live="polite"]');
    const assertiveRegion = container.querySelector(
      '[role="alert"][aria-live="assertive"]'
    );

    expect(politeRegion).not.toBeNull();
    expect(politeRegion?.textContent).toContain("Garmin Simulator Telemetry");

    expect(assertiveRegion).not.toBeNull();
  });

  it("should handle directional touch swipe gestures on canvas with haptic feedback", async () => {
    await act(async () => {
      root.render(<GarminWatchSimulator />);
    });

    const canvas = container.querySelector("canvas");
    expect(canvas).not.toBeNull();

    // 1. Swipe Right (Start Simulation)
    await act(async () => {
      canvas?.dispatchEvent(
        new PointerEvent("pointerdown", {
          clientX: 100,
          clientY: 100,
          bubbles: true,
          buttons: 1,
        })
      );
      canvas?.dispatchEvent(
        new PointerEvent("pointermove", {
          clientX: 150,
          clientY: 100,
          bubbles: true,
          buttons: 1,
        })
      );
      canvas?.dispatchEvent(
        new PointerEvent("pointerup", {
          clientX: 150,
          clientY: 100,
          bubbles: true,
        })
      );
    });

    expect(mockVibrate).toHaveBeenCalledWith(15);
    expect(mockRecordEvent).toHaveBeenCalledWith(
      "garmin_simulator_start",
      "project_click"
    );

    // 2. Swipe Up (Jump)
    await act(async () => {
      canvas?.dispatchEvent(
        new PointerEvent("pointerdown", {
          clientX: 100,
          clientY: 100,
          bubbles: true,
          buttons: 1,
        })
      );
      canvas?.dispatchEvent(
        new PointerEvent("pointermove", {
          clientX: 100,
          clientY: 50,
          bubbles: true,
          buttons: 1,
        })
      );
      canvas?.dispatchEvent(
        new PointerEvent("pointerup", {
          clientX: 100,
          clientY: 50,
          bubbles: true,
        })
      );
    });

    expect(mockVibrate).toHaveBeenCalledWith(15);

    // 3. Swipe Down (Jettison)
    await act(async () => {
      canvas?.dispatchEvent(
        new PointerEvent("pointerdown", {
          clientX: 100,
          clientY: 50,
          bubbles: true,
          buttons: 1,
        })
      );
      canvas?.dispatchEvent(
        new PointerEvent("pointermove", {
          clientX: 100,
          clientY: 100,
          bubbles: true,
          buttons: 1,
        })
      );
      canvas?.dispatchEvent(
        new PointerEvent("pointerup", {
          clientX: 100,
          clientY: 100,
          bubbles: true,
        })
      );
    });

    expect(mockVibrate).toHaveBeenCalledWith(15);

    // 4. Swipe Left (Force GC)
    await act(async () => {
      canvas?.dispatchEvent(
        new PointerEvent("pointerdown", {
          clientX: 150,
          clientY: 100,
          bubbles: true,
          buttons: 1,
        })
      );
      canvas?.dispatchEvent(
        new PointerEvent("pointermove", {
          clientX: 100,
          clientY: 100,
          bubbles: true,
          buttons: 1,
        })
      );
      canvas?.dispatchEvent(
        new PointerEvent("pointerup", {
          clientX: 100,
          clientY: 100,
          bubbles: true,
        })
      );
    });

    expect(mockVibrate).toHaveBeenCalledWith(15);
  });

  it("should trigger haptic feedback on bezel button clicks", async () => {
    await act(async () => {
      root.render(<GarminWatchSimulator />);
    });

    const upBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("UP")
    );
    expect(upBtn).toBeDefined();

    await act(async () => {
      upBtn?.click();
    });

    expect(mockVibrate).toHaveBeenCalledWith(20);
  });
});
