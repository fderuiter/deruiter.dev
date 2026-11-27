/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { VirtualDPad } from "@/components/ui/VirtualDPad";
import { ClinicalTrialChaos } from "@/components/ClinicalTrialChaos";

// Mock AudioProvider
vi.mock("@/components/providers/AudioProvider", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/components/providers/AudioProvider")
    >();
  return {
    ...actual,
    useAudio: () => ({
      playClick: vi.fn(),
      playNote: vi.fn(),
      playSuccess: vi.fn(),
      playHover: vi.fn(),
    }),
  };
});

// Mock Telemetry
vi.mock("@/hooks/useTelemetry", () => ({
  useTelemetry: () => ({
    recordEvent: vi.fn(),
  }),
}));

// Mock Navigator vibrate
const mockVibrate = vi.fn();
Object.defineProperty(globalThis.navigator, "vibrate", {
  value: mockVibrate,
  writable: true,
  configurable: true,
});

describe("Arcade Mobile Touch Controls & Gamepad Suite", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    mockVibrate.mockClear();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.clearAllMocks();
  });

  describe("VirtualDPad Touch & Haptic Mechanics", () => {
    it("handles touchstart and touchend with haptic vibration and dispatches direction events", async () => {
      const onDirectionPress = vi.fn();
      const onDirectionRelease = vi.fn();
      const onActionAPress = vi.fn();
      const onActionARelease = vi.fn();

      await act(async () => {
        root.render(
          <VirtualDPad
            onDirectionPress={onDirectionPress}
            onDirectionRelease={onDirectionRelease}
            onActionAPress={onActionAPress}
            onActionARelease={onActionARelease}
            actionALabel="JUMP"
          />
        );
      });

      const dpadContainer = container.querySelector(
        '[aria-label="Virtual Game Controller"]'
      );
      expect(dpadContainer).not.toBeNull();
      expect((dpadContainer as HTMLElement).style.touchAction).toBe("none");

      const upButton = container.querySelector('button[aria-label="Move Up"]');
      const jumpButton = container.querySelector('button[aria-label="JUMP"]');

      expect(upButton).not.toBeNull();
      expect(jumpButton).not.toBeNull();

      // Test Touch Start on Up Button
      const touchStartEvent = new Event("touchstart", { bubbles: true }) as any;
      touchStartEvent.preventDefault = vi.fn();

      act(() => {
        upButton?.dispatchEvent(touchStartEvent);
      });

      expect(onDirectionPress).toHaveBeenCalledWith("up");
      expect(mockVibrate).toHaveBeenCalledWith(15);

      // Test Touch End on Up Button
      const touchEndEvent = new Event("touchend", { bubbles: true }) as any;
      touchEndEvent.preventDefault = vi.fn();

      act(() => {
        upButton?.dispatchEvent(touchEndEvent);
      });

      expect(onDirectionRelease).toHaveBeenCalledWith("up");

      // Test Action A Button
      act(() => {
        jumpButton?.dispatchEvent(touchStartEvent);
      });
      expect(onActionAPress).toHaveBeenCalled();

      act(() => {
        jumpButton?.dispatchEvent(touchEndEvent);
      });
      expect(onActionARelease).toHaveBeenCalled();
    });
  });

  describe("ClinicalTrialChaos Conveyor Touch Actions", () => {
    it("renders canvas with touchAction none and handles touch selection", async () => {
      await act(async () => {
        root.render(<ClinicalTrialChaos />);
      });

      const canvas = container.querySelector("canvas");
      expect(canvas).not.toBeNull();
      if (canvas) {
        expect(canvas.style.touchAction).toBe("none");

        canvas.getBoundingClientRect = () => ({
          left: 0,
          top: 0,
          width: 760,
          height: 200,
          right: 760,
          bottom: 200,
          x: 0,
          y: 0,
          toJSON: () => {},
        });

        // Simulate touch tap on conveyor canvas
        const touchEvent = new Event("touchstart", { bubbles: true }) as any;
        touchEvent.touches = [{ clientX: 100, clientY: 88 }];

        act(() => {
          canvas.dispatchEvent(touchEvent);
        });
      }
    });
  });
});
