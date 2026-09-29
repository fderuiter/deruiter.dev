// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QuasiPerfectPuzzler } from "@/components/QuasiPerfectPuzzler/QuasiPerfectPuzzler";
import { puzzleLevels } from "@/lib/quasi-perfect";

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

// #1324: the screen-reader "Apply Tactic" buttons only selected a tactic, so
// a screen-reader user could never apply one; and Level 1 said a click on
// the rfl card discharges the goal, when the goal also needs a click.

describe("Quasi-Perfect screen-reader tactic buttons (#1324)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("applies the tactic to the goal, solving level 1 with rfl", () => {
    render(<QuasiPerfectPuzzler />);
    expect(screen.queryByText(/Steps Applied: 1/)).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: /Apply Tactic: .*rfl.* to the goal/i })
    );

    expect(screen.getByText(/Steps Applied: 1/)).toBeTruthy();
  });

  it("tells level 1 players to select the card and then click the goal", () => {
    const objective = puzzleLevels[0].educationalConcept?.tacticalObjective;
    expect(objective).toMatch(/Select the 'rfl' tactic card, then click/);
  });
});
