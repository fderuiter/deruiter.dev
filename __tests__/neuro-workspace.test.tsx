/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { NeuroReconClient } from "@/components/neuro/NeuroReconClient";

// Mock AudioProvider
vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({
    playNote: vi.fn(),
    playSuccess: vi.fn(),
    playHover: vi.fn(),
  }),
  AudioProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock Telemetry
vi.mock("@/hooks/useTelemetry", () => ({
  useTelemetry: () => ({
    recordEvent: vi.fn(),
  }),
}));

describe("NeuroRecon Workspace UI Suite", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    // Setup Canvas 2D Mock Context with all invariant curve methods
    const mockContext2D = {
      fillRect: vi.fn(),
      clearRect: vi.fn(),
      getImageData: vi.fn(() => ({
        data: new Uint8ClampedArray(4 * 96 * 96),
        width: 96,
        height: 96,
      })),
      putImageData: vi.fn(),
      createImageData: vi.fn((w: number, h: number) => ({
        data: new Uint8ClampedArray(4 * w * h),
        width: w,
        height: h,
      })),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      arc: vi.fn(),
      stroke: vi.fn(),
      rect: vi.fn(),
      strokeRect: vi.fn(),
      setLineDash: vi.fn(),
      quadraticCurveTo: vi.fn(),
      bezierCurveTo: vi.fn(),
      arcTo: vi.fn(),
      roundRect: vi.fn(),
      measureText: vi.fn((text: string) => ({ width: text.length * 7 })),
    };

    HTMLCanvasElement.prototype.getContext = vi.fn((contextId: string) => {
      if (contextId === "2d") {
        return mockContext2D as any;
      }
      return null;
    }) as any;

    HTMLCanvasElement.prototype.getBoundingClientRect = vi.fn(() => ({
      left: 0,
      top: 0,
      right: 300,
      bottom: 300,
      width: 300,
      height: 300,
      x: 0,
      y: 0,
      toJSON: () => {},
    }));

    container = document.createElement("div");
    document.body.appendChild(container);
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

  it("renders the main NeuroRecon studio with HUD metrics, toolbar, and FreeSurfer terminal", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<NeuroReconClient />);
    });

    expect(container.textContent).toContain(
      "Case 01: Dura Over-Inclusion in Temporal Lobe"
    );
    expect(container.textContent).toContain("EULER ESTIMATE (χ)");
    expect(container.textContent).toContain("DEFECT UNITS (EST.)");
    expect(container.textContent).toContain("DICE ESTIMATE");
    expect(container.textContent).toContain("THICKNESS ESTIMATE");
    expect(container.textContent).toContain("FreeSurfer 7.4.1 CLI Terminal");
    expect(container.textContent).toContain("RUN RECON-ALL");
    expect(container.textContent).toContain("FIELD MANUAL");
  });

  it("switches scenarios when clicking scenario tabs", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<NeuroReconClient />);
    });

    // Find Case 02 button
    const buttons = Array.from(container.querySelectorAll("button"));
    const case2Button = buttons.find((btn) =>
      btn.textContent?.includes("Case 02")
    );
    expect(case2Button).toBeDefined();

    await act(async () => {
      case2Button?.click();
    });

    expect(container.textContent).toContain(
      "Case 02: White Matter Dropout & B1 Inhomogeneity"
    );
    expect(container.textContent).toContain("Intensity Defect");
  });

  it("opens and closes the Field Manual modal", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<NeuroReconClient />);
    });

    const manualButton = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent?.includes("FIELD MANUAL")
    );
    expect(manualButton).toBeDefined();

    await act(async () => {
      manualButton?.click();
    });

    expect(document.body.textContent).toContain(
      "NeuroRecon Field Manual · FreeSurfer 7.x"
    );
    expect(document.body.textContent).toContain(
      "Topological Homeomorphism & Euler Characteristic"
    );

    // Close button
    const dismissButton = Array.from(
      document.body.querySelectorAll("button")
    ).find((btn) => btn.textContent?.includes("DISMISS FIELD MANUAL"));
    expect(dismissButton).toBeDefined();

    await act(async () => {
      dismissButton?.click();
    });

    await act(async () => {
      for (let i = 0; i < 30; i++) {
        if (!document.body.querySelector('[role="dialog"]')) break;
        await new Promise((r) => setTimeout(r, 50));
      }
    });
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
  });

  it("executes CLI commands in the terminal and renders log outputs", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<NeuroReconClient />);
    });

    const statsButton = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent?.trim() === "stats"
    );
    expect(statsButton).toBeDefined();

    await act(async () => {
      statsButton?.click();
    });

    expect(container.textContent).toContain(
      "Morphometric Stats (simulated; not aseg.stats / aparc.stats)"
    );
    expect(container.textContent).toContain(
      "Example Intracranial Volume (eTIV)"
    );
  });

  it("switches datasets using the dataset selector buttons", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<NeuroReconClient />);
    });

    const mniButton = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent?.includes("MNI152 (GLB)")
    );
    expect(mniButton).toBeDefined();

    await act(async () => {
      mniButton?.click();
    });

    // In MNI152 mode, sandbox is active with pristine baseline
    expect(container.textContent).toContain("Freeview QA Sandbox");
  });

  it("renders onboarding banner with first action guide and non-clinical disclaimer, then dismisses it", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<NeuroReconClient />);
    });

    const onboardingBanner = container.querySelector(
      '[data-testid="neuro-onboarding-banner"]'
    );
    expect(onboardingBanner).not.toBeNull();
    expect(onboardingBanner?.textContent).toContain(
      "First Action Guide · How to Repair Cortical Surfaces"
    );
    expect(onboardingBanner?.textContent).toContain(
      "Educational Simulation Notice:"
    );
    expect(onboardingBanner?.textContent).toContain(
      "Not for clinical diagnosis or medical decision-making."
    );

    // Dismiss guide button
    const dismissBtn = onboardingBanner?.querySelector(
      'button[aria-label="Dismiss First Action Guide"]'
    );
    expect(dismissBtn).toBeDefined();

    await act(async () => {
      (dismissBtn as HTMLButtonElement)?.click();
    });

    expect(
      container.querySelector('[data-testid="neuro-onboarding-banner"]')
    ).toBeNull();
  });

  it("renders accessible role and aria-labels on 2D slice canvases", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<NeuroReconClient />);
    });

    const canvases = Array.from(container.querySelectorAll("canvas"));
    expect(canvases.length).toBeGreaterThanOrEqual(3);

    canvases.forEach((canvas) => {
      expect(canvas.getAttribute("role")).toBe("img");
      expect(canvas.getAttribute("tabIndex")).toBe("0");
      expect(canvas.getAttribute("aria-label")).toBeTruthy();
    });
  });
});
