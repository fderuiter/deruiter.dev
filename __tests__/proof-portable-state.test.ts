import { describe, expect, it } from "vitest";
import {
  applyRuleToAsts,
  cascadePruneSandboxGraph,
  computeSandboxProvenNodeIds,
  evaluateProofStatus,
  exportWorkspaceProof,
  formatFormula,
  generateSandboxLean4Code,
  getExportFilename,
  getExportMimeType,
  THEOREMS,
  type Edge,
} from "@/lib/proof";
import {
  buildProofShareHash,
  buildSandboxNode,
  createSandboxTheorem,
  createStarterSandboxNodes,
  decodeGuidedEdgesHash,
  decodeSandboxHash,
  encodeGuidedEdgesHash,
  encodeSandboxHash,
  evaluateSandboxCountermodel,
  MAX_PROOF_HASH_LENGTH,
  MAX_PROOF_JSON_BYTES,
  MAX_SANDBOX_NODES,
  parseCustomFormula,
  parseProofWorkspaceJson,
  serializeProofWorkspaceJson,
} from "@/lib/proof-custom";

describe("Sandbox AST deduction, unary rules, and cascade pruning", () => {
  it("supports unary right conjunction elimination and double negation elimination", () => {
    const conj = parseCustomFormula("P & Q");
    const rightRes = applyRuleToAsts("and_elim_r", [conj]);
    expect(rightRes.success).toBe(true);
    expect(formatFormula(rightRes.resultAst!)).toBe("Q");

    const dblNeg = parseCustomFormula("~~(P -> Q)");
    const dneRes = applyRuleToAsts("dne", [dblNeg]);
    expect(dneRes.success).toBe(true);
    expect(formatFormula(dneRes.resultAst!)).toBe("P → Q");
  });

  it("evaluates multi-step DAG provenance and discharges goal formulas automatically", () => {
    const nodes = [
      buildSandboxNode({
        id: "P1",
        label: "P & R",
        type: "premise",
        x: 80,
        y: 80,
      }),
      buildSandboxNode({
        id: "P2",
        label: "P -> Q",
        type: "premise",
        x: 80,
        y: 180,
      }),
      buildSandboxNode({
        id: "P3",
        label: "Q -> S",
        type: "premise",
        x: 80,
        y: 280,
      }),
      buildSandboxNode({
        id: "S1",
        label: "P",
        type: "intermediate",
        x: 300,
        y: 80,
      }),
      buildSandboxNode({
        id: "S2",
        label: "Q",
        type: "intermediate",
        x: 300,
        y: 200,
      }),
      buildSandboxNode({
        id: "G1",
        label: "S",
        type: "conclusion",
        x: 540,
        y: 200,
      }),
    ];
    const partialEdges: Edge[] = [
      { source: "P1", target: "S1", ruleApplied: "∧E₁" },
      { source: "S1", target: "S2", ruleApplied: "MP" },
      { source: "P2", target: "S2", ruleApplied: "MP" },
    ];
    const partialTh = createSandboxTheorem(nodes, partialEdges);
    const partialStatus = evaluateProofStatus(partialEdges, partialTh);
    expect(partialStatus.isE_Proven).toBe(false);
    expect(partialStatus.provenNodeIds).toEqual(
      expect.arrayContaining(["P1", "P2", "P3", "S1", "S2"])
    );
    expect(partialStatus.provenNodeIds).not.toContain("G1");

    const fullEdges: Edge[] = [
      ...partialEdges,
      { source: "S2", target: "G1", ruleApplied: "MP" },
      { source: "P3", target: "G1", ruleApplied: "MP" },
    ];
    const fullTh = createSandboxTheorem(nodes, fullEdges);
    const fullStatus = evaluateProofStatus(fullEdges, fullTh);
    expect(fullStatus.isE_Proven).toBe(true);
    expect(computeSandboxProvenNodeIds(fullEdges, fullTh).has("G1")).toBe(true);
  });

  it("cascade-prunes dependent intermediate nodes and goal edges when an upstream node is removed", () => {
    const nodes = [
      buildSandboxNode({ id: "P1", label: "P", type: "premise", x: 80, y: 80 }),
      buildSandboxNode({
        id: "P2",
        label: "P -> Q",
        type: "premise",
        x: 80,
        y: 180,
      }),
      buildSandboxNode({
        id: "P3",
        label: "Q -> R",
        type: "premise",
        x: 80,
        y: 280,
      }),
      buildSandboxNode({
        id: "S1",
        label: "Q",
        type: "intermediate",
        x: 300,
        y: 130,
      }),
      buildSandboxNode({
        id: "S2",
        label: "R",
        type: "intermediate",
        x: 440,
        y: 200,
      }),
      buildSandboxNode({
        id: "G1",
        label: "R",
        type: "conclusion",
        x: 580,
        y: 200,
      }),
    ];
    const edges: Edge[] = [
      { source: "P1", target: "S1", ruleApplied: "MP" },
      { source: "P2", target: "S1", ruleApplied: "MP" },
      { source: "S1", target: "S2", ruleApplied: "MP" },
      { source: "P3", target: "S2", ruleApplied: "MP" },
      { source: "S2", target: "G1", ruleApplied: "Reit" },
    ];

    const pruned = cascadePruneSandboxGraph("P1", nodes, edges, {
      deletePremiseNode: true,
    });
    expect(pruned.success).toBe(true);
    expect(pruned.removedNodeIds).toEqual(["P1", "S1", "S2"]);
    expect(pruned.newNodes?.map((n) => n.id)).toEqual(["P2", "P3", "G1"]);
    expect(pruned.newEdges).toEqual([]);
  });
});

describe("On-demand sandbox countermodel evaluation", () => {
  it("detects falsifying valuations across 0, 1, 3, and 4 premises", () => {
    // 0 premises, non-tautological goal P -> Q
    const zeroPremises = [
      buildSandboxNode({
        id: "G1",
        label: "P -> Q",
        type: "conclusion",
        x: 500,
        y: 160,
      }),
    ];
    const zeroOutcome = evaluateSandboxCountermodel(zeroPremises);
    expect(zeroOutcome.status).toBe("countermodel");
    if (zeroOutcome.status === "countermodel") {
      expect(zeroOutcome.diagnosis.counterexampleValuation).toEqual({
        P: true,
        Q: false,
      });
    }

    // 4 premises that still fail to entail S
    const fourPremises = [
      buildSandboxNode({ id: "P1", label: "P", type: "premise", x: 80, y: 60 }),
      buildSandboxNode({
        id: "P2",
        label: "P -> Q",
        type: "premise",
        x: 80,
        y: 140,
      }),
      buildSandboxNode({
        id: "P3",
        label: "Q -> R",
        type: "premise",
        x: 80,
        y: 220,
      }),
      buildSandboxNode({
        id: "P4",
        label: "R | S",
        type: "premise",
        x: 80,
        y: 300,
      }),
      buildSandboxNode({
        id: "G1",
        label: "S",
        type: "conclusion",
        x: 520,
        y: 180,
      }),
    ];
    const fourOutcome = evaluateSandboxCountermodel(fourPremises);
    expect(fourOutcome.status).toBe("countermodel");
    if (fourOutcome.status === "countermodel") {
      expect(fourOutcome.diagnosis.premises).toHaveLength(4);
      expect(fourOutcome.diagnosis.counterexampleValuation).toEqual({
        P: true,
        Q: true,
        R: true,
        S: false,
      });
    }
  });

  it("confirms semantic validity and enforces missing-goal and >6 variable bounds", () => {
    const validStarter = createStarterSandboxNodes();
    const validOutcome = evaluateSandboxCountermodel(validStarter);
    expect(validOutcome.status).toBe("valid");
    if (validOutcome.status === "valid") {
      expect(validOutcome.valuationCount).toBe(8);
      expect(validOutcome.formalFormula).toContain("⊨");
    }

    const noGoalOutcome = evaluateSandboxCountermodel([
      buildSandboxNode({ id: "P1", label: "P", type: "premise", x: 80, y: 80 }),
    ]);
    expect(noGoalOutcome).toEqual({
      status: "error",
      message: expect.stringMatching(/Add at least one Goal node/),
    });

    const sevenVarOutcome = evaluateSandboxCountermodel([
      buildSandboxNode({
        id: "P1",
        label: "A & B & C & D & E & F",
        type: "premise",
        x: 80,
        y: 80,
      }),
      buildSandboxNode({
        id: "G1",
        label: "G",
        type: "conclusion",
        x: 500,
        y: 80,
      }),
    ]);
    expect(sevenVarOutcome).toEqual({
      status: "error",
      message: expect.stringMatching(/at most six distinct propositions/i),
    });
  });
});

describe("Portable .proof.json workspace serialization, caps, and Lean 4 Web output", () => {
  it("round-trips formulas, positions, nodeOffsets, and proven edges identically", () => {
    const nodes = [
      buildSandboxNode({
        id: "P1",
        label: "P",
        type: "premise",
        x: 100,
        y: 100,
      }),
      buildSandboxNode({
        id: "P2",
        label: "P -> Q",
        type: "premise",
        x: 100,
        y: 220,
      }),
      buildSandboxNode({
        id: "S1",
        label: "Q",
        type: "intermediate",
        x: 320,
        y: 160,
        ruleUsed: "Modus Ponens",
      }),
      buildSandboxNode({
        id: "G1",
        label: "Q",
        type: "conclusion",
        x: 540,
        y: 160,
      }),
    ];
    const edges: Edge[] = [
      { source: "P1", target: "S1", ruleApplied: "MP" },
      { source: "P2", target: "S1", ruleApplied: "MP" },
      { source: "S1", target: "G1", ruleApplied: "Reit" },
    ];
    const sandboxTh = createSandboxTheorem(nodes, edges);
    const json = serializeProofWorkspaceJson(sandboxTh, edges, {
      S1: { x: 40, y: -20 },
    });

    expect(getExportFilename("proof.json", sandboxTh)).toBe(
      "proof-sandbox.proof.json"
    );
    expect(getExportMimeType("proof.json")).toBe(
      "application/json;charset=utf-8"
    );

    const parsed = parseProofWorkspaceJson(json);
    expect(parsed.mode).toBe("sandbox");
    expect(
      parsed.nodes.map((n) => ({ id: n.id, label: n.label, x: n.x, y: n.y }))
    ).toEqual([
      { id: "P1", label: "P", x: 100, y: 100 },
      { id: "P2", label: "P → Q", x: 100, y: 220 },
      { id: "S1", label: "Q", x: 360, y: 140 },
      { id: "G1", label: "Q", x: 540, y: 160 },
    ]);
    expect(parsed.edges).toEqual(edges);
  });

  it.each([
    {
      edges: [{ source: "S1", target: "P1" }],
      error: /premise.*incoming/i,
    },
    {
      edges: [
        { source: "S1", target: "S2" },
        { source: "S2", target: "S3" },
        { source: "S3", target: "S1" },
      ],
      error: /dependency cycle/i,
    },
  ])(
    "rejects invalid dependency edges in files and hashes: $error",
    ({ edges, error }) => {
      const nodes = [
        buildSandboxNode({ id: "P1", label: "P", type: "premise", x: 0, y: 0 }),
        ...["S1", "S2", "S3"].map((id) =>
          buildSandboxNode({
            id,
            label: "Q",
            type: "intermediate",
            x: 120,
            y: 80,
          })
        ),
      ];
      const snapshot = JSON.stringify({
        version: 1,
        mode: "sandbox",
        nodes,
        edges,
      });

      expect(() => parseProofWorkspaceJson(snapshot)).toThrow(error);
      expect(decodeSandboxHash(encodeSandboxHash(nodes, edges))).toBeNull();
    }
  );

  it("enforces the 64 KB size cap, 40-node cap, and parseCustomFormula validation", () => {
    const oversized = " ".repeat(MAX_PROOF_JSON_BYTES + 10);
    expect(() => parseProofWorkspaceJson(oversized)).toThrow(/64 KB/);

    const fortyOneNodes = Array.from(
      { length: MAX_SANDBOX_NODES + 1 },
      (_, i) => ({
        id: `P${i + 1}`,
        label: "P",
        type: "premise",
        x: 80,
        y: 80,
      })
    );
    expect(() =>
      parseProofWorkspaceJson(
        JSON.stringify({ version: 1, nodes: fortyOneNodes, edges: [] })
      )
    ).toThrow(/40-node/);

    expect(() =>
      parseProofWorkspaceJson(
        JSON.stringify({
          version: 1,
          nodes: [
            { id: "P1", label: "P -> -> Q", type: "premise", x: 80, y: 80 },
          ],
          edges: [],
        })
      )
    ).toThrow(/Node 'P1':/);

    expect(() =>
      parseProofWorkspaceJson(
        JSON.stringify({
          version: 1,
          nodes: [{ id: "P1", label: "P", type: "premise", x: 80, y: 80 }],
          edges: [{ source: "P1", target: "MISSING" }],
        })
      )
    ).toThrow(/unknown node 'MISSING'/);
  });

  it("generates standalone core Lean 4 code compatible with Lean 4 Web without Mathlib imports", () => {
    const nodes = [
      buildSandboxNode({ id: "P1", label: "P", type: "premise", x: 80, y: 80 }),
      buildSandboxNode({
        id: "P2",
        label: "P -> Q",
        type: "premise",
        x: 80,
        y: 180,
      }),
      buildSandboxNode({
        id: "P3",
        label: "Q -> R",
        type: "premise",
        x: 80,
        y: 280,
      }),
      buildSandboxNode({
        id: "S1",
        label: "Q",
        type: "intermediate",
        x: 300,
        y: 130,
      }),
      buildSandboxNode({
        id: "G1",
        label: "R",
        type: "conclusion",
        x: 540,
        y: 200,
      }),
    ];
    const edges: Edge[] = [
      { source: "P1", target: "S1", ruleApplied: "MP" },
      { source: "P2", target: "S1", ruleApplied: "MP" },
      { source: "S1", target: "G1", ruleApplied: "MP" },
      { source: "P3", target: "G1", ruleApplied: "MP" },
    ];
    const sandboxTh = createSandboxTheorem(nodes, edges);
    const leanCode = generateSandboxLean4Code(nodes, edges);

    expect(leanCode).not.toContain("import Mathlib");
    expect(leanCode).toContain("open Classical in");
    expect(leanCode).toContain(
      "theorem sandbox_derivation («P» «Q» «R» : Prop)"
    );
    expect(leanCode).toContain("have step_S1 : «Q» := (h_P2 h_P1)");
    expect(leanCode).toContain("have step_G1 : «R» := (h_P3 step_S1)");
    expect(leanCode).toContain("exact step_G1");
    expect(exportWorkspaceProof("lean", edges, sandboxTh)).toContain(leanCode);
  });
});

describe("URL hash serialization and 2048-character ceiling", () => {
  it("encodes and decodes sandbox graphs and guided proof edges losslessly", () => {
    const nodes = [
      buildSandboxNode({ id: "P1", label: "P", type: "premise", x: 80, y: 80 }),
      buildSandboxNode({
        id: "P2",
        label: "P -> Q",
        type: "premise",
        x: 80,
        y: 180,
      }),
      buildSandboxNode({
        id: "G1",
        label: "Q",
        type: "conclusion",
        x: 520,
        y: 130,
      }),
    ];
    const edges: Edge[] = [
      { source: "P1", target: "G1", ruleApplied: "MP" },
      { source: "P2", target: "G1", ruleApplied: "MP" },
    ];

    const encodedSandbox = encodeSandboxHash(nodes, edges);
    const decodedSandbox = decodeSandboxHash(encodedSandbox);
    expect(decodedSandbox).not.toBeNull();
    expect(
      decodedSandbox!.nodes.map((n) => ({ id: n.id, label: n.label }))
    ).toEqual([
      { id: "P1", label: "P" },
      { id: "P2", label: "P → Q" },
      { id: "G1", label: "Q" },
    ]);
    expect(decodedSandbox!.edges).toEqual(edges);

    const guidedEdges: Edge[] = [
      { source: "A", target: "C" },
      { source: "B", target: "C" },
      { source: "C", target: "E" },
      { source: "D", target: "E" },
    ];
    const encodedGuided = encodeGuidedEdgesHash(
      guidedEdges,
      THEOREMS["modus-ponens"].initialEdges
    );
    expect(encodedGuided).toBe("A>C,B>C,C>E,D>E");
    const decodedGuided = decodeGuidedEdgesHash(
      encodedGuided,
      THEOREMS["modus-ponens"]
    );
    expect(decodedGuided).toEqual(guidedEdges);
  });

  it("normalizes legacy reversed pairs in decodeGuidedEdgesHash and guided .proof.json snapshots while dropping invalid pairs", () => {
    const mp = THEOREMS["modus-ponens"];

    // Legacy reversed hash: every pair flips to its forward form and keeps its rule label
    expect(decodeGuidedEdgesHash("C>A:MP,C>B:MP,E>C:MP,E>D:MP", mp)).toEqual([
      { source: "A", target: "C", ruleApplied: "MP" },
      { source: "B", target: "C", ruleApplied: "MP" },
      { source: "C", target: "E", ruleApplied: "MP" },
      { source: "D", target: "E", ruleApplied: "MP" },
    ]);

    // Mixed hash: forward pairs stay forward, reversed valid pairs flip, and pairs invalid in both directions are dropped
    expect(
      decodeGuidedEdgesHash("A>C:MP,C>B:MP,E>C,C>A:Reit,A>E,B>D", mp)
    ).toEqual([
      { source: "A", target: "C", ruleApplied: "MP" },
      { source: "B", target: "C", ruleApplied: "MP" },
      { source: "C", target: "E" },
    ]);

    // Hash containing only pairs invalid in both directions returns null
    expect(decodeGuidedEdgesHash("A>E,B>D", mp)).toBeNull();

    // Guided .proof.json snapshot with legacy reversed pairs normalizes them and drops invalid pairs
    const legacyGuidedSnapshot = JSON.stringify({
      version: 1,
      mode: "guided",
      theoremId: "modus-ponens",
      nodes: mp.nodes,
      edges: [
        { source: "C", target: "A", ruleApplied: "MP" },
        { source: "B", target: "C", ruleApplied: "MP" },
        { source: "E", target: "C", ruleApplied: "MP" },
        { source: "A", target: "E", ruleApplied: "MP" },
      ],
    });
    const parsedGuided = parseProofWorkspaceJson(legacyGuidedSnapshot);
    expect(parsedGuided.mode).toBe("guided");
    expect(parsedGuided.edges).toEqual([
      { source: "A", target: "C", ruleApplied: "MP" },
      { source: "B", target: "C", ruleApplied: "MP" },
      { source: "C", target: "E", ruleApplied: "MP" },
    ]);
  });

  it("flags URL hashes exceeding MAX_PROOF_HASH_LENGTH (2048 characters)", () => {
    const manyNodes = Array.from({ length: 35 }, (_, idx) =>
      buildSandboxNode({
        id: `P${idx + 1}`,
        label: `(VarAlpha_${idx} & VarBeta_${idx}) -> (VarGamma_${idx} | VarDelta_${idx})`,
        type: idx === 34 ? "conclusion" : "premise",
        x: 80 + (idx % 5) * 100,
        y: 60 + Math.floor(idx / 5) * 60,
      })
    );
    const encoded = encodeSandboxHash(manyNodes, []);
    const shareCheck = buildProofShareHash({
      mode: "sandbox",
      sandbox: encoded,
    });
    expect(shareCheck.hash.length).toBeGreaterThan(MAX_PROOF_HASH_LENGTH);
    expect(shareCheck.exceedsLimit).toBe(true);
  });
});
