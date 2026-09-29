// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { NeuroReconClient } from "@/components/neuro/NeuroReconClient";

vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({
    playNote: vi.fn(),
    playSuccess: vi.fn(),
    playHover: vi.fn(),
  }),
  AudioProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/hooks/useTelemetry", () => ({
  useTelemetry: () => ({ recordEvent: vi.fn() }),
}));

vi.mock("@/lib/neuro/loader", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/neuro/loader")>();
  return {
    ...actual,
    computeQAMetrics: vi.fn(async () => ({
      eulerCharacteristic: 2,
      defectCount: 0,
      diceScore: 0.98,
      meanCorticalThicknessMm: 2.5,
      controlPointCount: 0,
      voxelEditsCount: 0,
      isResolved: true,
      accuracyScore: 100,
    })),
  };
});

describe("NeuroRecon reward policy (#1218)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    const ctx = new Proxy(
      {
        getImageData: (_x: number, _y: number, w: number, h: number) => ({
          data: new Uint8ClampedArray(w * h * 4),
          width: w,
          height: h,
        }),
        createImageData: (w: number, h: number) => ({
          data: new Uint8ClampedArray(w * h * 4),
          width: w,
          height: h,
        }),
        measureText: (t: string) => ({ width: t.length * 8, height: 16 }),
      } as Record<string, unknown>,
      { get: (t, k: string) => t[k] ?? vi.fn() }
    );
    HTMLCanvasElement.prototype.getContext = vi.fn(
      () => ctx
    ) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    act(() => root?.unmount());
    container.remove();
    vi.useRealTimers();
  });

  const clickButton = async (match: (t: string) => boolean) => {
    const btn = Array.from(container.querySelectorAll("button")).find((b) =>
      match(b.textContent ?? "")
    );
    expect(btn).toBeDefined();
    await act(async () => {
      btn?.click();
    });
  };

  const runRecon = async () => {
    await clickButton((t) => t.includes("RUN RECON-ALL"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
  };

  const mount = async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<NeuroReconClient />);
    });
  };

  it("never awards points or streak for a clean Sandbox run", async () => {
    await mount();
    await clickButton((t) => t.trim() === "Sandbox");
    await runRecon();
    await runRecon();

    expect(container.textContent).toContain("1,200");
    expect(container.textContent).toContain("Streak: 0");
    expect(container.textContent).not.toContain("Scenario Target Reached");
    expect(container.textContent).toContain("INSPECTION PASS");
    expect(container.textContent).not.toContain("+500 PTS");
  });

  it("awards a repair case once and shows the true multiplier-adjusted reward", async () => {
    await mount();
    await clickButton((t) => t.includes("Case 01"));
    await runRecon();
    expect(container.textContent).toContain("Scenario Target Reached");
    expect(container.textContent).toContain("+500 PTS");
    expect(container.textContent).toContain("1,700");
    expect(container.textContent).toContain("Streak: 1");

    await clickButton((t) => t.includes("Stay in Current Case"));
    await runRecon();

    expect(container.textContent).not.toContain("Scenario Target Reached");
    expect(container.textContent).toContain("1,700");
    expect(container.textContent).toContain("Streak: 1");
    expect(container.textContent).toContain("No additional points");

    // A different case pays the escalated (2x) multiplier and displays it.
    await clickButton((t) => t.includes("Case 02"));
    await runRecon();
    expect(container.textContent).toContain("+1000 PTS");
    expect(container.textContent).toContain("2,700");
    expect(container.textContent).toContain("Streak: 2");
  });
});
