// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

import React, { act } from "react";
import { fromAny } from "@total-typescript/shoehorn";
import { createRoot, type Root } from "react-dom/client";
import { NeuroReconClient } from "@/components/neuro/NeuroReconClient";
import type { ControlPoint } from "@/lib/neuro";
import type { SyntheticVolume } from "@/lib/neuro/volume-generator";

/**
 * Case switches await the volume before committing (#3802). These tests hold
 * each case's volume until the test releases it, so loads can settle out of
 * order, and check that the last selected case owns everything shown.
 */
const loads = vi.hoisted(() => ({
  hold: false,
  pending: [] as { id: string; release: () => void }[],
}));

vi.mock("@/lib/neuro/loader", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/neuro/loader")>();
  return {
    ...real,
    computeSyntheticVolume: (
      id: Parameters<typeof real.computeSyntheticVolume>[0]
    ) => {
      if (!loads.hold) return real.computeSyntheticVolume(id);
      return new Promise<SyntheticVolume>((resolve) => {
        loads.pending.push({
          id,
          release: () => resolve(real.computeSyntheticVolumeSync(id)),
        });
      });
    },
  };
});

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

describe("neuro case switches settle to the last selection (#3802)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    window.location.hash = "";
    loads.hold = false;
    loads.pending = [];
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
    HTMLCanvasElement.prototype.getContext = fromAny<
      typeof HTMLCanvasElement.prototype.getContext,
      unknown
    >(vi.fn(() => ctx));
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    act(() => root?.unmount());
    container.remove();
    loads.hold = false;
  });

  const caseButton = (label: string) =>
    Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes(label)
    );

  const select = async (label: string) => {
    const btn = caseButton(label);
    expect(btn).toBeDefined();
    await act(async () => {
      btn?.click();
    });
  };

  const release = async (label: string) => {
    const index = loads.pending.findIndex((p) => p.id === label);
    expect(index).toBeGreaterThanOrEqual(0);
    const [load] = loads.pending.splice(index, 1);
    await act(async () => {
      load!.release();
    });
    for (let i = 0; i < 3; i++) {
      await act(async () => {
        await Promise.resolve();
      });
    }
  };

  const cpCount = () =>
    container.querySelector('[data-testid="cp-count"]')?.textContent;

  const addCp = async () => {
    const b = container.querySelector('[data-testid="add-cp"]');
    await act(async () => {
      (b as HTMLButtonElement).click();
    });
  };

  const lastLoaded = () => {
    const text = container.textContent ?? "";
    const matches = [...text.matchAll(/Loaded (Case 0\d)/g)];
    return matches.at(-1)?.[1];
  };

  async function mount() {
    await act(async () => {
      root = createRoot(container);
      root.render(<NeuroReconClient />);
    });
  }

  it("a slower earlier load cannot commit after the later one", async () => {
    await mount();
    loads.hold = true;
    await select("Case 02");
    await select("Case 03");
    const ids = loads.pending.map((p) => p.id);
    expect(ids).toHaveLength(2);

    // Case 03's volume arrives first, then Case 02's.
    await release(ids[1]!);
    await release(ids[0]!);

    expect(lastLoaded()).toBe("Case 03");
  });

  it("switching again before a load lands parks each case's own edits", async () => {
    await mount();
    await addCp();
    expect(cpCount()).toBe("1");

    loads.hold = true;
    await select("Case 02");
    await select("Case 03");
    const ids = loads.pending.map((p) => p.id);
    await release(ids[0]!);
    await release(ids[1]!);
    loads.hold = false;

    // Case 02 was never edited, so it must open empty, not with Case 01's edit.
    await select("Case 02");
    expect(cpCount()).toBe("0");
    expect(caseButton("Case 02")?.textContent).not.toContain(
      "has unsaved edits"
    );
    // Case 01 keeps its own draft.
    await select("Case 01");
    expect(cpCount()).toBe("1");
  });

  it("a load that lands after unmount commits nothing and does not throw", async () => {
    await mount();
    loads.hold = true;
    await select("Case 02");
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    act(() => root.unmount());
    await act(async () => {
      loads.pending.splice(0).forEach((p) => p.release());
      await Promise.resolve();
    });
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
    root = createRoot(container);
  });
});
