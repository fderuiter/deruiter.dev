/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import * as THREE from "three";
import {
  progressBus,
  formatBytes,
  AssetProgressEvent,
} from "@/lib/neuro/progress-bus";
import { loadExternalBrainMesh } from "@/lib/neuro/asset-loader";
import { ProgressHUD } from "@/components/neuro/ProgressHUD";
import { Brain3DViewer } from "@/components/neuro/Brain3DViewer";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

vi.mock("three/examples/jsm/loaders/OBJLoader.js", () => {
  const MockOBJLoader = vi.fn();
  return {
    OBJLoader: MockOBJLoader,
  };
});

vi.mock("three/examples/jsm/loaders/GLTFLoader.js", () => {
  const MockGLTFLoader = vi.fn();
  return {
    GLTFLoader: MockGLTFLoader,
  };
});

describe("Event-Driven Progress Bus & Floating Visual Progress HUD", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    progressBus.clear();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  describe("ProgressBus Unit Tests", () => {
    it("notifies subscribers when progress events are published", () => {
      const listener = vi.fn();
      const unsubscribe = progressBus.subscribe(listener);

      const event: AssetProgressEvent = {
        url: "/models/brain-scan.glb",
        loaded: 524288,
        total: 2097152,
        percentage: 25,
        status: "loading",
      };

      progressBus.publish(event);
      expect(listener).toHaveBeenCalledWith(event);

      unsubscribe();
      progressBus.publish(event);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("formats byte counts accurately", () => {
      expect(formatBytes(0)).toBe("0 B");
      expect(formatBytes(512)).toBe("512 B");
      expect(formatBytes(1024)).toBe("1 KB");
      expect(formatBytes(1572864)).toBe("1.5 MB");
      expect(formatBytes(1073741824)).toBe("1 GB");
    });
  });

  describe("Asset Loader Integration with Progress Bus", () => {
    it("publishes loading, progress, and completion events during GLTF fetch", async () => {
      const events: AssetProgressEvent[] = [];
      const unsubscribe = progressBus.subscribe((e) => events.push(e));

      const mockScene = new THREE.Group();
      mockScene.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));
      const mockLoad = vi.fn((url: string, onLoad: any, onProgress: any) => {
        // Simulate streaming progress updates
        onProgress({ loaded: 100000, total: 400000 });
        onProgress({ loaded: 300000, total: 400000 });
        onLoad({ scene: mockScene });
      });

      vi.mocked(GLTFLoader).mockImplementation(function (
        this: Record<string, unknown>
      ) {
        this.load = mockLoad;
      } as any);

      await loadExternalBrainMesh("/models/test-stream.glb", "pial", "both");

      expect(events.length).toBeGreaterThanOrEqual(3);
      expect(events[0]).toMatchObject({
        url: "/models/test-stream.glb",
        status: "loading",
        percentage: 0,
      });
      expect(events[events.length - 1]).toMatchObject({
        url: "/models/test-stream.glb",
        status: "complete",
        percentage: 100,
      });

      unsubscribe();
    });

    it("publishes error event when loader fails or network errors occur", async () => {
      const events: AssetProgressEvent[] = [];
      const unsubscribe = progressBus.subscribe((e) => events.push(e));

      const mockLoad = vi.fn(
        (url: string, onLoad: any, onProgress: any, onError: any) => {
          onError(new Error("404 Not Found"));
        }
      );

      vi.mocked(OBJLoader).mockImplementation(function (
        this: Record<string, unknown>
      ) {
        this.load = mockLoad;
      } as any);

      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});

      await loadExternalBrainMesh("/models/missing.obj", "pial", "both");

      const errorEvent = events.find((e) => e.status === "error");
      expect(errorEvent).toBeDefined();
      expect(errorEvent?.error).toContain("404 Not Found");

      consoleWarnSpy.mockRestore();
      unsubscribe();
    });
  });

  describe("ProgressHUD Overlay Component", () => {
    it("renders floating HUD when progress loading event fires", () => {
      render(<ProgressHUD />);

      expect(screen.queryByTestId("progress-hud-container")).toBeNull();

      act(() => {
        progressBus.publish({
          url: "/models/brain-surface.glb",
          loaded: 1048576,
          total: 4194304,
          percentage: 25,
          status: "loading",
        });
      });

      const hud = screen.getByTestId("progress-hud-container");
      expect(hud).toBeTruthy();
      expect(hud.className).toContain("pointer-events-none"); // Enables pointer event pass-through
      expect(screen.getByText("brain-surface.glb")).toBeTruthy();
      expect(screen.getByText("1 MB / 4 MB")).toBeTruthy();
      expect(screen.getByText("25%")).toBeTruthy();
    });

    it("uses hardware-accelerated CSS scaleX transform for progress bar updates", () => {
      render(<ProgressHUD />);

      act(() => {
        progressBus.publish({
          url: "/models/brain-surface.glb",
          loaded: 3145728,
          total: 4194304,
          percentage: 75,
          status: "loading",
        });
      });

      const barFill = screen.getByTestId("progress-bar-fill");
      expect(barFill.style.transform).toBe("scaleX(0.75)");
      expect(barFill.className).toContain("will-change-transform");
    });

    // #1441: the fill is clamped with clamp() rather than nested Math calls.
    it.each([
      [150, "scaleX(1)"],
      [-20, "scaleX(0)"],
      [0, "scaleX(0)"],
      [100, "scaleX(1)"],
    ])("clamps a %s%% progress event to %s", (percentage, transform) => {
      render(<ProgressHUD />);

      act(() => {
        progressBus.publish({
          url: "/models/brain-surface.glb",
          loaded: 0,
          total: 0,
          percentage,
          status: "loading",
        });
      });

      expect(screen.getByTestId("progress-bar-fill").style.transform).toBe(
        transform
      );
    });

    it("auto-dismisses within 300ms upon asset transfer completion", () => {
      render(<ProgressHUD />);

      act(() => {
        progressBus.publish({
          url: "/models/brain-surface.glb",
          loaded: 4194304,
          total: 4194304,
          percentage: 100,
          status: "complete",
        });
      });

      const hud = screen.getByTestId("progress-hud-container");
      expect(hud).toBeTruthy();
      expect(hud.className).toContain("opacity-0");

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(screen.queryByTestId("progress-hud-container")).toBeNull();
    });

    it("auto-dismisses within 300ms upon asset fetch error", () => {
      render(<ProgressHUD />);

      act(() => {
        progressBus.publish({
          url: "/models/failed.glb",
          loaded: 0,
          total: 0,
          percentage: 0,
          status: "error",
          error: "Network error",
        });
      });

      const hud = screen.getByTestId("progress-hud-container");
      expect(hud).toBeTruthy();
      expect(screen.getByText(/Fetch Failed/i)).toBeTruthy();

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(screen.queryByTestId("progress-hud-container")).toBeNull();
    });
  });

  describe("Viewport Integration & Render Isolation", () => {
    it("does not trigger re-renders of parent Brain3DViewer on progress updates", () => {
      let renderCount = 0;

      const TestParent = () => {
        renderCount++;
        return (
          <Brain3DViewer
            surfaceMode="pial"
            crosshair={{ x: 48, y: 48, z: 48 }}
            modelUrl="/models/brain-surface.glb"
          />
        );
      };

      render(<TestParent />);
      const initialRenders = renderCount;

      act(() => {
        progressBus.publish({
          url: "/models/brain-surface.glb",
          loaded: 500000,
          total: 2000000,
          percentage: 25,
          status: "loading",
        });
      });

      act(() => {
        progressBus.publish({
          url: "/models/brain-surface.glb",
          loaded: 1500000,
          total: 2000000,
          percentage: 75,
          status: "loading",
        });
      });

      // Parent component re-renders MUST be 0 during progress stream
      expect(renderCount).toBe(initialRenders);
    });
  });
});
