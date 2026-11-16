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
    return screen.getByLabelText("Safety Code: view Your Responsibility Code");
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

/**
 * Issue #3975: ModalContainer is a native dialog. jsdom has no showModal(),
 * so these tests stub it and check the lifecycle wiring only; real browsers
 * check actual modality.
 */
describe("ModalContainer on the native dialog element", () => {
  const proto = HTMLDialogElement.prototype;
  const stub = (name: string, value: unknown) =>
    Object.defineProperty(proto, name, {
      configurable: true,
      writable: true,
      value,
    });
  let showModal: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    showModal = vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    });
    stub("showModal", showModal);
    stub("close", function (this: HTMLDialogElement) {
      if (!this.hasAttribute("open")) return;
      this.removeAttribute("open");
      this.dispatchEvent(new Event("close"));
    });
  });

  afterEach(() => {
    cleanup();
    Reflect.deleteProperty(proto, "showModal");
    Reflect.deleteProperty(proto, "close");
  });

  const cancel = (dialog: HTMLElement) => {
    const event = new Event("cancel", { cancelable: true });
    dialog.dispatchEvent(event);
    return event;
  };

  it("opens with showModal() as a dialog element", () => {
    render(
      <React.StrictMode>
        <ModalContainer isOpen onClose={vi.fn()} ariaLabel="Native">
          <button type="button">Inside</button>
        </ModalContainer>
      </React.StrictMode>
    );
    const dialog = screen.getByRole("dialog", { name: "Native" });
    expect(dialog.tagName).toBe("DIALOG");
    expect(dialog.hasAttribute("open")).toBe(true);
    expect(showModal).toHaveBeenCalled();
  });

  it("turns a cancel into one onClose call and keeps the dialog open", () => {
    const onClose = vi.fn();
    render(
      <ModalContainer isOpen onClose={onClose} ariaLabel="Native">
        <button type="button">Inside</button>
      </ModalContainer>
    );
    const dialog = screen.getByRole("dialog");
    expect(cancel(dialog).defaultPrevented).toBe(true);
    cancel(dialog);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(dialog.hasAttribute("open")).toBe(true);
  });

  it("prevents cancel without calling onClose when Escape may not close", () => {
    const onClose = vi.fn();
    render(
      <ModalContainer
        isOpen
        onClose={onClose}
        closeOnEscape={false}
        ariaLabel="Native"
      >
        <button type="button">Inside</button>
      </ModalContainer>
    );
    const dialog = screen.getByRole("dialog");
    expect(cancel(dialog).defaultPrevented).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("treats a native close as one close request", () => {
    const onClose = vi.fn();
    render(
      <ModalContainer isOpen onClose={onClose} ariaLabel="Native">
        <button type="button">Inside</button>
      </ModalContainer>
    );
    const dialog = screen.getByRole("dialog") as HTMLDialogElement;
    cancel(dialog);
    dialog.close();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("reopens after a native close when Escape may not close", () => {
    const onClose = vi.fn();
    render(
      <ModalContainer
        isOpen
        onClose={onClose}
        closeOnEscape={false}
        ariaLabel="Native"
      >
        <button type="button">Inside</button>
      </ModalContainer>
    );
    const dialog = screen.getByRole("dialog") as HTMLDialogElement;
    const opens = showModal.mock.calls.length;
    dialog.close();
    expect(onClose).not.toHaveBeenCalled();
    expect(showModal.mock.calls.length).toBe(opens + 1);
    expect(dialog.hasAttribute("open")).toBe(true);
  });

  it("does not call onClose when the parent closes it", () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <ModalContainer isOpen onClose={onClose} ariaLabel="Native">
        <button type="button">Inside</button>
      </ModalContainer>
    );
    rerender(
      <ModalContainer isOpen={false} onClose={onClose} ariaLabel="Native">
        <button type="button">Inside</button>
      </ModalContainer>
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("still wraps Tab from the last control to the first", () => {
    render(
      <ModalContainer isOpen onClose={vi.fn()} ariaLabel="Native">
        <button type="button">First</button>
        <button type="button">Last</button>
      </ModalContainer>
    );
    const last = screen.getByRole("button", { name: "Last" });
    last.focus();
    fireEvent.keyDown(window, { key: "Tab" });
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "First" })
    );
  });
});
