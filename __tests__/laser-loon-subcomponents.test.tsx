/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  AssetDistributionViewer,
  AssetDistributionHub,
  VectorComparisonTool,
  VectorComparisonViewer,
} from "@/components/laser-loon";

describe("Laser Loon Subcomponents Test Suite", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    HTMLCanvasElement.prototype.getBoundingClientRect = vi.fn(() => ({
      left: 0,
      top: 0,
      width: 720,
      height: 80,
      right: 720,
      bottom: 80,
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

  describe("Requirement 1: AssetDistributionViewer", () => {
    it("should mount AssetDistributionViewer and export aliases consistently", () => {
      expect(AssetDistributionViewer).toBe(AssetDistributionHub);
    });

    it("should mount AssetDistributionViewer and assert canvas rendering properties using standard project mock", async () => {
      await act(async () => {
        root.render(<AssetDistributionViewer />);
      });

      const canvas = container.querySelector(
        '[data-testid="asset-distribution-canvas"]'
      ) as HTMLCanvasElement;

      expect(canvas).not.toBeNull();
      expect(canvas.tagName).toBe("CANVAS");
      expect(canvas.width).toBe(720);
      expect(canvas.height).toBe(80);

      const ctx = canvas.getContext("2d") as any;
      expect(ctx).not.toBeNull();
      expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 720, 80);
      expect(ctx.fillRect).toHaveBeenCalled();
      expect(ctx.beginPath).toHaveBeenCalled();
      expect(ctx.moveTo).toHaveBeenCalled();
      expect(ctx.lineTo).toHaveBeenCalled();
      expect(ctx.stroke).toHaveBeenCalled();
    });

    it("should dynamically calculate bar dimensions and draw category labels for default asset distribution", async () => {
      await act(async () => {
        root.render(<AssetDistributionViewer />);
      });

      const canvas = container.querySelector(
        '[data-testid="asset-distribution-canvas"]'
      ) as HTMLCanvasElement;
      const ctx = canvas.getContext("2d") as any;

      // Assert actual text drawing calls for calculated category labels
      const fillTextCalls = ctx.fillText.mock.calls.map(
        (args: [string, number, number]) => args[0]
      );

      expect(fillTextCalls).toContain("Vector Print (3)");
      expect(fillTextCalls).toContain("Web & UI (2)");
      expect(fillTextCalls).toContain("Raster Edit (2)");
      expect(fillTextCalls).toContain("ACTIVE: ALL");
    });

    it("should update dynamic bar widths and category labels when custom asset distribution inputs are passed", async () => {
      const customItems = [
        {
          filename: "custom1.ai",
          ext: "AI",
          classification: "Master Vector Source",
          targetApp: "Illustrator",
          attributes: "Vector source",
          href: "/files/custom1.ai",
          icon: null,
          category: "vector" as const,
        },
        {
          filename: "custom2.eps",
          ext: "EPS",
          classification: "Print Vector Standard",
          targetApp: "Print",
          attributes: "Vector print",
          href: "/files/custom2.eps",
          icon: null,
          category: "vector" as const,
        },
        {
          filename: "custom3.pdf",
          ext: "PDF",
          classification: "Vector PDF",
          targetApp: "PDF Viewer",
          attributes: "Vector PDF",
          href: "/files/custom3.pdf",
          icon: null,
          category: "vector" as const,
        },
        {
          filename: "custom4.ai",
          ext: "AI",
          classification: "Vector Source 2",
          targetApp: "Illustrator",
          attributes: "Vector source",
          href: "/files/custom4.ai",
          icon: null,
          category: "vector" as const,
        },
        {
          filename: "custom5.ai",
          ext: "AI",
          classification: "Vector Source 3",
          targetApp: "Illustrator",
          attributes: "Vector source",
          href: "/files/custom5.ai",
          icon: null,
          category: "vector" as const,
        },
        {
          filename: "custom6.svg",
          ext: "SVG",
          classification: "Web Vector",
          targetApp: "Web",
          attributes: "Web SVG",
          href: "/files/custom6.svg",
          icon: null,
          category: "web" as const,
        },
      ];

      await act(async () => {
        root.render(<AssetDistributionViewer items={customItems} />);
      });

      const canvas = container.querySelector(
        '[data-testid="asset-distribution-canvas"]'
      ) as HTMLCanvasElement;
      const ctx = canvas.getContext("2d") as any;

      const fillTextCalls = ctx.fillText.mock.calls.map(
        (args: [string, number, number]) => args[0]
      );

      // Verify dynamic label calculation from custom distribution input (5 vector, 1 web, 0 raster)
      expect(fillTextCalls).toContain("Vector Print (5)");
      expect(fillTextCalls).toContain("Web & UI (1)");
      expect(fillTextCalls).toContain("Raster Edit (0)");

      // Check fillRect call for recalculated proportional bar width for vector (5/6 of available width)
      const fillRectWidths = ctx.fillRect.mock.calls.map(
        (args: [number, number, number, number]) => args[2]
      );
      // Available width is 650. Vector proportion is 5/6 = ~542px
      expect(fillRectWidths).toContain(542);
    });

    it("should render all asset categories, download links, and CC license information", async () => {
      await act(async () => {
        root.render(<AssetDistributionViewer />);
      });

      expect(container.textContent).toContain("Get the Laser Loon Artwork");
      expect(container.textContent).toContain("Download All Files (ZIP)");
      expect(container.textContent).toContain("Vector Print & Source Formats");
      expect(container.textContent).toContain("Laser_loon.ai");
      expect(container.textContent).toContain("Laser_loon.svg");
      expect(container.textContent).toContain("Laser_loon.psd");
      expect(container.textContent).toContain(
        "Creative Commons CC0 Public Domain Dedication"
      );

      const zipDownloadBtn = container.querySelector(
        'a[href="/files/laser-loon-assets.zip"]'
      ) as HTMLAnchorElement;
      expect(zipDownloadBtn).not.toBeNull();
      expect(zipDownloadBtn.getAttribute("download")).toBe(
        "laser-loon-assets.zip"
      );
    });

    it("should copy link to clipboard when Share button is clicked", async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: writeTextMock },
        writable: true,
        configurable: true,
      });

      await act(async () => {
        root.render(<AssetDistributionViewer />);
      });

      const shareBtn = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.includes("Share Assets")
      );
      expect(shareBtn).toBeDefined();

      await act(async () => {
        shareBtn?.click();
      });

      expect(writeTextMock).toHaveBeenCalled();
      expect(container.textContent).toContain("Link Copied!");
    });

    it("describes the canvas and exposes keyboard-operable category filter buttons", async () => {
      await act(async () => {
        root.render(<AssetDistributionViewer />);
      });

      const canvas = container.querySelector(
        '[data-testid="asset-distribution-canvas"]'
      ) as HTMLCanvasElement;
      expect(canvas).not.toBeNull();
      expect(canvas.getAttribute("role")).toBe("img");
      expect(canvas.getAttribute("aria-label")).toContain(
        "Use the category filter buttons above"
      );
      const ctx = canvas.getContext("2d") as any;

      // Mouse movement over canvas
      await act(async () => {
        canvas.dispatchEvent(
          new MouseEvent("mousemove", {
            clientX: 100,
            clientY: 40,
            bubbles: true,
          })
        );
      });

      expect(ctx.quadraticCurveTo).toHaveBeenCalled();
      expect(ctx.measureText).toHaveBeenCalled();

      // Native category buttons are the accessible controls for filtering.
      const webFilterBtn = Array.from(
        container.querySelectorAll("button")
      ).find((b) => b.textContent?.trim() === "web");
      expect(webFilterBtn?.tagName).toBe("BUTTON");
      await act(async () => {
        webFilterBtn?.click();
      });
      expect(webFilterBtn?.className).toContain("bg-amber-500/20");

      // Mouse leave canvas
      await act(async () => {
        canvas.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));
      });
    });
  });

  describe("Requirement 2: VectorComparisonTool Slider & Mode Interactions", () => {
    it("should mount VectorComparisonTool and export aliases consistently", () => {
      expect(VectorComparisonTool).toBe(VectorComparisonViewer);
    });

    it("should mount VectorComparisonTool with default slider position and render split slider", async () => {
      await act(async () => {
        root.render(<VectorComparisonTool />);
      });

      expect(container.textContent).toContain("A Closer Look:");
      expect(container.textContent).toContain("The Bird and the Lasers");

      const slider = container.querySelector(
        'input[type="range"]'
      ) as HTMLInputElement;
      expect(slider).not.toBeNull();
      expect(slider.value).toBe("50");

      const clippedOverlay = container.querySelector(
        'div[style*="width: 50%"]'
      );
      expect(clippedOverlay).not.toBeNull();
    });

    it("should handle slider drag/change interactions and update overlay width", async () => {
      await act(async () => {
        root.render(<VectorComparisonTool />);
      });

      const slider = container.querySelector(
        'input[type="range"]'
      ) as HTMLInputElement;
      expect(slider).not.toBeNull();

      await act(async () => {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "value"
        )?.set;
        nativeInputValueSetter?.call(slider, "75");
        slider.dispatchEvent(new Event("change", { bubbles: true }));
      });

      expect(slider.value).toBe("75");
      const updatedOverlay = container.querySelector(
        'div[style*="width: 75%"]'
      );
      expect(updatedOverlay).not.toBeNull();
    });

    it("should switch view modes between Split Slider, Side-By-Side, and Pass Toggle", async () => {
      await act(async () => {
        root.render(<VectorComparisonTool />);
      });

      const sideBySideBtn = Array.from(
        container.querySelectorAll("button")
      ).find((b) => b.textContent?.includes("Side-By-Side"));
      expect(sideBySideBtn).toBeDefined();

      await act(async () => {
        sideBySideBtn?.click();
      });

      expect(container.textContent).toContain("Pass 1: Silhouette Vector");
      expect(container.textContent).toContain("Pass 2: Laser Optics & Rays");

      const passToggleBtn = Array.from(
        container.querySelectorAll("button")
      ).find((b) => b.textContent?.includes("Pass Toggle"));
      expect(passToggleBtn).toBeDefined();

      await act(async () => {
        passToggleBtn?.click();
      });

      expect(container.textContent).toContain("Active Render Pass:");
      expect(container.textContent).toContain("Pass 1: Silhouette Only");
      expect(container.textContent).toContain("Pass 2: Laser Optics Only");
      expect(container.textContent).toContain("Combined Output");
    });

    it("should toggle active render passes in Pass Toggle view mode", async () => {
      await act(async () => {
        root.render(<VectorComparisonTool />);
      });

      const passToggleModeBtn = Array.from(
        container.querySelectorAll("button")
      ).find((b) => b.textContent?.includes("Pass Toggle"));

      await act(async () => {
        passToggleModeBtn?.click();
      });

      const laserPassBtn = Array.from(
        container.querySelectorAll("button")
      ).find((b) => b.textContent?.includes("Pass 2: Laser Optics Only"));
      expect(laserPassBtn).toBeDefined();

      await act(async () => {
        laserPassBtn?.click();
      });

      expect(laserPassBtn?.className).toContain("bg-red-500/20");

      const silhouettePassBtn = Array.from(
        container.querySelectorAll("button")
      ).find((b) => b.textContent?.includes("Pass 1: Silhouette Only"));

      await act(async () => {
        silhouettePassBtn?.click();
      });

      expect(silhouettePassBtn?.className).toContain("bg-cyan-500/20");
    });
  });
});
