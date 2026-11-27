// @vitest-environment jsdom
import { fromAny } from "@total-typescript/shoehorn";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import {
  render,
  screen,
  act,
  cleanup,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { NeuroReconClient } from "@/components/neuro/NeuroReconClient";
import { getByTooltip } from "./helpers/tooltip";

/**
 * Issue #1451: NeuroRecon derives its view, dataset and tool from
 * useStudioHashParams instead of parsing window.location.hash on startup, so
 * deep links hydrate without a mismatch and Back/Forward keep working.
 */

vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({
    playNote: vi.fn(),
    playSuccess: vi.fn(),
    playHover: vi.fn(),
  }),
  AudioProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/hooks/useTelemetry", () => ({
  useTelemetry: () => ({
    recordEvent: vi.fn(),
  }),
}));

// The closed dialogs render through portals, which the server renderer
// rejects; they play no part in the hash state under test.
vi.mock("@/components/neuro/NeuroFieldManual", () => ({
  NeuroFieldManual: () => null,
}));
vi.mock("@/components/neuro/NeuroSuccessDialog", () => ({
  NeuroSuccessDialog: () => null,
}));

// A lightweight 3D viewer stub keeps WebGL out of JSDOM (AGENTS.md section 7).
// Depending on whether next/dynamic has loaded it yet, the 3D pane shows this
// stub or the loading skeleton; either one means the pane is rendered.
vi.mock("@/components/neuro/Brain3DViewer", () => ({
  Brain3DViewer: () => <div data-testid="brain-3d-stub" />,
}));

const THREE_D_PANE =
  '[data-testid="brain-3d-skeleton"], [data-testid="brain-3d-stub"]';

function setHash(hash: string) {
  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}${hash ? `#${hash}` : ""}`
  );
}

/** Simulates the browser restoring a history entry with the given hash. */
function navigateHistory(hash: string) {
  act(() => {
    setHash(hash);
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
}

function scenarioTab(label: string) {
  return screen.getByText(label).closest("button") as HTMLButtonElement;
}

function datasetButton(label: string) {
  return screen.getByText(label).closest("button") as HTMLButtonElement;
}

const has3DView = () => document.querySelector(THREE_D_PANE) !== null;
const hasBrushControls = () =>
  screen.queryByLabelText("Brush radius 1") !== null;
const hasRoiToolbarPrompt = () =>
  screen.queryByTestId("neuro-roi-toolbar-prompt") !== null;

describe("NeuroRecon hash-derived startup state (#1451)", () => {
  beforeEach(() => {
    setHash("");
    const context2D = new Proxy(
      {
        getImageData: (_x: number, _y: number, w: number, h: number) => ({
          data: new Uint8ClampedArray(4 * w * h),
          width: w,
          height: h,
        }),
        createImageData: (w: number, h: number) => ({
          data: new Uint8ClampedArray(4 * w * h),
          width: w,
          height: h,
        }),
        measureText: (text: string) => ({ width: (text || "").length * 8 }),
      } as Record<string | symbol, unknown>,
      {
        get: (target, key) => (key in target ? target[key] : () => {}),
        set: () => true,
      }
    );
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      fromAny((contextId: string) => (contextId === "2d" ? context2D : null))
    );
  });

  afterEach(() => {
    cleanup();
    setHash("");
    vi.restoreAllMocks();
  });

  it("opens a deep-linked case, view and tool", async () => {
    setHash("scenario=wm_hypointensity&view=2d&tool=paint");
    render(<NeuroReconClient />);

    await waitFor(() =>
      expect(scenarioTab("Case 02").className).toContain("bg-brand-cyan")
    );
    expect(has3DView()).toBe(false);
    expect(hasBrushControls()).toBe(true);
  });

  it("falls back to the case study for a real-scan dataset paired with a defect case", async () => {
    setHash("dataset=mni152&scenario=dura_inclusion");
    render(<NeuroReconClient />);

    await waitFor(() =>
      expect(datasetButton("QA Scenarios").className).toContain("bg-zinc-800")
    );
    expect(datasetButton("MNI152 (GLB)").className).not.toContain(
      "bg-zinc-800"
    );
  });

  it("writes in-app view and tool changes to the hash and follows Back/Forward", async () => {
    render(<NeuroReconClient />);
    expect(has3DView()).toBe(true);

    fireEvent.click(screen.getByText("2D Only"));
    expect(window.location.hash).toContain("view=2d");
    expect(has3DView()).toBe(false);

    navigateHistory("");
    expect(has3DView()).toBe(true);

    navigateHistory("view=2d&tool=erase");
    expect(has3DView()).toBe(false);
    expect(hasBrushControls()).toBe(true);

    navigateHistory("view=2d&tool=roi_select");
    expect(has3DView()).toBe(false);
    expect(hasBrushControls()).toBe(false);
    expect(hasRoiToolbarPrompt()).toBe(true);
    expect(getByTooltip(/^ROI Region Grow/).className).toContain("font-bold");
  });

  it("preserves #tool=roi_select on deep link and falls back to recommendedTool for unknown #tool values", async () => {
    setHash("tool=roi_select");
    render(<NeuroReconClient />);

    await waitFor(() =>
      expect(getByTooltip(/^ROI Region Grow/).className).toContain("font-bold")
    );
    expect(hasBrushControls()).toBe(false);
    expect(hasRoiToolbarPrompt()).toBe(true);

    // Unknown #tool value falls back to Case 01 recommendedTool ("erase")
    navigateHistory("tool=invalid_mode");
    expect(getByTooltip(/^Voxel Erase Brush/).className).toContain("font-bold");
    expect(hasBrushControls()).toBe(true);
    expect(hasRoiToolbarPrompt()).toBe(false);
  });

  it("surfaces a 2D slice hint banner when roi_select is active in 3D Only view and opens Split 3D/2D", async () => {
    setHash("view=3d&tool=roi_select");
    render(<NeuroReconClient />);

    const hint = await screen.findByTestId("neuro-roi-3d-slice-hint");
    expect(hint.textContent).toContain("ROI Region Grow seeds from 2D");
    expect(screen.queryByText("2D Multi-Planar Orthoview")).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: /Open Split 3D\/2D Slices/i })
    );
    expect(window.location.hash).not.toContain("view=3d");
    expect(window.location.hash).toContain("tool=roi_select");
    expect(screen.queryByTestId("neuro-roi-3d-slice-hint")).toBeNull();
    expect(screen.getByText("2D Multi-Planar Orthoview")).not.toBeNull();
  });

  it("hydrates a deep link without a server/client markup mismatch", async () => {
    const { renderToString } = await import("react-dom/server");
    const { hydrateRoot } = await import("react-dom/client");

    // The server never sees the hash: render the SSR markup without one.
    setHash("");
    const html = renderToString(<NeuroReconClient />);

    setHash("scenario=wm_hypointensity&view=2d&tool=paint");
    const host = document.createElement("div");
    host.innerHTML = html;
    document.body.appendChild(host);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const recoverable = vi.fn();

    let root: ReturnType<typeof hydrateRoot> | undefined;
    await act(async () => {
      root = hydrateRoot(host, <NeuroReconClient />, {
        onRecoverableError: recoverable,
      });
    });

    expect(recoverable).not.toHaveBeenCalled();
    expect(
      errorSpy.mock.calls.filter((args) =>
        String(args[0]).toLowerCase().includes("hydrat")
      )
    ).toEqual([]);

    // After hydration the client snapshot applies the deep link.
    await waitFor(() => expect(host.querySelector(THREE_D_PANE)).toBeNull());
    expect(host.querySelector('[aria-label="Brush radius 1"]')).not.toBeNull();

    act(() => root?.unmount());
    host.remove();
  });

  it("hydrates a #tool=roi_select deep link without a server/client markup mismatch", async () => {
    const { renderToString } = await import("react-dom/server");
    const { hydrateRoot } = await import("react-dom/client");

    setHash("");
    const html = renderToString(<NeuroReconClient />);

    setHash("view=2d&tool=roi_select");
    const host = document.createElement("div");
    host.innerHTML = html;
    document.body.appendChild(host);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const recoverable = vi.fn();

    let root: ReturnType<typeof hydrateRoot> | undefined;
    await act(async () => {
      root = hydrateRoot(host, <NeuroReconClient />, {
        onRecoverableError: recoverable,
      });
    });

    expect(recoverable).not.toHaveBeenCalled();
    expect(
      errorSpy.mock.calls.filter((args) =>
        String(args[0]).toLowerCase().includes("hydrat")
      )
    ).toEqual([]);

    await waitFor(() =>
      expect(
        host.querySelector('[data-testid="neuro-roi-toolbar-prompt"]')
      ).not.toBeNull()
    );
    expect(host.querySelector('[aria-label="Brush radius 1"]')).toBeNull();

    act(() => root?.unmount());
    host.remove();
  });
});
