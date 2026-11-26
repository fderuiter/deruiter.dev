/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MultiPlanarSliceViewer } from "@/components/neuro/MultiPlanarSliceViewer";
import { Brain3DViewer } from "@/components/neuro/Brain3DViewer";
import { CRFStudioContainer } from "@/components/crf/CRFStudioContainer";
import { generateSyntheticVolume } from "@/lib/neuro/volume-generator";

// Mock AudioProvider
vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({
    playClick: vi.fn(),
    playNote: vi.fn(),
    playSuccess: vi.fn(),
    playHover: vi.fn(),
    playAutocomplete: vi.fn(),
  }),
}));

// Mock Telemetry
vi.mock("@/hooks/useTelemetry", () => ({
  useTelemetry: () => ({
    recordEvent: vi.fn(),
  }),
}));

// Mock SearchProvider
vi.mock("@/components/providers/SearchProvider", () => ({
  useSearch: () => ({
    openSearch: vi.fn(),
    closeSearch: vi.fn(),
    isOpen: false,
    setIsOpen: vi.fn(),
  }),
}));

// Mock Next Navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/proof",
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

describe("Mobile Responsive Studios Suite (Proof, Neuro, CRF)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.clearAllMocks();
  });

  describe("Neuro MultiPlanarSliceViewer Touch Interactions", () => {
    it("handles touch events (onTouchStart, onTouchMove, onTouchEnd) on MRI slice canvases", async () => {
      const volume = generateSyntheticVolume("dura_inclusion");
      const onCrosshairChange = vi.fn();
      const onAddControlPoint = vi.fn();
      const onApplyVoxelEdits = vi.fn();

      await act(async () => {
        root.render(
          <MultiPlanarSliceViewer
            volume={volume}
            crosshair={{ x: 48, y: 48, z: 48 }}
            toolMode="control_point"
            brushRadius={2}
            showPialContour={true}
            showWmContour={true}
            controlPoints={[]}
            onCrosshairChange={onCrosshairChange}
            onAddControlPoint={onAddControlPoint}
            onApplyVoxelEdits={onApplyVoxelEdits}
          />
        );
      });

      const canvases = container.querySelectorAll("canvas");
      expect(canvases.length).toBeGreaterThan(0);

      const coronalCanvas = canvases[0];
      expect(coronalCanvas.style.touchAction).toBe("none");

      // Mock getBoundingClientRect
      coronalCanvas.getBoundingClientRect = () => ({
        left: 0,
        top: 0,
        width: 200,
        height: 200,
        right: 200,
        bottom: 200,
        x: 0,
        y: 0,
        toJSON: () => {},
      });

      // Simulate Touch Start (tap)
      const touchStartEvent = new Event("touchstart", { bubbles: true }) as any;
      touchStartEvent.touches = [{ clientX: 100, clientY: 100 }];
      touchStartEvent.changedTouches = [{ clientX: 100, clientY: 100 }];

      act(() => {
        coronalCanvas.dispatchEvent(touchStartEvent);
      });

      expect(onCrosshairChange).toHaveBeenCalled();
      expect(onAddControlPoint).toHaveBeenCalled();

      // Simulate Touch Move
      const touchMoveEvent = new Event("touchmove", { bubbles: true }) as any;
      touchMoveEvent.touches = [{ clientX: 120, clientY: 120 }];
      touchMoveEvent.changedTouches = [{ clientX: 120, clientY: 120 }];

      act(() => {
        coronalCanvas.dispatchEvent(touchMoveEvent);
      });

      // Simulate Touch End
      const touchEndEvent = new Event("touchend", { bubbles: true }) as any;
      touchEndEvent.touches = [];
      touchEndEvent.changedTouches = [{ clientX: 120, clientY: 120 }];

      act(() => {
        coronalCanvas.dispatchEvent(touchEndEvent);
      });
    });
  });

  describe("Neuro Brain3DViewer Touch Orbit Controls", () => {
    it("renders 3D canvas container with touchAction none and handles touch rotation", async () => {
      await act(async () => {
        root.render(
          <Brain3DViewer
            surfaceMode="pial"
            crosshair={{ x: 48, y: 48, z: 48 }}
          />
        );
      });

      const canvasContainer = container.querySelector(".cursor-grab");
      expect(canvasContainer).not.toBeNull();
      if (canvasContainer) {
        expect((canvasContainer as HTMLElement).style.touchAction).toBe("none");

        // Simulate touch start
        const touchStart = new Event("touchstart", { bubbles: true }) as any;
        touchStart.touches = [{ clientX: 50, clientY: 50 }];
        touchStart.changedTouches = [{ clientX: 50, clientY: 50 }];

        act(() => {
          canvasContainer.dispatchEvent(touchStart);
        });

        // Simulate touch move
        const touchMove = new Event("touchmove", { bubbles: true }) as any;
        touchMove.touches = [{ clientX: 70, clientY: 80 }];
        touchMove.changedTouches = [{ clientX: 70, clientY: 80 }];

        act(() => {
          canvasContainer.dispatchEvent(touchMove);
        });

        // Simulate touch end
        const touchEnd = new Event("touchend", { bubbles: true }) as any;
        touchEnd.touches = [];
        touchEnd.changedTouches = [{ clientX: 70, clientY: 80 }];

        act(() => {
          canvasContainer.dispatchEvent(touchEnd);
        });
      }
    });
  });

  describe("CRF Studio Mobile View Navigation & Slide-Up Drawers", () => {
    it("renders mobile bottom tab navigation bar and allows switching views", async () => {
      await act(async () => {
        root.render(<CRFStudioContainer />);
      });

      const mobileNav = container.querySelector(
        'nav[aria-label="Mobile View Navigation"]'
      );
      expect(mobileNav).not.toBeNull();

      const formsBtn = mobileNav?.querySelector("button:nth-child(1)");
      const canvasBtn = mobileNav?.querySelector("button:nth-child(2)");
      const inspectorBtn = mobileNav?.querySelector("button:nth-child(3)");

      expect(formsBtn).not.toBeNull();
      expect(canvasBtn).not.toBeNull();
      expect(inspectorBtn).not.toBeNull();

      // Click Forms view tab
      act(() => {
        formsBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });

      // Click Inspector view tab
      act(() => {
        inspectorBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });

      // Click Canvas view tab
      act(() => {
        canvasBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
    });
  });
});
