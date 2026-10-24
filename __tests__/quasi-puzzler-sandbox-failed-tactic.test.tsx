// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SandboxMode } from "@/components/QuasiPerfectPuzzler/SandboxMode";

afterEach(() => {
  cleanup();
});

const card = (label: string) =>
  screen.getByRole("button", { name: new RegExp(`^Tactic ${label}\\.`) });

// #2323: like the campaign (#1232), a failed tactic keeps its card armed so the
// player can retarget it; only a successful tactic clears the selection.
describe("Sandbox failed tactic stays armed (#2323)", () => {
  it("keeps rfl armed after it fails on the binomial goal, then clears after a success", () => {
    render(<SandboxMode />);

    fireEvent.click(card("rfl"));
    expect(card("rfl").getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(
      screen.getByRole("button", { name: /^Goal\. Equality node/ })
    );
    expect(screen.queryByText("Q.E.D. (Proof Complete)")).toBeNull();
    expect(card("rfl").getAttribute("aria-pressed")).toBe("true");

    // Switch the armed card and apply it to the root: a success disarms it.
    fireEvent.click(card("rfl"));
    fireEvent.click(card("ring"));
    expect(card("ring").getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(
      screen.getByRole("button", { name: /^Goal\. Equality node/ })
    );
    expect(screen.getByText("Q.E.D. (Proof Complete)")).toBeDefined();
    expect(card("ring").getAttribute("aria-pressed")).toBe("false");
  });
});
