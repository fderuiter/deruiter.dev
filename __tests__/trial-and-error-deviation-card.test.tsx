// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { DeviationCard } from "@/components/trial-and-error/DeviationCard";
import { CPU_COSTS, type DeviationView } from "@/lib/trial-and-error";

const VIEW: DeviationView = {
  name: "Enrolled Twice",
  flavor: "IRT reconciliation: S-003 screened at a second site.",
  afterHands: 1,
  subjectId: "S-003",
  populations: ["ITT", "SAFETY", "PER_PROTOCOL", "FAS"],
  snapshot: {
    id: "SNAP-P1-v2",
    version: 2,
    capturedAt: "2026-01-16T09:00:00Z",
  },
  staled: ["Table 14.3.1 (Draft A)", "Listing 16.2.8"],
  fresh: true,
};

afterEach(cleanup);

describe("DeviationCard (#1087)", () => {
  it("names the subject, the populations it left and the new snapshot", () => {
    render(<DeviationCard deviation={VIEW} />);
    expect(
      screen.getByRole("heading", {
        name: "Protocol deviation: Enrolled Twice",
      })
    ).toBeTruthy();
    const card = screen.getByTestId("deviation-card");
    expect(card.textContent).toContain(
      "S-003 left ITT, Safety, PP and FAS. The snapshot is now SNAP-P1-v2."
    );
  });

  it("lists the stale outputs and says what to do next", () => {
    render(<DeviationCard deviation={VIEW} />);
    expect(screen.getByTestId("deviation-staled").textContent).toBe(
      "2 outputs went stale: Table 14.3.1 (Draft A), Listing 16.2.8."
    );
    expect(screen.getByTestId("deviation-next").textContent).toBe(
      `Next: recompile a stale output (R, ${CPU_COSTS.RECOMPILE} CPU) or discard it. Fresh draws compile against SNAP-P1-v2.`
    );
  });

  it("says so when nothing in hand went stale", () => {
    render(
      <DeviationCard
        deviation={{ ...VIEW, populations: ["SAFETY"], staled: [] }}
      />
    );
    expect(screen.getByTestId("deviation-card").textContent).toContain(
      "S-003 left Safety."
    );
    expect(screen.getByTestId("deviation-staled").textContent).toBe(
      "No output in hand went stale. Play on."
    );
    expect(screen.queryByTestId("deviation-next")).toBeNull();
  });

  it("uses the singular for one stale output", () => {
    render(
      <DeviationCard deviation={{ ...VIEW, staled: ["Listing 16.2.8"] }} />
    );
    expect(screen.getByTestId("deviation-staled").textContent).toBe(
      "1 output went stale: Listing 16.2.8."
    );
  });
});
