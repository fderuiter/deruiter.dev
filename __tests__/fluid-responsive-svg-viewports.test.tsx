import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ProofCanvas } from "@/components/proof/ProofCanvas";
import { ProofWorkspaceSkeleton } from "@/app/proof/ProofWorkspaceSkeleton";
import {
  VectorComparisonViewer,
  VectorComparisonTool,
} from "@/components/laser-loon/VectorComparisonViewer";
import { THEOREMS } from "@/lib/proof-utils";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe("Fluid Responsive SVG Viewports with Dynamic Coordinate Boundaries", () => {
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
  });

  describe("Requirement 1 & 2: ProofCanvas Fluid Container & Alignment Guides", () => {
    it("renders ProofCanvas with fluid w-full container and without min-w-[760px]", async () => {
      const activeTheorem = THEOREMS["modus-ponens"];
      const canvasWrapperRef = { current: document.createElement("div") };
      const svgCanvasRef = { current: null };

      await act(async () => {
        root.render(
          <ProofCanvas
            activeTheorem={activeTheorem}
            edges={[]}
            nodeOffsets={{}}
            selectedNodeIds={[]}
            inspectedNodeId="A"
            isSnappingEnabled={true}
            activeGuides={[]}
            dragConnection={null}
            isSimulating={false}
            simulationProgress={null}
            toggleSnapping={() => {}}
            handleAutoStep={() => {}}
            handleResetLayout={() => {}}
            activeTacticHint={{ title: "Test", hint: "Hint" }}
            handleNodePointerDown={() => {}}
            handleNodePointerMove={() => {}}
            handleNodePointerUp={() => {}}
            handleNodeClick={() => {}}
            handleHandlePointerDown={() => {}}
            handleCanvasPointerMove={() => {}}
            handleCanvasPointerUp={() => {}}
            handleApplyRule={() => {}}
            handleStartSimulation={() => {}}
            canvasWrapperRef={canvasWrapperRef}
            svgCanvasRef={svgCanvasRef}
            mobileActiveView="canvas"
          />
        );
      });

      const canvasRegion = container.querySelector(
        '[role="region"][aria-label="Proof workspace canvas"]'
      );
      expect(canvasRegion).not.toBeNull();
      expect(canvasRegion?.className).not.toContain("min-w-[760px]");
      expect(canvasRegion?.className).toContain("w-full");

      const innerWrapper = canvasRegion?.firstElementChild;
      expect(innerWrapper).not.toBeNull();
      expect(innerWrapper?.className).not.toContain("min-w-[760px]");
      expect(innerWrapper?.className).toContain("w-full");
    });

    it("renders alignment guides adapting dynamically to wrapper width", async () => {
      const activeTheorem = THEOREMS["modus-ponens"];
      const mockWrapper = document.createElement("div");
      Object.defineProperty(mockWrapper, "clientWidth", {
        value: 375,
        configurable: true,
      });
      const canvasWrapperRef = { current: mockWrapper };
      const svgCanvasRef = { current: null };

      const activeGuides = [
        {
          type: "horizontal" as const,
          pos: 100,
          start: 10,
          end: 600,
        },
      ];

      await act(async () => {
        root.render(
          <ProofCanvas
            activeTheorem={activeTheorem}
            edges={[]}
            nodeOffsets={{}}
            selectedNodeIds={[]}
            inspectedNodeId="A"
            isSnappingEnabled={true}
            activeGuides={activeGuides}
            dragConnection={null}
            isSimulating={false}
            simulationProgress={null}
            toggleSnapping={() => {}}
            handleAutoStep={() => {}}
            handleResetLayout={() => {}}
            activeTacticHint={{ title: "Test", hint: "Hint" }}
            handleNodePointerDown={() => {}}
            handleNodePointerMove={() => {}}
            handleNodePointerUp={() => {}}
            handleNodeClick={() => {}}
            handleHandlePointerDown={() => {}}
            handleCanvasPointerMove={() => {}}
            handleCanvasPointerUp={() => {}}
            handleApplyRule={() => {}}
            handleStartSimulation={() => {}}
            canvasWrapperRef={canvasWrapperRef}
            svgCanvasRef={svgCanvasRef}
            mobileActiveView="canvas"
          />
        );
      });

      const guideLine = container.querySelector("line[stroke='#10b981']");
      expect(guideLine).not.toBeNull();
      expect(guideLine?.getAttribute("x2")).toBe("375");
    });
  });

  describe("Requirement 3: ProofWorkspaceSkeleton Fluid Sizing", () => {
    it("renders ProofWorkspaceSkeleton canvas container with fluid w-full sizing without min-w-[760px]", async () => {
      await act(async () => {
        root.render(<ProofWorkspaceSkeleton />);
      });

      const skeletonCanvasRegion = container.querySelector(
        '[role="region"][aria-label="Proof workspace canvas skeleton"]'
      );
      expect(skeletonCanvasRegion).not.toBeNull();
      expect(skeletonCanvasRegion?.className).not.toContain("min-w-[760px]");
      expect(skeletonCanvasRegion?.className).toContain("w-full");

      const innerWrapper = skeletonCanvasRegion?.firstElementChild;
      expect(innerWrapper).not.toBeNull();
      expect(innerWrapper?.className).not.toContain("min-w-[760px]");
      expect(innerWrapper?.className).toContain("w-full");
    });
  });

  describe("Requirement 4 & 5: VectorComparisonViewer Fluid SVG Viewport & Overlay Sizing", () => {
    it("renders VectorComparisonViewer overlay without min-w-[800px]", async () => {
      await act(async () => {
        root.render(<VectorComparisonViewer />);
      });

      const mainViewport = container.querySelector("[class*='@container']");
      expect(mainViewport).not.toBeNull();

      const overlayInner = mainViewport?.querySelector(
        "div[class*='w-[100cqw]']"
      );
      expect(overlayInner).not.toBeNull();
      expect(container.innerHTML).not.toContain("min-w-[800px]");
    });

    it("supports interactive slider dragging on fluid viewports", async () => {
      await act(async () => {
        root.render(<VectorComparisonTool />);
      });

      const sliderInput = container.querySelector(
        'input[type="range"]'
      ) as HTMLInputElement;
      expect(sliderInput).not.toBeNull();
      expect(sliderInput.value).toBe("50");

      await act(async () => {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "value"
        )?.set;
        nativeInputValueSetter?.call(sliderInput, "30");
        sliderInput.dispatchEvent(new Event("change", { bubbles: true }));
      });

      expect(sliderInput.value).toBe("30");
      const overlayClipped = container.querySelector(
        'div[style*="width: 30%"]'
      );
      expect(overlayClipped).not.toBeNull();
    });
  });
});
