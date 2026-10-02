import React from "react";
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ProofCanvas } from "../components/proof/ProofCanvas";
import {
  scanApplicableRules,
  solveNextDeductionStep,
  THEOREMS,
} from "../lib/proof-utils";

afterEach(() => {
  cleanup();
});

describe("AST Rule Matcher & Solver Engine", () => {
  const mpTheorem = THEOREMS["modus-ponens"];

  it("scans applicable rules for selected premises P and P -> Q", () => {
    // Node A: P, Node B: P -> Q
    const selectedNodeIds = ["A", "B"];
    const matches = scanApplicableRules(
      mpTheorem.nodes,
      selectedNodeIds,
      mpTheorem.targetNodeId
    );

    const mpMatch = matches.find((m) => m.ruleId === "mp");
    expect(mpMatch).toBeDefined();
    expect(mpMatch?.isApplicable).toBe(true);
    expect(mpMatch?.resultFormula).toBe("Q");
    expect(mpMatch?.isRecommended).toBe(true);

    // Other 2-premise rules should be non-applicable
    const mtMatch = matches.find((m) => m.ruleId === "mt");
    expect(mtMatch?.isApplicable).toBe(false);
  });

  it("resets matches to non-applicable when selectedNodeIds is empty", () => {
    const matches = scanApplicableRules(
      mpTheorem.nodes,
      [],
      mpTheorem.targetNodeId
    );
    expect(matches.every((m) => !m.isApplicable)).toBe(true);
  });

  it("correctly identifies non-applicable rules with explanatory reason when inputs don't match", () => {
    // Selecting A (P) and D (Q -> R)
    const matches = scanApplicableRules(
      mpTheorem.nodes,
      ["A", "D"],
      mpTheorem.targetNodeId
    );
    const mpMatch = matches.find((m) => m.ruleId === "mp");
    expect(mpMatch?.isApplicable).toBe(false);
    expect(mpMatch?.explanation).toContain("Modus Ponens");
  });

  it("solves next deduction step using forward chaining without hardcoded theorem edge arrays", () => {
    // Initial state of modus-ponens theorem has edges from A and B to C (intermediate Q)
    const initialEdges = mpTheorem.initialEdges;
    const autoStep = solveNextDeductionStep(
      mpTheorem.nodes,
      initialEdges,
      mpTheorem.targetNodeId
    );

    expect(autoStep.success).toBe(true);
    expect(autoStep.targetNodeId).toBe("E");
    expect(autoStep.sourceNodeIds).toEqual(expect.arrayContaining(["C", "D"]));
    expect(autoStep.newEdges).toHaveLength(2);
    expect(autoStep.newEdges).toEqual([
      { source: "C", target: "E", ruleApplied: "MP" },
      { source: "D", target: "E", ruleApplied: "MP" },
    ]);
  });

  it("returns Q.E.D. when goal is already fully proven", () => {
    const fullEdges = [
      { source: "A", target: "C", ruleApplied: "MP" },
      { source: "B", target: "C", ruleApplied: "MP" },
      { source: "C", target: "E", ruleApplied: "MP" },
      { source: "D", target: "E", ruleApplied: "MP" },
    ];
    const autoStep = solveNextDeductionStep(
      mpTheorem.nodes,
      fullEdges,
      mpTheorem.targetNodeId
    );

    expect(autoStep.success).toBe(false);
    expect(autoStep.message).toContain(
      "Goal already fully discharged (Q.E.D.)!"
    );
  });

  it("renders rule palette buttons with titles prefixed with rule name when ruleMatches are present", () => {
    const selectedNodeIds = ["C", "D"];
    const matches = scanApplicableRules(
      mpTheorem.nodes,
      selectedNodeIds,
      mpTheorem.targetNodeId
    );

    render(
      <ProofCanvas
        activeTheorem={mpTheorem}
        edges={mpTheorem.initialEdges}
        nodeOffsets={{}}
        selectedNodeIds={selectedNodeIds}
        inspectedNodeId=""
        isSnappingEnabled={true}
        activeGuides={[]}
        dragConnection={null}
        isSimulating={false}
        simulationProgress={null}
        toggleSnapping={() => {}}
        handleAutoStep={() => {}}
        handleResetLayout={() => {}}
        activeTacticHint={{ title: "Test", hint: "Hint" }}
        handleNodePointerDown={() => {}}
        handleNodePointerMove={() => {}}
        handleNodePointerUp={() => {}}
        handleNodeClick={() => {}}
        handleHandlePointerDown={() => {}}
        handleCanvasPointerMove={() => {}}
        handleCanvasPointerUp={() => {}}
        handleApplyRule={() => {}}
        handleStartSimulation={() => {}}
        canvasWrapperRef={{ current: null }}
        svgCanvasRef={{ current: null }}
        mobileActiveView="canvas"
        ruleMatches={matches}
      />
    );

    const mpBtn = screen.getByTitle(/^Modus Ponens:/);
    expect(mpBtn).toBeDefined();
    expect(mpBtn.getAttribute("title")).toMatch(/^Modus Ponens:/);
  });
});
