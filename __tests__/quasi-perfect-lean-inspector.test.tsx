// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LeanIdeInspector } from "@/components/QuasiPerfectPuzzler/LeanIdeInspector";
import { simulateLeanCheck } from "@/components/QuasiPerfectPuzzler/leanSimulation";
import { puzzleLevels } from "@/lib/quasi-perfect/levels";

// The inspector checks the script in the browser; any request is a regression
// to the removed server route (#2987).
const mockFetch = vi.fn();
global.fetch = mockFetch;

const sorryStep = {
  id: "s1",
  tacticId: "sorry" as const,
  leanLine: "sorry",
  explanation: "Admitted",
  goalBefore: "x = x",
  goalAfter: "",
};

describe("LeanIdeInspector simulated check", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders with live sync ON and labels the check as a simulation", () => {
    render(
      <LeanIdeInspector level={puzzleLevels[0]} steps={[]} isComplete={false} />
    );

    expect(screen.getByText(/Live Lean 4 Sync: ON/i)).toBeDefined();
    expect(screen.getByText(/Fallback Simulation Active/i)).toBeDefined();
    expect(screen.getByText(/Simulated Lean check/i)).toBeDefined();
    expect(screen.getByText(/Engine: fallback_simulator/i)).toBeDefined();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("toggles Live Sync OFF when button clicked", () => {
    render(
      <LeanIdeInspector level={puzzleLevels[0]} steps={[]} isComplete={false} />
    );

    fireEvent.click(screen.getByRole("button", { name: /Live Lean 4 Sync/i }));

    expect(screen.getByText(/Live Lean 4 Sync: OFF/i)).toBeDefined();
    expect(screen.getByText(/Local Uncompiled/i)).toBeDefined();
  });

  it("displays a line diagnostic when a sorry step is present", () => {
    render(
      <LeanIdeInspector
        level={puzzleLevels[0]}
        steps={[sorryStep]}
        isComplete={true}
      />
    );

    expect(screen.getAllByText(/Proof contains 'sorry' axiom/i).length).toBe(1);
    expect(
      screen.getByText(/Goal admitted via sorry \(simulated fallback\)/i)
    ).toBeDefined();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("shows a fresh level as open, not admitted via sorry (#2043)", () => {
    render(
      <LeanIdeInspector level={puzzleLevels[0]} steps={[]} isComplete={false} />
    );

    expect(screen.getAllByText(/Goal open/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/admitted/i)).toBeNull();
  });
});

describe("simulateLeanCheck", () => {
  it("flags each sorry line as a warning", () => {
    const result = simulateLeanCheck("theorem t : 1 = 1 := by\n  sorry");
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ line: 2, column: 1, severity: "warning" }),
    ]);
    expect(result.goalState).toMatch(/admitted via sorry/);
  });

  it("reports an open goal from the generator's marker", () => {
    const result = simulateLeanCheck(
      "theorem t : 1 = 1 := by\n  -- Goal open: apply a tactic to continue"
    );
    expect(result.diagnostics).toEqual([]);
    expect(result.goalState).toMatch(/^Goal open/);
  });

  it("reports closed goals when nothing is admitted or open", () => {
    const result = simulateLeanCheck("theorem t : 1 = 1 := by\n  rfl");
    expect(result).toMatchObject({
      success: true,
      status: "fallback_simulated",
      engine: "fallback_simulator",
      goalState: "Goals closed via local simulation ✔",
    });
  });
});
