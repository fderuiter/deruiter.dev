// @vitest-environment jsdom
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
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(((
      contextId: string
    ) =>
      contextId === "2d"
        ? context2D
        : null) as unknown as HTMLCanvasElement["getContext"]);
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
});
