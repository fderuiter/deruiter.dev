// @vitest-environment jsdom
import React from "react";
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { QuasiPerfectPuzzler } from "@/components/QuasiPerfectPuzzler/QuasiPerfectPuzzler";

vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({
    playNote: vi.fn(),
    playHover: vi.fn(),
    playSubmit: vi.fn(),
    playSuccess: vi.fn(),
  }),
}));

vi.mock("@/hooks/useAnnouncer", () => ({
  useAnnouncer: () => ({ announce: vi.fn() }),
}));

const click = (el: HTMLElement) => act(() => void fireEvent.click(el));

describe("Quasi-Puzzler puts the active task within reach on mobile (#1236)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders the current level before the level index in document order", () => {
    render(<QuasiPerfectPuzzler />);
    const heading = document.getElementById("quasi-current-level-heading");
    const index = screen.getByTestId("quasi-level-index");
    expect(heading).not.toBeNull();
    expect(
      (heading as HTMLElement).compareDocumentPosition(index) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("collapses the index behind a disclosure that names the current level", () => {
    render(<QuasiPerfectPuzzler />);
    const toggle = screen.getByRole("button", { name: /Browse levels/i });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.getAttribute("aria-controls")).toBe("quasi-level-index");
    expect(toggle.textContent).toMatch(/Level 1 of 18/);
    const index = screen.getByTestId("quasi-level-index");
    expect(index.className).toContain("hidden");
    expect(index.className).toContain("md:block");

    click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(index.className).not.toMatch(/(^|\s)hidden(\s|$)/);
  });

  it("keeps every level reachable and returns focus to the chosen task", () => {
    render(<QuasiPerfectPuzzler />);
    const index = screen.getByTestId("quasi-level-index");
    expect(
      index.querySelectorAll('button[type="button"]').length
    ).toBeGreaterThanOrEqual(18);

    click(screen.getByRole("button", { name: /Browse levels/i }));
    click(screen.getByRole("button", { name: /^L5/i }));

    const heading = document.getElementById("quasi-current-level-heading");
    expect(document.activeElement).toBe(heading);
    expect(heading?.textContent).toMatch(/Memory Economics/);
    expect(
      screen
        .getByRole("button", { name: /Browse levels/i })
        .getAttribute("aria-expanded")
    ).toBe("false");
    expect(screen.getByTestId("quasi-level-index").className).toContain(
      "hidden"
    );
  });
});
