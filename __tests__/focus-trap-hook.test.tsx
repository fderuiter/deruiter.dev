import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { useState } from "react";
import { render, screen, act, cleanup } from "@testing-library/react";
import { useFocusTrap } from "@/hooks/useFocusTrap";

function ModalDialog({ isOpen, onEscape }: { isOpen: boolean; onEscape?: () => void }) {
  const trapRef = useFocusTrap<HTMLDivElement>(isOpen, { onEscape, returnFocus: true });

  if (!isOpen) return null;

  return (
    <div
      ref={trapRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="modal-box"
    >
      <h2 id="modal-title">Accessible Dialog</h2>
      <button id="btn-first">First Action</button>
      <input id="input-middle" placeholder="Type here" />
      <button id="btn-last">Close Modal</button>
    </div>
  );
}

function TestContainer() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button id="trigger-btn" onClick={() => setOpen(true)}>
        Open Modal
      </button>
      <ModalDialog isOpen={open} onEscape={() => setOpen(false)} />
    </div>
  );
}

describe("useFocusTrap Hook & Accessibility Keyboard Boundary", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  });

  afterEach(() => {
    cleanup();
    document.body.innerHTML = "";
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("traps focus and shifts initial focus to the first interactive element", async () => {
    render(<TestContainer />);
    const trigger = screen.getByRole("button", { name: "Open Modal" });
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    // Open modal
    await act(async () => {
      trigger.click();
    });

    // Advance timer to trigger initialFocus timeout
    act(() => {
      vi.advanceTimersByTime(60);
    });

    const firstBtn = screen.getByRole("button", { name: "First Action" });
    expect(document.activeElement).toBe(firstBtn);
  });

  it("does not read a torn-down document when restoring focus after cleanup", () => {
    render(<ModalDialog isOpen={true} />);
    cleanup();

    vi.stubGlobal("document", undefined);
    try {
      expect(() => vi.runOnlyPendingTimers()).not.toThrow();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("triggers onEscape callback when Escape key is pressed", async () => {
    const handleEscape = vi.fn();
    render(<ModalDialog isOpen={true} onEscape={handleEscape} />);

    act(() => {
      vi.advanceTimersByTime(60);
    });

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeDefined();

    // Fire keydown Escape
    act(() => {
      const event = new KeyboardEvent("keydown", { key: "Escape", bubbles: true });
      document.dispatchEvent(event);
    });

    expect(handleEscape).toHaveBeenCalledTimes(1);
  });

  it("cycles forward from last element to first element on Tab", async () => {
    render(<ModalDialog isOpen={true} />);
    act(() => {
      vi.advanceTimersByTime(60);
    });

    const firstBtn = screen.getByRole("button", { name: "First Action" });
    const lastBtn = screen.getByRole("button", { name: "Close Modal" });

    // Focus last button
    lastBtn.focus();
    expect(document.activeElement).toBe(lastBtn);

    // Dispatch Tab keydown on document
    act(() => {
      const tabEvent = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
      document.dispatchEvent(tabEvent);
    });

    expect(document.activeElement).toBe(firstBtn);
  });

  it("cycles backward from first element to last element on Shift+Tab", async () => {
    render(<ModalDialog isOpen={true} />);
    act(() => {
      vi.advanceTimersByTime(60);
    });

    const firstBtn = screen.getByRole("button", { name: "First Action" });
    const lastBtn = screen.getByRole("button", { name: "Close Modal" });

    // Focus first button
    firstBtn.focus();
    expect(document.activeElement).toBe(firstBtn);

    // Dispatch Shift+Tab keydown on document
    act(() => {
      const shiftTabEvent = new KeyboardEvent("keydown", {
        key: "Tab",
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(shiftTabEvent);
    });

    expect(document.activeElement).toBe(lastBtn);
  });

  it("executes custom onKeyDown handler when key is pressed", async () => {
    const handleKeyDown = vi.fn((e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
      }
    });

    function CustomModal({ isOpen }: { isOpen: boolean }) {
      const trapRef = useFocusTrap<HTMLDivElement>(isOpen, {
        onKeyDown: handleKeyDown,
      });

      if (!isOpen) return null;

      return (
        <div ref={trapRef} role="dialog">
          <button id="btn-1">Button 1</button>
        </div>
      );
    }

    render(<CustomModal isOpen={true} />);
    act(() => {
      vi.advanceTimersByTime(60);
    });

    act(() => {
      const arrowEvent = new KeyboardEvent("keydown", {
        key: "ArrowRight",
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(arrowEvent);
    });

    expect(handleKeyDown).toHaveBeenCalledTimes(1);
  });
});
