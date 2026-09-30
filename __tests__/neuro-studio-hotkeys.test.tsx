// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import {
  render,
  screen,
  act,
  cleanup,
  fireEvent,
} from "@testing-library/react";
import { NeuroReconClient } from "@/components/neuro/NeuroReconClient";

/**
 * Issue #1580: the NeuroRecon studio binds its shortcuts through useHotkeys
 * with the same keys, modifiers, preventDefault and input suppression as the
 * raw window keydown listener it replaces.
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

// A lightweight Field Manual that shows whether it is open and can be closed.
vi.mock("@/components/neuro/NeuroFieldManual", () => ({
  NeuroFieldManual: ({
    isOpen,
    onClose,
  }: {
    isOpen: boolean;
    onClose: () => void;
  }) =>
    isOpen ? (
      <div data-testid="field-manual-stub">
        <button type="button" onClick={onClose}>
          Close manual
        </button>
      </div>
    ) : null,
}));
vi.mock("@/components/neuro/NeuroSuccessDialog", () => ({
  NeuroSuccessDialog: () => null,
}));

const TOOL_TITLES = {
  inspect: /^Inspect/,
  control_point: /^Control Point/,
  paint: /^Voxel Paint Brush/,
  erase: /^Voxel Erase Brush/,
} as const;

function activeTool(): string | undefined {
  return (Object.keys(TOOL_TITLES) as (keyof typeof TOOL_TITLES)[]).find(
    (tool) =>
      screen.getByTitle(TOOL_TITLES[tool]).className.includes("font-bold")
  );
}

/** Dispatches a keydown on the target and returns the event for inspection. */
function press(
  key: string,
  init: KeyboardEventInit = {},
  target: Element = document.body
): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
    ...init,
  });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

const reconRuns = () =>
  (document.body.textContent?.match(/recon-all -s sub-01 -autorecon/g) ?? [])
    .length;

describe("NeuroRecon studio hotkeys (#1580)", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", window.location.pathname);
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
    window.history.replaceState(null, "", window.location.pathname);
    vi.restoreAllMocks();
  });

  it.each([
    ["2", "control_point"],
    ["3", "paint"],
    ["4", "erase"],
    ["1", "inspect"],
    ["c", "control_point"],
    ["b", "paint"],
    ["e", "erase"],
    ["v", "inspect"],
  ])("selects a tool with the bare key %s", (key, tool) => {
    render(<NeuroReconClient />);
    // Start from a tool other than the target.
    press(tool === "paint" ? "4" : "3");
    press(key);
    expect(activeTool()).toBe(tool);
  });

  it("accepts Shift with a tool letter", () => {
    render(<NeuroReconClient />);
    press("E", { shiftKey: true });
    expect(activeTool()).toBe("erase");
  });

  it.each([
    ["Ctrl", { ctrlKey: true }],
    ["Meta", { metaKey: true }],
    ["Alt", { altKey: true }],
  ])("ignores %s chords", (_name, modifiers) => {
    render(<NeuroReconClient />);
    press("3");
    press("4", modifiers);
    press("r", modifiers);
    press(" ", modifiers);
    press("m", modifiers);
    expect(activeTool()).toBe("paint");
    expect(reconRuns()).toBe(0);
    expect(screen.queryByTestId("field-manual-stub")).toBeNull();
  });

  it("ignores keys typed in the FreeSurfer terminal input", () => {
    render(<NeuroReconClient />);
    press("3");
    const input = document.querySelector(
      "input[type='text'], input:not([type])"
    );
    expect(input).not.toBeNull();
    const event = press("4", {}, input as Element);
    press("r", {}, input as Element);
    expect(activeTool()).toBe("paint");
    expect(reconRuns()).toBe(0);
    expect(event.defaultPrevented).toBe(false);
  });

  it("runs recon on R and Space inside the studio's keyboard boundary and prevents the default", () => {
    render(<NeuroReconClient />);
    const boundary = document.querySelector("[data-keyboard-boundary]");
    expect(boundary).not.toBeNull();

    const r = press("r", {}, boundary as Element);
    expect(r.defaultPrevented).toBe(true);
    expect(reconRuns()).toBe(1);
  });

  it("runs recon on Space from the page but leaves Space on a focused button to the button", () => {
    render(<NeuroReconClient />);
    const space = press(" ");
    expect(space.defaultPrevented).toBe(true);
    expect(reconRuns()).toBe(1);

    // Keydown targets the focused element, which is the button itself.
    const button = screen.getByText("2D Only").closest("button") as Element;
    const onButton = press(" ", {}, button);
    expect(onButton.defaultPrevented).toBe(false);
  });

  it("does not prevent the default for tool and manual keys", () => {
    render(<NeuroReconClient />);
    expect(press("3").defaultPrevented).toBe(false);
    expect(press("m").defaultPrevented).toBe(false);
  });

  it("opens the Field Manual with M or ? and suspends hotkeys while it is open", () => {
    render(<NeuroReconClient />);
    press("3");

    press("m");
    expect(screen.getByTestId("field-manual-stub")).toBeDefined();
    press("4");
    press("m");
    expect(activeTool()).toBe("paint");
    expect(screen.getByTestId("field-manual-stub")).toBeDefined();

    fireEvent.click(screen.getByText("Close manual"));
    expect(screen.queryByTestId("field-manual-stub")).toBeNull();

    press("?", { shiftKey: true });
    expect(screen.getByTestId("field-manual-stub")).toBeDefined();
  });

  it("binds its shortcuts through useHotkeys rather than a raw keydown listener", () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, "..", "components/neuro/NeuroReconClient.tsx"),
      "utf8"
    );
    expect(source).toContain("useHotkeys(");
    expect(source).not.toMatch(/addEventListener\(\s*["']keydown["']/);
  });
});
