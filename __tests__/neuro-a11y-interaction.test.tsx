import React, { act } from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createRoot, Root } from "react-dom/client";
import { fromPartial } from "@total-typescript/shoehorn";
import { NeuroReconClient } from "@/components/neuro/NeuroReconClient";

// Mock Three.js WebGL and Canvas 2D context with full curve methods
class MockWebGLRenderer {
  domElement = document.createElement("canvas");
  setSize = vi.fn();
  setPixelRatio = vi.fn();
  render = vi.fn();
  dispose = vi.fn();
}

vi.mock("three", async () => {
  const actual = await vi.importActual<typeof import("three")>("three");
  return {
    ...actual,
    WebGLRenderer: vi.fn().mockImplementation(() => new MockWebGLRenderer()),
  };
});

describe("NeuroRecon: Accessibility & Keyboard Interactions Suite", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);

    // Mock HTMLCanvasElement.prototype.getContext with full curve methods
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      (contextId) => {
        if (contextId === "2d") {
          return fromPartial<CanvasRenderingContext2D>({
            fillStyle: "",
            strokeStyle: "",
            lineWidth: 1,
            fillRect: vi.fn(),
            strokeRect: vi.fn(),
            clearRect: vi.fn(),
            beginPath: vi.fn(),
            moveTo: vi.fn(),
            lineTo: vi.fn(),
            arc: vi.fn(),
            rect: vi.fn(),
            stroke: vi.fn(),
            fill: vi.fn(),
            setLineDash: vi.fn(),
            createImageData: vi.fn().mockReturnValue({
              data: new Uint8ClampedArray(96 * 96 * 4),
              width: 96,
              height: 96,
            }),
            putImageData: vi.fn(),
            // AGENTS.md invariant 7 curve methods
            quadraticCurveTo: vi.fn(),
            bezierCurveTo: vi.fn(),
            arcTo: vi.fn(),
            roundRect: vi.fn(),
            measureText: vi.fn().mockReturnValue({ width: 50 }),
          });
        }
        return null;
      }
    );
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    if (container.parentNode) {
      document.body.removeChild(container);
    }
    vi.restoreAllMocks();
  });

  it("handles keyboard shortcuts (1, 2, 3, 4) to toggle tool modes", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<NeuroReconClient />);
    });

    expect(container.textContent).toContain(
      "Case 01: Dura Over-Inclusion in Temporal Lobe"
    );

    // Press '2' for Control Point tool
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "2", bubbles: true })
      );
    });

    // Press '3' for Paint tool
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "3", bubbles: true })
      );
    });
    expect(container.textContent).toContain("BRUSH RADIUS");

    // Press '4' for Erase tool
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "4", bubbles: true })
      );
    });
    expect(container.textContent).toContain("BRUSH RADIUS");

    // Press '1' for Inspect tool
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "1", bubbles: true })
      );
    });
  });

  it("toggles View Modes (Split, 3D Only, 2D Only)", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<NeuroReconClient />);
    });

    const buttons = Array.from(container.querySelectorAll("button"));
    const view3DButton = buttons.find((btn) =>
      btn.textContent?.includes("3D Only")
    );
    const view2DButton = buttons.find((btn) =>
      btn.textContent?.includes("2D Only")
    );
    const viewSplitButton = buttons.find((btn) =>
      btn.textContent?.includes("Split View")
    );

    expect(view3DButton).toBeDefined();
    expect(view2DButton).toBeDefined();

    await act(async () => {
      view3DButton?.click();
    });

    await act(async () => {
      view2DButton?.click();
    });

    await act(async () => {
      viewSplitButton?.click();
    });
  });

  it("adjusts brush radius when Paint or Erase mode is active", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<NeuroReconClient />);
    });

    // Switch to Paint
    const paintButton = Array.from(container.querySelectorAll("button")).find(
      (btn) =>
        btn.textContent?.includes("Voxel Paint") ||
        btn.dataset.tooltip?.includes("Voxel Paint")
    );
    await act(async () => {
      paintButton?.click();
    });

    // Find radius button '3'
    const radius3Button = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent?.trim() === "3"
    );
    expect(radius3Button).toBeDefined();

    await act(async () => {
      radius3Button?.click();
    });
  });

  it("triggers recon-all execution and updates telemetry state", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<NeuroReconClient />);
    });

    const reconButton = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent?.includes("RUN RECON-ALL")
    );
    expect(reconButton).toBeDefined();

    await act(async () => {
      reconButton?.click();
    });

    expect(container.textContent).toContain("FreeSurfer 7.4.1 CLI Terminal");
  });
});
