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
const ramText = () => document.body.textContent ?? "";

/** Level 2 in Hacker Mode with one `symm` step applied (15 of 16 GB left). */
function spendOneGigabyteInHacker() {
  render(<QuasiPerfectPuzzler />);
  click(screen.getByRole("button", { name: /^L2/i }));
  click(screen.getByRole("button", { name: /^Hacker Mode$/i }));
  expect(ramText()).toContain("16.0 / 16 GB");
  const symm = screen
    .getAllByRole("button")
    .find(
      (b) =>
        /symm/i.test(b.textContent ?? "") &&
        !/Apply Tactic/.test(b.textContent ?? "")
    );
  expect(symm).toBeDefined();
  click(symm as HTMLElement);
  const goalRoot = document.querySelector('[data-node-id="eq-lvl2-symm"]');
  expect(goalRoot).not.toBeNull();
  click(goalRoot as HTMLElement);
  expect(ramText()).toContain("15.0 / 16 GB");
}

describe("Quasi-Puzzler mode toggle cannot refill RAM mid-proof (#1231)", () => {
  afterEach(() => cleanup());
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows the active mode's budget rules near the controls", () => {
    render(<QuasiPerfectPuzzler />);
    expect(screen.getByTestId("mode-rules").textContent).toMatch(
      /Story Mode:.*2× RAM/
    );
    click(screen.getByRole("button", { name: /^Hacker Mode$/i }));
    expect(screen.getByTestId("mode-rules").textContent).toMatch(
      /Hacker Mode:.*failed tactics cost RAM/
    );
  });

  it("asks for confirmation instead of refilling RAM mid-proof", () => {
    spendOneGigabyteInHacker();
    click(screen.getByRole("button", { name: /^Story Mode$/i }));
    click(screen.getByRole("button", { name: /^Hacker Mode$/i }));

    // Still Hacker, proof and spent RAM untouched, no confirmation left open
    expect(ramText()).toContain("15.0 / 16 GB");
    expect(ramText()).not.toContain("16.0 / 16 GB");
    click(screen.getByRole("button", { name: /^Story Mode$/i }));
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    expect(ramText()).toContain("15.0 / 16 GB");
  });

  it("cancelling keeps the proof; confirming restarts fresh in the new mode", () => {
    spendOneGigabyteInHacker();
    click(screen.getByRole("button", { name: /^Story Mode$/i }));

    click(screen.getByRole("button", { name: /Keep current proof/i }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(ramText()).toContain("15.0 / 16 GB");

    click(screen.getByRole("button", { name: /^Story Mode$/i }));
    click(screen.getByRole("button", { name: /Restart in Story Mode/i }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(ramText()).toContain("32.0 / 32 GB");
    expect(
      screen.getByRole("button", { name: /Undo Tactic Step/i })
    ).toHaveProperty("disabled", true);
  });

  it("switches modes freely before any RAM is spent", () => {
    render(<QuasiPerfectPuzzler />);
    click(screen.getByRole("button", { name: /^Hacker Mode$/i }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(ramText()).toContain("16.0 / 16 GB");
  });
});
