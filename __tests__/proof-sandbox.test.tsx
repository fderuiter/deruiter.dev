import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { ProofWorkspaceClient } from "@/app/proof/ProofWorkspaceClient";
import {
  buildSandboxNode,
  createSandboxTheorem,
  encodeSandboxHash,
  serializeProofWorkspaceJson,
} from "@/lib/proof-custom";

beforeEach(() => {
  window.history.replaceState(null, "", "/proof");
  vi.stubGlobal(
    "Worker",
    class {
      postMessage = vi.fn();
      terminate = vi.fn();
      onmessage = null;
    }
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function addSandboxFormula(formula: string, role: "Premise" | "Goal") {
  const input = screen.getByLabelText("Sandbox formula");
  fireEvent.change(input, { target: { value: formula } });
  fireEvent.click(
    screen.getByRole("button", { name: new RegExp(`^Add ${role}$`, "i") })
  );
}

describe("ProofWorkspaceClient: Open Sandbox Mode & Portable State", () => {
  it("authors premises and goals, spawns intermediate nodes via unary and binary tactics, and supports atomic undo/redo and cascade deletion", () => {
    render(<ProofWorkspaceClient />);

    // Enter Sandbox Mode
    fireEvent.click(screen.getByRole("button", { name: /^Sandbox Mode$/ }));
    expect(
      screen
        .getByRole("button", { name: /^Sandbox Mode$/ })
        .getAttribute("aria-pressed")
    ).toBe("true");

    // Author P & R, P -> Q, Q -> S, and Goal S
    addSandboxFormula("P & R", "Premise");
    addSandboxFormula("P -> Q", "Premise");
    addSandboxFormula("Q -> S", "Premise");
    addSandboxFormula("S", "Goal");

    expect(
      screen.getByRole("button", { name: /^Node P1, GIVEN, P ∧ R,/ })
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /^Node G1, PENDING, S,/ })
    ).toBeTruthy();

    // Select P1 (P ∧ R) and apply unary ∧-Elim to spawn intermediate node S1 (P)
    fireEvent.click(
      screen.getByRole("button", { name: /^Node P1, GIVEN, P ∧ R,/ })
    );
    fireEvent.click(
      screen.getByRole("button", { name: /^Conjunction Elimination ∧-Elim/i })
    );

    expect(
      screen.getByRole("button", { name: /^Node S1, PROVEN, P,/ })
    ).toBeTruthy();

    // Select S1 (P) and P2 (P → Q) and apply binary Modus Ponens to spawn S2 (Q)
    fireEvent.click(
      screen.getByRole("button", { name: /^Node S1, PROVEN, P,/ })
    );
    fireEvent.click(
      screen.getByRole("button", { name: /^Node P2, GIVEN, P → Q,/ })
    );
    fireEvent.click(screen.getByRole("button", { name: /^Modus Ponens MP/i }));

    expect(
      screen.getByRole("button", { name: /^Node S2, PROVEN, Q,/ })
    ).toBeTruthy();

    // Select S2 (Q) and P3 (Q → S) and apply Modus Ponens to discharge Goal G1 (S)
    fireEvent.click(
      screen.getByRole("button", { name: /^Node S2, PROVEN, Q,/ })
    );
    fireEvent.click(
      screen.getByRole("button", { name: /^Node P3, GIVEN, Q → S,/ })
    );
    fireEvent.click(screen.getByRole("button", { name: /^Modus Ponens MP/i }));

    expect(
      screen.getByRole("button", { name: /^Node G1, PROVEN, S,/ })
    ).toBeTruthy();
    expect(screen.getByText(/GRAPH COMPLETE/i)).toBeTruthy();

    // Undo twice removes goal discharge and un-spawns S2 atomically
    const undoBtn = screen.getByRole("button", { name: "Undo proof step" });
    fireEvent.click(undoBtn);
    expect(
      screen.getByRole("button", { name: /^Node G1, PENDING, S,/ })
    ).toBeTruthy();
    fireEvent.click(undoBtn);
    expect(
      screen.queryByRole("button", { name: /^Node S2, PROVEN, Q,/ })
    ).toBeNull();

    // Redo twice restores S2 and re-discharges G1
    const redoBtn = screen.getByRole("button", { name: "Redo proof step" });
    fireEvent.click(redoBtn);
    fireEvent.click(redoBtn);
    expect(
      screen.getByRole("button", { name: /^Node S2, PROVEN, Q,/ })
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /^Node G1, PROVEN, S,/ })
    ).toBeTruthy();

    // Edit Node G1 inline to check inline editing, then undo back to S
    fireEvent.click(screen.getByRole("button", { name: "Edit Node G1" }));
    const editInput = screen.getByLabelText("Edit formula for Node G1");
    fireEvent.change(editInput, { target: { value: "R" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Node G1" }));
    expect(
      screen.getByRole("button", { name: /^Node G1, PENDING, R,/ })
    ).toBeTruthy();
    fireEvent.click(undoBtn);
    expect(
      screen.getByRole("button", { name: /^Node G1, PROVEN, S,/ })
    ).toBeTruthy();

    // Delete upstream Node S1 -> cascade-deletes S1 and dependent S2 and reverts G1 to PENDING
    fireEvent.click(screen.getByRole("button", { name: "Delete Node S1" }));
    expect(screen.queryByRole("button", { name: /^Node S1,/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Node S2,/ })).toBeNull();
    expect(
      screen.getByRole("button", { name: /^Node G1, PENDING, S,/ })
    ).toBeTruthy();
  });

  it("runs Check Countermodel across active premises and opens the Fallacy truth table with multi-premise columns", () => {
    render(<ProofWorkspaceClient />);
    fireEvent.click(screen.getByRole("button", { name: /^Sandbox Mode$/ }));

    // Add 3 premises that do NOT entail Goal R: P -> Q, Q, S ⊬ P
    addSandboxFormula("P -> Q", "Premise");
    addSandboxFormula("Q", "Premise");
    addSandboxFormula("S", "Premise");
    addSandboxFormula("P", "Goal");

    fireEvent.click(
      screen.getByRole("button", { name: /Check Countermodel/i })
    );

    // Fallacy tab opens with COUNTERMODEL badge and Premise 1..3 columns
    expect(screen.getAllByText("COUNTERMODEL").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Countermodel Found (Unentailed Goal)").length
    ).toBeGreaterThan(0);
    expect(
      screen.getByRole("columnheader", { name: "Premise 1" })
    ).toBeTruthy();
    expect(
      screen.getByRole("columnheader", { name: "Premise 2" })
    ).toBeTruthy();
    expect(
      screen.getByRole("columnheader", { name: "Premise 3" })
    ).toBeTruthy();
  });

  it("hydrates both guided proof edges and compact sandbox graphs from URL hashes on page load", () => {
    // 1. Guided proof edges restored from #edges=...
    window.history.replaceState(
      null,
      "",
      "/proof#edges=A%3EC,B%3EC,C%3EE,D%3EE"
    );
    const { unmount } = render(<ProofWorkspaceClient />);
    expect(
      screen.getByRole("button", { name: /^Node E, PROVEN, R,/ })
    ).toBeTruthy();
    unmount();

    // 2. Sandbox graph restored from #mode=sandbox&sandbox=...
    const sbNodes = [
      buildSandboxNode({
        id: "P1",
        label: "A",
        type: "premise",
        x: 100,
        y: 100,
      }),
      buildSandboxNode({
        id: "P2",
        label: "A -> B",
        type: "premise",
        x: 100,
        y: 220,
      }),
      buildSandboxNode({
        id: "G1",
        label: "B",
        type: "conclusion",
        x: 500,
        y: 160,
      }),
    ];
    const sbEdges = [
      { source: "P1", target: "G1", ruleApplied: "MP" },
      { source: "P2", target: "G1", ruleApplied: "MP" },
    ];
    const encoded = encodeSandboxHash(sbNodes, sbEdges);
    window.history.replaceState(
      null,
      "",
      `/proof#mode=sandbox&sandbox=${encodeURIComponent(encoded)}`
    );

    render(<ProofWorkspaceClient />);
    expect(
      screen.getByRole("button", { name: /^Node G1, PROVEN, B,/ })
    ).toBeTruthy();
  });

  it("exports .proof.json, imports .proof.json files in the Export modal, and prompts .proof.json download when Share exceeds 2048 chars", async () => {
    // Build a >2048-char sandbox workspace and import it via file upload
    const largeNodes = Array.from({ length: 34 }, (_, idx) =>
      buildSandboxNode({
        id: idx === 33 ? "G1" : `P${idx + 1}`,
        label:
          idx === 33
            ? "GoalAtom_0"
            : `(SignalAlpha_${idx} & SignalBeta_${idx}) -> (SignalGamma_${idx} | GoalAtom_0)`,
        type: idx === 33 ? "conclusion" : "premise",
        x: 80 + (idx % 5) * 90,
        y: 60 + Math.floor(idx / 5) * 50,
      })
    );
    const largeTh = createSandboxTheorem(largeNodes, []);
    const jsonPayload = serializeProofWorkspaceJson(largeTh, []);

    render(<ProofWorkspaceClient />);
    fireEvent.click(screen.getByRole("button", { name: /^Export$/i }));

    const dialog = screen.getByRole("dialog", {
      name: "Export Workspace State",
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "proof.json" }));
    expect(
      within(dialog).getByRole("region", { name: "Proof export" }).textContent
    ).toContain('"version": 1');

    const fileInput = dialog.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    const file = new File([jsonPayload], "large.proof.json", {
      type: "application/json",
    });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Export Workspace State" })
      ).toBeNull()
    );
    expect(
      screen.getByRole("button", { name: /^Node G1, PENDING, GoalAtom_0,/ })
    ).toBeTruthy();

    // Clicking Share on the >2048-char graph opens the Export modal on proof.json with the limit notice
    fireEvent.click(screen.getByRole("button", { name: /^Share$/i }));
    const limitDialog = await screen.findByRole("dialog", {
      name: "Export Workspace State",
    });
    expect(
      within(limitDialog).getByText(/exceeds the 2,048-character URL limit/i)
    ).toBeTruthy();
  });
});
