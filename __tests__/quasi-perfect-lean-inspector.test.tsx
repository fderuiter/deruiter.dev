// @vitest-environment jsdom
import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LeanIdeInspector } from "@/components/QuasiPerfectPuzzler/LeanIdeInspector";
import { puzzleLevels } from "@/lib/quasi-perfect/levels";

// Mock global fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("LeanIdeInspector Live Sync Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        status: "verified",
        diagnostics: [],
        goalState: "No remaining goals ✔",
        executionTimeMs: 12,
        engine: "lean4_kernel",
      }),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders LeanIdeInspector with live sync toggle ON by default", async () => {
    const level = puzzleLevels[0];
    render(<LeanIdeInspector level={level} steps={[]} isComplete={false} />);

    expect(screen.getByText(/Live Lean 4 Sync: ON/i)).toBeDefined();
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/quasi-perfect/lean-verify",
        expect.objectContaining({ method: "POST" })
      );
    });
    expect(screen.getByText(/Lean 4 Verified/i)).toBeDefined();
    expect(screen.getByText(/No remaining goals ✔/i)).toBeDefined();
  });

  it("toggles Live Sync OFF when button clicked", async () => {
    const level = puzzleLevels[0];
    render(<LeanIdeInspector level={level} steps={[]} isComplete={false} />);

    const toggleBtn = screen.getByRole("button", { name: /Live Lean 4 Sync/i });
    fireEvent.click(toggleBtn);

    expect(screen.getByText(/Live Lean 4 Sync: OFF/i)).toBeDefined();
  });

  it("displays line diagnostic callout when sorry step is present", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        status: "fallback_simulated",
        diagnostics: [
          {
            line: 4,
            severity: "warning",
            message: "Proof contains sorry axiom",
          },
        ],
        goalState: "Goal admitted via sorry",
        executionTimeMs: 5,
        engine: "fallback_simulator",
      }),
    });

    const level = puzzleLevels[0];
    const steps = [
      {
        id: "s1",
        tacticId: "sorry" as const,
        leanLine: "sorry",
        explanation: "Admitted",
        goalBefore: "x = x",
        goalAfter: "",
      },
    ];

    render(<LeanIdeInspector level={level} steps={steps} isComplete={true} />);

    await waitFor(() => {
      expect(screen.getByText(/Fallback Simulation Active/i)).toBeDefined();
    });
    expect(screen.getByText(/Proof contains sorry axiom/i)).toBeDefined();
  });
});
