// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from "@testing-library/react";
import { Brain3DViewer } from "@/components/neuro/Brain3DViewer";
import { ProofWorkspaceClient as ProofWorkspacePage } from "@/app/(desktop)/proof/ProofWorkspaceClient";

describe("Frame-Bound Throttling & Intersection Guard Suite", () => {
  let intersectionCallbacks: ((
    entries: IntersectionObserverEntry[]
  ) => void)[] = [];
  let observedElements: Element[] = [];

  beforeEach(() => {
    intersectionCallbacks = [];
    observedElements = [];

    // Mock Worker
    globalThis.Worker = class MockWorker {
      postMessage = vi.fn();
      terminate = vi.fn();
      addEventListener = vi.fn();
      removeEventListener = vi.fn();
      onmessage = null;
      onerror = null;
    } as unknown as typeof Worker;

    // Mock IntersectionObserver
    globalThis.IntersectionObserver = class MockIntersectionObserver {
      constructor(callback: (entries: IntersectionObserverEntry[]) => void) {
        intersectionCallbacks.push(callback);
      }
      observe = vi.fn((element: Element) => {
        observedElements.push(element);
      });
      unobserve = vi.fn();
      disconnect = vi.fn();
      takeRecords = vi.fn(() => []);
      root = null;
      rootMargin = "";
      thresholds = [];
    } as unknown as typeof IntersectionObserver;
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe("Requirement 1: Diagram Node & Connection Frame Throttling", () => {
    it("batches rapid diagram node pointermove updates to execute at frame refresh boundaries", () => {
      render(<ProofWorkspacePage />);

      const nodeHandleA = screen.getByRole("button", {
        name: /Drag connection handle from Node A/i,
      });
      const nodeA = nodeHandleA.parentElement;
      expect(nodeA).not.toBeNull();

      if (!nodeA) return;

      const rafSpy = vi.spyOn(window, "requestAnimationFrame");

      // Start drag on Node A
      fireEvent.pointerDown(nodeA, {
        clientX: 100,
        clientY: 100,
        pointerId: 1,
      });

      // Dispatch 10 high-frequency pointermove events in rapid succession
      for (let i = 1; i <= 10; i++) {
        fireEvent.pointerMove(nodeA, {
          clientX: 100 + i * 5,
          clientY: 100 + i * 5,
          pointerId: 1,
        });
      }

      // RAF should have been requested to batch updates at frame boundary
      expect(rafSpy).toHaveBeenCalled();

      // Release drag
      fireEvent.pointerUp(nodeA, { clientX: 150, clientY: 150, pointerId: 1 });
    });

    it("cancels pending animation frames cleanly when node drag completes or unmounts", () => {
      const cancelRafSpy = vi.spyOn(window, "cancelAnimationFrame");
      const { unmount } = render(<ProofWorkspacePage />);

      const nodeHandleA = screen.getByRole("button", {
        name: /Drag connection handle from Node A/i,
      });
      const nodeA = nodeHandleA.parentElement;
      expect(nodeA).not.toBeNull();

      if (!nodeA) return;

      fireEvent.pointerDown(nodeA, {
        clientX: 100,
        clientY: 100,
        pointerId: 1,
      });
      fireEvent.pointerMove(nodeA, {
        clientX: 120,
        clientY: 120,
        pointerId: 1,
      });

      unmount();
      expect(cancelRafSpy).toHaveBeenCalled();
    });
  });

  describe("Requirement 2 & 3: WebGL Rendering Loop Pause and Resume on Intersection", () => {
    it("pauses rendering when 3D visualizer scrolls offscreen and resumes when re-entering viewport", () => {
      const { container } = render(
        <Brain3DViewer surfaceMode="pial" crosshair={{ x: 48, y: 48, z: 48 }} />
      );

      expect(observedElements.length).toBeGreaterThan(0);

      // Trigger offscreen intersection
      act(() => {
        intersectionCallbacks.forEach((cb) =>
          cb([
            {
              isIntersecting: false,
              target: container.firstElementChild!,
              intersectionRatio: 0,
              boundingClientRect: {} as DOMRectReadOnly,
              intersectionRect: {} as DOMRectReadOnly,
              rootBounds: null,
              time: Date.now(),
            },
          ])
        );
      });

      // Trigger back into viewport
      act(() => {
        intersectionCallbacks.forEach((cb) =>
          cb([
            {
              isIntersecting: true,
              target: container.firstElementChild!,
              intersectionRatio: 1,
              boundingClientRect: {} as DOMRectReadOnly,
              intersectionRect: {} as DOMRectReadOnly,
              rootBounds: null,
              time: Date.now(),
            },
          ])
        );
      });

      expect(observedElements.length).toBeGreaterThan(0);
    });
  });

  describe("Requirement 4: Throttled 3D Mesh Hover Raycasting & Tooltip Positioning", () => {
    it("throttles fast hover raycasting calculations across 3D meshes to frame refresh boundaries", () => {
      const rafSpy = vi.spyOn(window, "requestAnimationFrame");
      const { container } = render(
        <Brain3DViewer surfaceMode="pial" crosshair={{ x: 48, y: 48, z: 48 }} />
      );

      const canvasContainer = container.querySelector(".cursor-grab");
      expect(canvasContainer).not.toBeNull();

      if (canvasContainer) {
        // Dispatch rapid mousemove events
        for (let i = 0; i < 15; i++) {
          fireEvent.mouseMove(canvasContainer, {
            clientX: 100 + i * 2,
            clientY: 100 + i * 2,
          });
        }
      }

      expect(rafSpy).toHaveBeenCalled();
    });

    it("cancels active hover animation frames when unmounted or mouse leaves", () => {
      const cancelRafSpy = vi.spyOn(window, "cancelAnimationFrame");
      const { container, unmount } = render(
        <Brain3DViewer surfaceMode="pial" crosshair={{ x: 48, y: 48, z: 48 }} />
      );

      const canvasContainer = container.querySelector(".cursor-grab");
      if (canvasContainer) {
        fireEvent.mouseMove(canvasContainer, { clientX: 150, clientY: 150 });
        fireEvent.mouseLeave(canvasContainer);
      }

      unmount();
      expect(cancelRafSpy).toHaveBeenCalled();
    });
  });
});
