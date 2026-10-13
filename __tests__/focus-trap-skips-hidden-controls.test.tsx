import { describe, it, expect, afterEach } from "vitest";
import React from "react";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { useFocusTrap } from "@/hooks/useFocusTrap";

// A touch cabinet keeps its hidden dock mounted (aria-hidden, tabindex -1)
// while a keyboard case is in use. Those buttons are not Tab stops, so the
// trap must wrap from the last real stop instead of letting Tab fall through
// to the page behind the cabinet (#2039 playtest).
function Cabinet() {
  const trapRef = useFocusTrap<HTMLDivElement>(true, { returnFocus: false });
  return (
    <div ref={trapRef}>
      <button>First</button>
      <button>Last real stop</button>
      <div aria-hidden="true">
        <button tabIndex={-1}>Hidden dock key</button>
      </div>
      <button tabIndex={-1}>Taken out of order</button>
      <div inert>
        <button>Inert key</button>
      </div>
    </div>
  );
}

describe("useFocusTrap skips controls that are not Tab stops (#2039)", () => {
  afterEach(cleanup);

  it("wraps Tab from the last real stop to the first", () => {
    render(<Cabinet />);
    screen.getByRole("button", { name: "Last real stop" }).focus();
    fireEvent.keyDown(window, { key: "Tab" });
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "First" })
    );
  });

  it("wraps Shift+Tab from the first stop to the last real stop", () => {
    render(<Cabinet />);
    screen.getByRole("button", { name: "First" }).focus();
    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Last real stop" })
    );
  });
});
