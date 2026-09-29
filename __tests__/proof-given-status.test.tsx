import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ProofWorkspaceClient } from "@/app/proof/ProofWorkspaceClient";
import {
  THEOREMS,
  getDeductionLedger,
  getStepStatusLabel,
} from "@/lib/proof-utils";

beforeEach(() => {
  window.history.replaceState(null, "", "/proof");
  vi.stubGlobal(
    "Worker",
    class {
      postMessage = vi.fn();
      terminate = vi.fn();
      addEventListener = vi.fn();
      removeEventListener = vi.fn();
    }
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Given premises vs pending deductions (#1229)", () => {
  it("labels every premise GIVEN in the ledger, in every theorem", () => {
    for (const th of Object.values(THEOREMS)) {
      const ledger = getDeductionLedger([], th);
      for (const step of ledger) {
        const node = th.nodes.find((n) => n.id === step.nodeId);
        if (node?.type === "premise") {
          expect(getStepStatusLabel(step)).toBe("GIVEN");
        }
      }
    }
  });

  it("keeps derived Q PROVEN and goal R PENDING at load", () => {
    const edges = THEOREMS["modus-ponens"].initialEdges;
    const ledger = getDeductionLedger(edges, "modus-ponens");
    expect(getStepStatusLabel(ledger[2])).toBe("PROVEN");
    expect(getStepStatusLabel(ledger[4])).toBe("PENDING");
  });

  it("states the full two-step argument ending in R", () => {
    const th = THEOREMS["modus-ponens"];
    expect(th.ruleName).toContain("(Q → R) ⊢ R");
    expect(th.goalDescription).toMatch(/Q is already derived/);
  });

  it("shows GIVEN on canvas and ledger, never PENDING for premises", () => {
    render(<ProofWorkspaceClient />);
    const premise = screen.getByRole("button", {
      name: /^Node D, Q → R, premise, given premise/,
    });
    expect(premise.textContent).toContain("GIVEN");
    expect(premise.textContent).not.toContain("PENDING");
    expect(screen.getAllByText("● GIVEN").length).toBe(3);
  });
});
