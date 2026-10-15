import { describe, it, expect, afterEach } from "vitest";
import React from "react";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { useFocusTrap } from "@/hooks/useFocusTrap";

// A radio group is a single Tab stop: the checked radio, or the first one
// when none is checked. The Study Director intro opens on a length picker
// whose checked radio is not the first, and Shift+Tab from it used to leave
// the dialog because the trap took the first radio in DOM order as its first
// stop (#2194).
function Picker({ checked }: { checked: "short" | "full" | null }) {
  const trapRef = useFocusTrap<HTMLDivElement>(true, { returnFocus: false });
  return (
    <div ref={trapRef}>
      <fieldset>
        <legend>Length</legend>
        <label>
          <input
            type="radio"
            name="length"
            value="short"
            checked={checked === "short"}
            readOnly
          />
          Short study
        </label>
        <label>
          <input
            type="radio"
            name="length"
            value="full"
            checked={checked === "full"}
            readOnly
          />
          Full study
        </label>
      </fieldset>
      <fieldset>
        <legend>Difficulty</legend>
        <label>
          <input type="radio" name="difficulty" value="calm" readOnly />
          Calm
        </label>
        <label>
          <input
            type="radio"
            name="difficulty"
            value="standard"
            defaultChecked
          />
          Standard
        </label>
      </fieldset>
      <button>Start the day</button>
    </div>
  );
}

const radio = (name: string) => screen.getByRole("radio", { name });
const start = () => screen.getByRole("button", { name: "Start the day" });

describe("useFocusTrap treats a radio group as one Tab stop (#2194)", () => {
  afterEach(cleanup);

  it("wraps Shift+Tab from the checked radio that is the first stop to the last element", () => {
    render(<Picker checked="full" />);
    radio("Full study").focus();
    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(start());
  });

  it("wraps Tab from the last element to the checked radio, not the first in the group", () => {
    render(<Picker checked="full" />);
    start().focus();
    fireEvent.keyDown(window, { key: "Tab" });
    expect(document.activeElement).toBe(radio("Full study"));
  });

  it("uses the first radio as the stop when none in the group is checked", () => {
    render(<Picker checked={null} />);
    start().focus();
    fireEvent.keyDown(window, { key: "Tab" });
    expect(document.activeElement).toBe(radio("Short study"));
    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(start());
  });

  it("leaves Tab inside the dialog to the browser", () => {
    render(<Picker checked="full" />);
    radio("Full study").focus();
    const event = new KeyboardEvent("keydown", {
      key: "Tab",
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(radio("Full study"));
  });
});
