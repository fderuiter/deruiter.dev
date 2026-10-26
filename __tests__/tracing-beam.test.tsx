/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { TracingBeam } from "@/components/ui/TracingBeam";
import { designManifest } from "@/lib/design-manifest";

// Mock the hydration-safe reduced-motion hook TracingBeam reads (#2893)
const mockUseReducedMotion = vi.fn();

vi.mock("@/hooks/useMediaQuery", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/hooks/useMediaQuery")>();
  return {
    ...original,
    usePrefersReducedMotion: () => mockUseReducedMotion(),
  };
});

describe("GPU-Accelerated TracingBeam Scroll Indicator Suite", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseReducedMotion.mockReturnValue(false);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    document.body.removeChild(container);
  });

  it("renders children and scroll indicator rail container", async () => {
    await act(async () => {
      root.render(
        <TracingBeam>
          <div>Case Study Content Body</div>
        </TracingBeam>
      );
    });

    expect(container.textContent).toContain("Case Study Content Body");

    // Verify rail track wrapper element exists
    const railTrack = container.querySelector(".absolute.-left-6");
    expect(railTrack).not.toBeNull();
  });

  it("configures visual progress beam with GPU vertical scale transform and static compositing hints", async () => {
    await act(async () => {
      root.render(
        <TracingBeam>
          <div>Content</div>
        </TracingBeam>
      );
    });

    // Active glowing beam segment
    const beamSegment = container.querySelector(".bg-gradient-to-b");
    expect(beamSegment).not.toBeNull();
    expect(beamSegment?.className).toContain("transform-gpu");
    expect(beamSegment?.className).toContain("will-change-transform");
    expect(beamSegment?.className).toContain("origin-top");
    expect(beamSegment?.className).toContain("h-full");
  });

  it("configures progress indicator marker with GPU translation operations and static compositing hints", async () => {
    await act(async () => {
      root.render(
        <TracingBeam>
          <div>Content</div>
        </TracingBeam>
      );
    });

    // Indicator marker wrapper with GPU acceleration
    const gpuElements = container.querySelectorAll(".transform-gpu");
    expect(gpuElements.length).toBeGreaterThanOrEqual(2);

    const markerWrapper = gpuElements[1];
    expect(markerWrapper?.className).toContain("will-change-transform");
    expect(markerWrapper?.className).toContain("transform-gpu");

    // Inner indicator marker bubble
    const markerBubble = container.querySelector(".bg-accent.border-2");
    expect(markerBubble).not.toBeNull();
  });

  it("respects reduced motion preferences by rendering static progress without pulsating animation", async () => {
    mockUseReducedMotion.mockReturnValue(true);

    await act(async () => {
      root.render(
        <TracingBeam>
          <div>Content</div>
        </TracingBeam>
      );
    });

    // Pulsating ring should not be rendered when reduced motion is requested
    const pingRing = container.querySelector(".animate-ping");
    expect(pingRing).toBeNull();
  });

  it("verifies design system spring timing tokens match design manifest configuration", () => {
    expect(designManifest.motion.springs.smooth.stiffness).toBeDefined();
    expect(typeof designManifest.motion.springs.smooth.stiffness).toBe(
      "number"
    );
  });
});
