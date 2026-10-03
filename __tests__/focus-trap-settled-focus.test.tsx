import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { useRef, useState } from "react";
import {
  render,
  screen,
  act,
  cleanup,
  fireEvent,
} from "@testing-library/react";
import { useFocusTrap } from "@/hooks/useFocusTrap";

/**
 * A dialog whose preferred control changes after a choice, like the Study
 * Director event dialogue: before deciding focus goes to the first choice,
 * afterwards to "Done". Closing it moves focus to the playfield on purpose.
 */
function Steps() {
  const [open, setOpen] = useState(false);
  const [decided, setDecided] = useState(false);
  const playfield = useRef<HTMLDivElement>(null);
  const firstRef = useRef<HTMLButtonElement>(null);
  const doneRef = useRef<HTMLButtonElement>(null);
  const close = () => {
    setOpen(false);
    playfield.current?.focus();
  };
  const ref = useFocusTrap<HTMLDivElement>(open, {
    initialFocusRef: decided ? doneRef : firstRef,
    onEscape: close,
  });
  return (
    <div>
      <div ref={playfield} tabIndex={0} data-testid="playfield" />
      <button onClick={() => setOpen(true)}>Open</button>
      <button>Elsewhere</button>
      {open ? (
        <div ref={ref} role="dialog" aria-label="Call">
          {decided ? (
            <div>
              <button>Write it up</button>
              <button ref={doneRef}>Done</button>
            </div>
          ) : (
            <>
              <button ref={firstRef} onClick={() => setDecided(true)}>
                Choice one
              </button>
              <button>Choice two</button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

describe("useFocusTrap leaves focus that was placed on purpose", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  });
  afterEach(() => {
    cleanup();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("does not pull focus to the initial control once focus is inside", () => {
    render(<Steps />);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    const two = screen.getByRole("button", { name: "Choice two" });
    two.focus();
    advance(100);
    expect(document.activeElement).toBe(two);
  });

  it("moves focus to the new initial control when the old one goes away", () => {
    render(<Steps />);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    advance(100);
    fireEvent.click(screen.getByRole("button", { name: "Choice one" }));
    advance(100);
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Done" })
    );
  });

  it("keeps a control focused right after the dialog's step changes", () => {
    render(<Steps />);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    advance(100);
    fireEvent.click(screen.getByRole("button", { name: "Choice one" }));
    const writeUp = screen.getByRole("button", { name: "Write it up" });
    writeUp.focus();
    advance(100);
    expect(document.activeElement).toBe(writeUp);
    expect(screen.getByRole("dialog")).toBeDefined();
  });

  it("does not take back focus moved elsewhere after the dialog closed", () => {
    render(<Steps />);
    const opener = screen.getByRole("button", { name: "Open" });
    opener.focus();
    fireEvent.click(opener);
    advance(100);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(document.activeElement).toBe(screen.getByTestId("playfield"));
    const elsewhere = screen.getByRole("button", { name: "Elsewhere" });
    elsewhere.focus();
    advance(100);
    expect(document.activeElement).toBe(elsewhere);
  });
});
