// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { InteractiveTruthTable } from "@/components/proof/InteractiveTruthTable";
import { getFallacyDiagnosis } from "@/lib/proof";

describe("InteractiveTruthTable Component", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders fallacy diagnostic title, formula, analogy, and initialized counterexample state", () => {
    const diagnosis = getFallacyDiagnosis("C", "A", []);
    render(<InteractiveTruthTable diagnosis={diagnosis} />);

    expect(
      screen.getByText("Fallacy of Affirming the Consequent")
    ).toBeDefined();
    expect(screen.getByText("((P → Q) ∧ Q) ⊬ P")).toBeDefined();
    expect(screen.getByText("Software Bug Analogy")).toBeDefined();

    // Contradiction banner should be visible because it auto-initializes to counterexample P=F, Q=T
    expect(
      screen.getByText(/Formal Contradiction: Premises Hold \(True\) but Conclusion Fails \(False\)!/)
    ).toBeDefined();
  });

  it("toggles propositional variables and updates AST sub-expression traces", () => {
    const diagnosis = getFallacyDiagnosis("C", "A", []);
    render(<InteractiveTruthTable diagnosis={diagnosis} />);

    const switchP = screen.getByRole("switch", { name: /Toggle variable P/i });
    expect(switchP.getAttribute("aria-checked")).toBe("false");

    // Toggle P to TRUE
    fireEvent.click(switchP);
    expect(switchP.getAttribute("aria-checked")).toBe("true");

    // Both P and Q are now TRUE, so premises and conclusion are satisfied
    expect(
      screen.getByText(/Consistent State: Premises & Conclusion are simultaneously satisfied/)
    ).toBeDefined();
  });

  it("handles 'All T' and 'All F' quick actions", () => {
    const diagnosis = getFallacyDiagnosis("C", "A", []);
    render(<InteractiveTruthTable diagnosis={diagnosis} />);

    const switchP = screen.getByRole("switch", { name: /Toggle variable P/i });
    const switchQ = screen.getByRole("switch", { name: /Toggle variable Q/i });

    const allTBtn = screen.getByRole("button", { name: /All T/i });
    const allFBtn = screen.getByRole("button", { name: /All F/i });

    // Set all to false
    fireEvent.click(allFBtn);
    expect(switchP.getAttribute("aria-checked")).toBe("false");
    expect(switchQ.getAttribute("aria-checked")).toBe("false");

    // Set all to true
    fireEvent.click(allTBtn);
    expect(switchP.getAttribute("aria-checked")).toBe("true");
    expect(switchQ.getAttribute("aria-checked")).toBe("true");
  });

  it("restores counterexample state via Counterexample button", () => {
    const diagnosis = getFallacyDiagnosis("C", "A", []);
    render(<InteractiveTruthTable diagnosis={diagnosis} />);

    const allTBtn = screen.getByRole("button", { name: /All T/i });
    const ceBtn = screen.getByRole("button", { name: /Counterexample/i });
    const switchP = screen.getByRole("switch", { name: /Toggle variable P/i });
    const switchQ = screen.getByRole("switch", { name: /Toggle variable Q/i });

    fireEvent.click(allTBtn);
    expect(switchP.getAttribute("aria-checked")).toBe("true");

    fireEvent.click(ceBtn);
    expect(switchP.getAttribute("aria-checked")).toBe("false");
    expect(switchQ.getAttribute("aria-checked")).toBe("true");
    expect(
      screen.getByText(/Formal Contradiction: Premises Hold \(True\) but Conclusion Fails \(False\)!/)
    ).toBeDefined();
  });

  it("synchronizes valuation when clicking or keyboard-selecting table rows", () => {
    const diagnosis = getFallacyDiagnosis("C", "A", []);
    render(<InteractiveTruthTable diagnosis={diagnosis} />);

    const switchP = screen.getByRole("switch", { name: /Toggle variable P/i });
    const switchQ = screen.getByRole("switch", { name: /Toggle variable Q/i });

    // Table rows have role="button"
    const rows = screen.getAllByRole("button", { name: /Row \d/i });
    expect(rows.length).toBe(4);

    // Click Row 1 (which corresponds to P=T, Q=T)
    fireEvent.click(rows[0]);
    expect(switchP.getAttribute("aria-checked")).toBe("true");
    expect(switchQ.getAttribute("aria-checked")).toBe("true");

    // Keyboard select Row 2 (P=T, Q=F) using Enter key
    fireEvent.keyDown(rows[1], { key: "Enter" });
    expect(switchP.getAttribute("aria-checked")).toBe("true");
    expect(switchQ.getAttribute("aria-checked")).toBe("false");
  });

  it("renders circular reasoning diagnosis and handles custom theorem fallacies", () => {
    const diagnosis = getFallacyDiagnosis("C", "C", []);
    render(<InteractiveTruthTable diagnosis={diagnosis} />);

    expect(
      screen.getByText("Fallacy of Circular Reasoning (Petitio Principii)")
    ).toBeDefined();
    expect(screen.getByText("P ⊢ P (Tautological Self-Reference)")).toBeDefined();
  });
});
