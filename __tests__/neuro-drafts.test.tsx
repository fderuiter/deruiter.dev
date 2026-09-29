// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { NeuroReconClient } from "@/components/neuro/NeuroReconClient";
import {
  applyVoxelEditsToVolume,
  countNeuroDraftEdits,
  withNeuroDraft,
  generateSyntheticVolume,
  type ControlPoint,
} from "@/lib/neuro";

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
vi.mock("@/components/neuro/Brain3DViewer", () => ({
  Brain3DViewer: () => null,
}));
vi.mock("@/components/neuro/MultiPlanarSliceViewer", () => ({
  MultiPlanarSliceViewer: (props: {
    onAddControlPoint: (p: Omit<ControlPoint, "id" | "timestamp">) => void;
    controlPoints: ControlPoint[];
  }) => (
    <div>
      <span data-testid="cp-count">{props.controlPoints.length}</span>
      <button
        data-testid="add-cp"
        onClick={() =>
          props.onAddControlPoint({
            x: 10,
            y: 10,
            z: 10,
            intensity: 110,
          } as never)
        }
      >
        add cp
      </button>
    </div>
  ),
}));

describe("neuro draft helpers", () => {
  it("stores and clears drafts", () => {
    const d = { controlPoints: [], voxelEdits: [] };
    expect(countNeuroDraftEdits(d)).toBe(0);
    const withEdit = {
      controlPoints: [],
      voxelEdits: [
        {
          x: 1,
          y: 1,
          z: 1,
          originalValue: 0,
          newValue: 1,
          layer: "wm" as const,
        },
      ],
    };
    const m = withNeuroDraft({}, "dura_inclusion", withEdit);
    expect(countNeuroDraftEdits(m.dura_inclusion)).toBe(1);
    expect(
      withNeuroDraft(m, "dura_inclusion", d).dura_inclusion
    ).toBeUndefined();
  });

  it("replays voxel edits onto a fresh volume", () => {
    const vol = generateSyntheticVolume("sandbox");
    const size = vol.dimensions.width;
    const idx = 5 * size * size + 5 * size + 5;
    applyVoxelEditsToVolume(vol, [
      { x: 5, y: 5, z: 5, originalValue: 0, newValue: 1, layer: "wm" },
    ]);
    expect(vol.wmMask[idx]).toBe(1);
    expect(vol.rawT1[idx]).toBe(110);
  });
});

describe("neuro draft workflow", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    window.location.hash = "";
    const ctx = new Proxy(
      {
        getImageData: (_x: number, _y: number, w: number, h: number) => ({
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
  });

  const click = async (match: (t: string) => boolean, label?: string) => {
    const btn = Array.from(container.querySelectorAll("button")).find(
      (b) =>
        match(b.textContent ?? "") ||
        (label && b.getAttribute("aria-label") === label)
    );
    expect(btn).toBeDefined();
    await act(async () => {
      btn?.click();
    });
  };

  it("keeps a case draft across case switches and offers undo after reset", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<NeuroReconClient />);
    });
    expect(container.textContent).toContain("Share links never include");

    const cpCount = () =>
      container.querySelector('[data-testid="cp-count"]')?.textContent;
    const addCp = async () => {
      const b = container.querySelector('[data-testid="add-cp"]');
      await act(async () => {
        (b as HTMLButtonElement).click();
      });
    };
    await addCp();
    expect(cpCount()).toBe("1");

    // case -> case: draft kept and flagged
    await click((t) => t.includes("Case 02"));
    expect(cpCount()).toBe("0");
    const case1 = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Case 01")
    );
    expect(case1?.textContent).toContain("has unsaved edits");

    // return: draft restored
    await click((t) => t.includes("Case 01"));
    expect(cpCount()).toBe("1");

    // reset: cleared with undo
    await click(() => false, "Reset workspace");
    expect(cpCount()).toBe("0");
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      "Reset cleared 1 edit"
    );
    await click((t) => t.includes("Undo reset"));
    expect(cpCount()).toBe("1");
  });
});
