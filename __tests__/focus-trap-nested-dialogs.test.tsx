import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { useState } from "react";
import {
  render,
  screen,
  act,
  cleanup,
  fireEvent,
} from "@testing-library/react";
import { useFocusTrap } from "@/hooks/useFocusTrap";

function Dialog({
  label,
  onClose,
  children,
  returnFocusTo,
}: {
  label: string;
  onClose: () => void;
  children?: React.ReactNode;
  returnFocusTo?: React.RefObject<HTMLElement | null>;
}) {
  const ref = useFocusTrap<HTMLDivElement>(true, {
    onEscape: onClose,
    returnFocusTo,
  });
  return (
    <div ref={ref} role="dialog" aria-label={label} tabIndex={-1}>
      <button onClick={onClose}>{`Close ${label}`}</button>
      {children}
    </div>
  );
}

/** Dialog A hands off to dialog B and unmounts itself in the same handler. */
function HandOff({
  returnFocusTo,
}: {
  returnFocusTo?: React.RefObject<HTMLElement | null>;
}) {
  const [a, setA] = useState(false);
  const [b, setB] = useState(false);
  return (
    <div>
      <button onClick={() => setA(true)}>Run Info</button>
      {a && (
        <Dialog label="A" onClose={() => setA(false)}>
          <button
            onClick={() => {
              setA(false);
              setB(true);
            }}
          >
            New run
          </button>
        </Dialog>
      )}
      {b && (
        <Dialog
          label="B"
          onClose={() => setB(false)}
          returnFocusTo={returnFocusTo}
        />
      )}
    </div>
  );
}

/** Dialog B opens on top of A while A stays mounted. */
function Stacked() {
  const [b, setB] = useState(false);
  return (
    <Dialog label="A" onClose={() => undefined}>
      <button onClick={() => setB(true)}>Open B</button>
      <button>Last in A</button>
      {b && <Dialog label="B" onClose={() => setB(false)} />}
    </Dialog>
  );
}

const flush = () =>
  act(() => {
    vi.advanceTimersByTime(100);
  });

describe("useFocusTrap nested dialog focus restoration (#1614)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  });
  afterEach(() => {
    cleanup();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("returns focus to the original trigger when a handed-off dialog closes", () => {
    render(<HandOff />);
    const trigger = screen.getByRole("button", { name: "Run Info" });
    trigger.focus();
    fireEvent.click(trigger);
    flush();
    fireEvent.click(screen.getByRole("button", { name: "New run" }));
    flush();
    expect(screen.getByRole("dialog", { name: "B" })).toBeDefined();

    fireEvent.keyDown(window, { key: "Escape" });
    flush();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("falls back to returnFocusTo when the recorded element is gone", () => {
    const fallback = document.createElement("button");
    document.body.appendChild(fallback);
    render(<HandOff returnFocusTo={{ current: fallback }} />);
    const trigger = screen.getByRole("button", { name: "Run Info" });
    trigger.focus();
    fireEvent.click(trigger);
    flush();
    // Replace the handoff by removing the trigger before B closes.
    fireEvent.click(screen.getByRole("button", { name: "New run" }));
    flush();
    trigger.remove();
    fireEvent.keyDown(window, { key: "Escape" });
    flush();
    expect(document.activeElement).toBe(fallback);
  });

  it("keeps the outer trap intact after a stacked dialog closes", () => {
    render(<Stacked />);
    flush();
    const openB = screen.getByRole("button", { name: "Open B" });
    openB.focus();
    fireEvent.click(openB);
    flush();
    fireEvent.click(screen.getByRole("button", { name: "Close B" }));
    flush();
    expect(document.activeElement).toBe(openB);

    const last = screen.getByRole("button", { name: "Last in A" });
    last.focus();
    fireEvent.keyDown(window, { key: "Tab" });
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Close A" })
    );
  });
});
