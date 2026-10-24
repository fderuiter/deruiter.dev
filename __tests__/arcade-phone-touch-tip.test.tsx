// @vitest-environment jsdom
// #2361: TouchTip, the tap-to-reveal replacement for a hover `title=`.
import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from "@testing-library/react";
import axe from "axe-core";
import { TouchTip } from "@/components/arcade/mobile/ui";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function Fixture() {
  return (
    <main>
      <p>
        <span aria-describedby="morale-tip">Morale 80</span>
        <TouchTip label="Morale" id="morale-tip">
          The team works faster above 50.
        </TouchTip>
      </p>
      <button type="button">Elsewhere</button>
    </main>
  );
}

describe("TouchTip (#2361)", () => {
  it("names its button and describes it with the tip, even while closed", () => {
    render(<Fixture />);
    const button = screen.getByRole("button", { name: "About Morale" });
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(button.getAttribute("aria-describedby")).toBe("morale-tip");
    expect(document.getElementById("morale-tip")?.textContent).toBe(
      "The team works faster above 50."
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens on tap with a close control and focus inside, and closes back to the button", async () => {
    render(<Fixture />);
    const button = screen.getByRole("button", { name: "About Morale" });
    fireEvent.click(button);
    const tip = screen.getByRole("dialog", { name: "Morale" });
    expect(tip.textContent).toContain("The team works faster above 50.");
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(button.getAttribute("aria-controls")).toBe(tip.id);
    const close = screen.getByRole("button", { name: "Close Morale tip" });
    await waitFor(() => expect(document.activeElement).toBe(close));

    fireEvent.click(close);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it("closes on Escape without letting the press reach the cabinet", async () => {
    const cabinetHeard = vi.fn();
    window.addEventListener("keydown", cabinetHeard);
    render(<Fixture />);
    const button = screen.getByRole("button", { name: "About Morale" });
    fireEvent.click(button);
    const close = screen.getByRole("button", { name: "Close Morale tip" });
    await waitFor(() => expect(document.activeElement).toBe(close));
    fireEvent.keyDown(close, { key: "Escape" });
    window.removeEventListener("keydown", cabinetHeard);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(button);
    expect(cabinetHeard).not.toHaveBeenCalled();
  });

  it("closes on a tap outside it", () => {
    render(<Fixture />);
    fireEvent.click(screen.getByRole("button", { name: "About Morale" }));
    fireEvent.pointerDown(screen.getByRole("button", { name: "Elsewhere" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("is valid inside a paragraph", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<Fixture />);
    fireEvent.click(screen.getByRole("button", { name: "About Morale" }));
    expect(error).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog").closest("p")).not.toBeNull();
  });

  it("has zero axe violations, closed and open", async () => {
    const { container } = render(<Fixture />);
    const options = {
      runOnly: {
        type: "tag" as const,
        values: ["wcag2a", "wcag2aa", "wcag21aa"],
      },
    };
    expect((await axe.run(container, options)).violations).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "About Morale" }));
    expect((await axe.run(container, options)).violations).toEqual([]);
  });
});
