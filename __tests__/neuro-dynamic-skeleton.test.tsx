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

// Mock Brain3DViewer to keep the dynamic import loading skeleton rendered
vi.mock("@/components/neuro/Brain3DViewer", () => new Promise(() => {}));

describe("NeuroRecon Dynamic Import & Skeleton Placeholder Suite", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
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

  it("initially renders the pulsing skeleton loading placeholder with exactly 460px height", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<NeuroReconClient />);
    });

    // Verify skeleton exists
    const skeleton = container.querySelector(
      '[data-testid="brain-3d-skeleton"]'
    );
    expect(skeleton).not.toBeNull();

    // Verify its content and style constraints
    expect(container.textContent).toContain("Initializing 3D Engine...");
    expect(container.textContent).toContain("NeuroRecon 3D Viewer");
    expect(container.textContent).toContain(
      "Loading heavy WebGL visualizer and 3D brain mesh..."
    );
    expect(container.textContent).toContain("PREPARING T1 MESH BUFFER");

    // Verify strictly 460px height styling
    expect(skeleton?.classList.contains("h-[460px]")).toBe(true);
  });
});
