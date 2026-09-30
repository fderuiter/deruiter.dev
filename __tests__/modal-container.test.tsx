import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React, { useState } from "react";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from "@testing-library/react";
import { ModalContainer } from "@/components/ui/ModalContainer";
import { CRTCalibrationModal } from "@/components/arcade/CRTCalibrationModal";
import { MountainMap } from "@/components/patrol/MountainMap";
import { DEFAULT_CRT_CALIBRATION } from "@/lib/arcade/crt-pipeline";
import { safeStorage } from "@/lib/safe-storage";

/**
 * Issue #1131: bespoke dialogs migrated onto the shared ModalContainer keep
 * their focus trap, Escape dismissal and focus restoration, and gain the
 * primitive's backdrop dismissal and viewport bounds.
 */

function mockMatchMedia() {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  window.localStorage.clear();
  safeStorage.clearCache?.();
  mockMatchMedia();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  window.localStorage.clear();
  safeStorage.clearCache?.();
  vi.restoreAllMocks();
});

/** Flushes the focus trap's deferred initial-focus and restore timers. */
function flushFocusTimers() {
  act(() => {
    vi.advanceTimersByTime(100);
  });
}

describe("ModalContainer backdrop dismissal", () => {
  it("closes on a press that starts and ends on the backdrop", () => {
    const onClose = vi.fn();
    render(
      <ModalContainer isOpen onClose={onClose} ariaLabel="Test dialog">
        <input aria-label="Field" />
      </ModalContainer>
    );
    const backdrop = screen.getByRole("dialog");
    fireEvent.mouseDown(backdrop);
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("stays open when a drag starts inside the panel and ends on the backdrop", () => {
    const onClose = vi.fn();
    render(
      <ModalContainer isOpen onClose={onClose} ariaLabel="Test dialog">
        <input aria-label="Field" type="range" />
      </ModalContainer>
    );
    const backdrop = screen.getByRole("dialog");
    fireEvent.mouseDown(screen.getByLabelText("Field"));
    // The browser dispatches the click on the common ancestor: the backdrop.
    fireEvent.click(backdrop);
    expect(onClose).not.toHaveBeenCalled();

    // The guard resets, so the next genuine backdrop press still dismisses.
    fireEvent.mouseDown(backdrop);
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("ignores clicks inside the panel", () => {
    const onClose = vi.fn();
    render(
      <ModalContainer isOpen onClose={onClose} ariaLabel="Test dialog">
        <button type="button">Inside</button>
      </ModalContainer>
    );
    const inside = screen.getByRole("button", { name: "Inside" });
    fireEvent.mouseDown(inside);
    fireEvent.click(inside);
    expect(onClose).not.toHaveBeenCalled();
  });
});

function CrtHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open calibration
      </button>
      <CRTCalibrationModal
        isOpen={open}
        onClose={() => setOpen(false)}
        config={DEFAULT_CRT_CALIBRATION}
        onChange={vi.fn()}
      />
    </>
  );
}

describe("CRTCalibrationModal on ModalContainer", () => {
  it("is a labelled, described modal dialog with the original panel styling", () => {
    render(<CrtHarness />);
    fireEvent.click(screen.getByRole("button", { name: "Open calibration" }));

    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-labelledby")).toBe(
      "crt-calibration-title"
    );
    expect(dialog.getAttribute("aria-describedby")).toBe(
      "crt-calibration-desc"
    );
    expect(dialog.className).toContain("backdrop-blur-md");
    expect(dialog.className).toContain("animate-fadeIn");

    const panel = dialog.firstElementChild as HTMLElement;
    expect(panel.className).toContain("bg-neutral-950");
    expect(panel.className).toContain("font-mono");
    expect(panel.className).toContain("max-w-2xl");
    expect(panel.className).toContain("max-h-[85vh]");
  });

  it("traps focus, dismisses on Escape and restores focus to the trigger", () => {
    render(<CrtHarness />);
    const trigger = screen.getByRole("button", { name: "Open calibration" });
    trigger.focus();
    fireEvent.click(trigger);
    flushFocusTimers();

    const dialog = screen.getByRole("dialog");
    expect(dialog.contains(document.activeElement)).toBe(true);

    // Shift+Tab from the first control wraps to the last one inside.
    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(dialog.contains(document.activeElement)).toBe(true);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    flushFocusTimers();
    expect(document.activeElement).toBe(trigger);
  });

  it("dismisses on a backdrop press", () => {
    render(<CrtHarness />);
    fireEvent.click(screen.getByRole("button", { name: "Open calibration" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.mouseDown(dialog);
    fireEvent.click(dialog);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("stays open when a slider drag is released over the backdrop", () => {
    render(<CrtHarness />);
    fireEvent.click(screen.getByRole("button", { name: "Open calibration" }));
    const dialog = screen.getByRole("dialog");
    const slider = dialog.querySelector('input[type="range"]') as HTMLElement;
    fireEvent.mouseDown(slider);
    fireEvent.click(dialog);
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});

describe("MountainMap responsibility-code modal on ModalContainer", () => {
  function renderMap() {
    render(
      <MountainMap
        incidentsCompleted={0}
        onAwaitDispatch={vi.fn()}
        onCompleteShift={vi.fn()}
      />
    );
    return screen.getByLabelText("View Your Responsibility Code");
  }

  it("keeps the lighter mobile scrim without backdrop blur", () => {
    fireEvent.click(renderMap());
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-labelledby")).toBe(
      "responsibility-modal-title"
    );
    expect(dialog.className).toContain("bg-black/90");
    expect(dialog.className).toContain("md:bg-black/80");
    expect(dialog.className).toContain("backdrop-blur-none");
    expect(dialog.className).toContain("md:backdrop-blur-sm");
    expect(dialog.className).not.toMatch(/(^|\s)backdrop-blur-sm/);
  });

  it("dismisses on a backdrop press and restores focus to the trigger", () => {
    const trigger = renderMap();
    trigger.focus();
    fireEvent.click(trigger);
    flushFocusTimers();

    const dialog = screen.getByRole("dialog");
    expect(dialog.contains(document.activeElement)).toBe(true);

    fireEvent.mouseDown(dialog);
    fireEvent.click(dialog);
    expect(screen.queryByRole("dialog")).toBeNull();
    flushFocusTimers();
    expect(document.activeElement).toBe(trigger);
  });

  it("dismisses on Escape", () => {
    fireEvent.click(renderMap());
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
