// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  THEOREMS,
  evaluateProofStatus,
  canConnect,
  getNextTacticHint,
  getDeductionLedger,
  applyRuleToAsts,
  parseFormula,
  formatFormula,
  type TheoremId,
} from "../lib/proof-utils";

describe("Formal Theorem Library & Multi-Theorem Validation", () => {
  const allTheoremIds: TheoremId[] = [
    "modus-ponens",
    "modus-tollens",
    "hypothetical-syllogism",
    "disjunctive-syllogism",
    "resolution",
    "two-phase-commit",
    "quorum-overlap",
    "cache-consistency",
    "paxos-synod",
    "paxos-phase2b",
    "bft-quorum",
    "custom",
  ];

  it("registers all 12 distinct theorems with complete specifications", () => {
    expect(Object.keys(THEOREMS)).toHaveLength(12);
    allTheoremIds.forEach((id) => {
      const th = THEOREMS[id];
      expect(th).toBeDefined();
      expect(th.title).toBeTruthy();
      expect(th.nodes).toHaveLength(5);
      expect(th.initialEdges).toHaveLength(2);
      expect(th.validPairs.length).toBeGreaterThan(0);
      expect(th.leanCode).toContain("theorem");
      expect(th.latexCode).toContain("\\begin{prooftree}");
      expect(th.simulationSteps.length).toBeGreaterThan(3);
    });
  });

  describe("Modus Tollens (Memory Safety)", () => {
    it("correctly starts with intermediate Node C proven from initial edges", () => {
      const th = THEOREMS["modus-tollens"];
      const status = evaluateProofStatus(th.initialEdges, "modus-tollens");
      expect(status.isC_Proven).toBe(true);
      expect(status.isE_Proven).toBe(false);
    });

    it("evaluates to Q.E.D. when C and D are wired to E", () => {
      const edges = [
        { source: "A", target: "C" },
        { source: "B", target: "C" },
        { source: "C", target: "E" },
        { source: "D", target: "E" },
      ];
      const status = evaluateProofStatus(edges, "modus-tollens");
      expect(status.isC_Proven).toBe(true);
      expect(status.isE_Proven).toBe(true);

      const hint = getNextTacticHint(edges, "modus-tollens");
      expect(hint.isCompleted).toBe(true);
      expect(hint.title).toContain("Q.E.D.");
    });
  });

  describe("Hypothetical Syllogism (Service SLA Chaining)", () => {
    it("provides contextual tactic hints through each step", () => {
      const hint1 = getNextTacticHint([], "hypothetical-syllogism");
      expect(hint1.stepNumber).toBe(1);
      expect(hint1.suggestedSource).toBe("A");
      expect(hint1.suggestedTarget).toBe("C");

      // Has req1 but missing req2
      const hint1b = getNextTacticHint(
        [{ source: "A", target: "C" }],
        "hypothetical-syllogism"
      );
      expect(hint1b.stepNumber).toBe(1);
      expect(hint1b.suggestedSource).toBe("B");

      const edgesPartial = [
        { source: "A", target: "C" },
        { source: "B", target: "C" },
      ];
      const hint2 = getNextTacticHint(edgesPartial, "hypothetical-syllogism");
      expect(hint2.stepNumber).toBe(2);
      expect(hint2.suggestedSource).toBe("C");
      expect(hint2.suggestedTarget).toBe("E");

      // Has cReq1 but missing cReq2
      const hint2b = getNextTacticHint(
        [
          { source: "A", target: "C" },
          { source: "B", target: "C" },
          { source: "C", target: "E" },
        ],
        "hypothetical-syllogism"
      );
      expect(hint2b.stepNumber).toBe(2);
      expect(hint2b.suggestedSource).toBe("D");

      // Fully complete
      const hint3 = getNextTacticHint(
        [
          { source: "A", target: "C" },
          { source: "B", target: "C" },
          { source: "C", target: "E" },
          { source: "D", target: "E" },
        ],
        "hypothetical-syllogism"
      );
      expect(hint3.isCompleted).toBe(true);
    });
  });

  describe("Disjunctive Syllogism (Consensus Failover)", () => {
    it("allows valid pairs and rejects invalid connections", () => {
      expect(canConnect("A", "C", [], "disjunctive-syllogism").allowed).toBe(
        true
      );
      expect(canConnect("B", "C", [], "disjunctive-syllogism").allowed).toBe(
        true
      );
      expect(canConnect("C", "E", [], "disjunctive-syllogism").allowed).toBe(
        true
      );
      expect(canConnect("D", "E", [], "disjunctive-syllogism").allowed).toBe(
        true
      );

      expect(canConnect("A", "E", [], "disjunctive-syllogism").allowed).toBe(
        false
      );
      expect(canConnect("B", "D", [], "disjunctive-syllogism").allowed).toBe(
        false
      );
    });
  });

  describe("Resolution Refutation (Deadlock Safety)", () => {
    it("generates complete deduction ledger table with status flags", () => {
      const edges = [
        { source: "A", target: "C" },
        { source: "B", target: "C" },
        { source: "C", target: "E" },
        { source: "D", target: "E" },
      ];
      const ledger = getDeductionLedger(edges, "resolution");
      expect(ledger).toHaveLength(5);
      expect(ledger[0].formula).toBe("P ∨ Q");
      expect(ledger[2].isProven).toBe(true);
      expect(ledger[4].isProven).toBe(true);
      expect(ledger[4].rule).toBe("Modus Ponens");
    });
  });

  describe("Two-Phase Commit (2PC) & Quorum Overlap Scenarios", () => {
    it("supports 2PC distributed transaction invariants", () => {
      const th = THEOREMS["two-phase-commit"];
      expect(th).toBeDefined();
      expect(th.category).toBe("Distributed Systems");
      expect(th.title).toContain("Two-Phase Commit");

      const edges = [
        { source: "A", target: "C" },
        { source: "B", target: "C" },
        { source: "C", target: "E" },
        { source: "D", target: "E" },
      ];
      const status = evaluateProofStatus(edges, "two-phase-commit");
      expect(status.isE_Proven).toBe(true);
    });

    it("evaluates AST rule applications accurately", () => {
      const astP = parseFormula("P");
      const astImp = parseFormula("P -> Q");
      expect(astP).toBeDefined();
      expect(astImp).toBeDefined();

      const mpResult = applyRuleToAsts("mp", [astP!, astImp!]);
      expect(mpResult.success).toBe(true);
      expect(formatFormula(mpResult.resultAst!)).toBe("Q");
    });
  });

  describe("Paxos Synod Invariant (Targeted Consensus Utility)", () => {
    it("provides complete specification and verifies consensus safety", () => {
      const th = THEOREMS["paxos-synod"];
      expect(th).toBeDefined();
      expect(th.category).toBe("Distributed Systems");
      expect(th.title).toBe("Paxos Synod Invariant");
      expect(th.subtitle).toContain("Single-Decree");

      // Verify node formulas and ASTs
      expect(th.nodes.find((n) => n.id === "A")?.label).toBe("MajQ1");
      expect(th.nodes.find((n) => n.id === "C")?.label).toBe("MaxVal");
      expect(th.nodes.find((n) => n.id === "E")?.label).toBe("SynodAgreement");

      // Initial state: C is proven via initial edges (A->C, B->C)
      const initialStatus = evaluateProofStatus(th.initialEdges, "paxos-synod");
      expect(initialStatus.isC_Proven).toBe(true);
      expect(initialStatus.isE_Proven).toBe(false);

      // Complete proof: C and D wired to E
      const completeEdges = [
        { source: "A", target: "C" },
        { source: "B", target: "C" },
        { source: "C", target: "E" },
        { source: "D", target: "E" },
      ];
      const completeStatus = evaluateProofStatus(completeEdges, "paxos-synod");
      expect(completeStatus.isC_Proven).toBe(true);
      expect(completeStatus.isE_Proven).toBe(true);

      const ledger = getDeductionLedger(completeEdges, "paxos-synod");
      expect(ledger).toHaveLength(5);
      expect(ledger[0].formula).toBe("MajQ1");
      expect(ledger[2].formula).toBe("MaxVal");
      expect(ledger[4].formula).toBe("SynodAgreement");
      expect(ledger[4].isProven).toBe(true);

      expect(th.leanCode).toContain("theorem paxos_synod_safety");
      expect(th.latexCode).toContain("SynodAgreement");
    });

    it("enforces valid connection constraints and prevents invalid jumps", () => {
      expect(canConnect("A", "C", [], "paxos-synod").allowed).toBe(true);
      expect(canConnect("C", "E", [], "paxos-synod").allowed).toBe(true);
      expect(canConnect("D", "E", [], "paxos-synod").allowed).toBe(true);
      expect(canConnect("A", "E", [], "paxos-synod").allowed).toBe(false);
      expect(canConnect("B", "D", [], "paxos-synod").allowed).toBe(false);
    });
  });

  describe("Paxos Phase 2B Acceptor Quorum", () => {
    it("verifies conjunction and commit threshold for Phase 2B", () => {
      const th = THEOREMS["paxos-phase2b"];
      expect(th).toBeDefined();
      expect(th.category).toBe("Distributed Systems");
      expect(th.title).toContain("Paxos Phase 2B");

      const nodeA = th.nodes.find((n) => n.id === "A");
      const nodeB = th.nodes.find((n) => n.id === "B");
      const nodeC = th.nodes.find((n) => n.id === "C");
      const nodeE = th.nodes.find((n) => n.id === "E");

      expect(nodeA?.label).toBe("PromiseB");
      expect(nodeB?.label).toBe("AcceptReqB");
      expect(nodeC?.label).toBe("PromiseB ∧ AcceptReqB");
      expect(nodeE?.label).toBe("ValueChosen");

      // Verify AST Conjunction Intro
      const andIntroResult = applyRuleToAsts("and_intro", [
        nodeA!.ast!,
        nodeB!.ast!,
      ]);
      expect(andIntroResult.success).toBe(true);
      expect(formatFormula(andIntroResult.resultAst!)).toBe(
        "PromiseB ∧ AcceptReqB"
      );

      const edges = [
        { source: "A", target: "C" },
        { source: "B", target: "C" },
        { source: "C", target: "E" },
        { source: "D", target: "E" },
      ];
      const status = evaluateProofStatus(edges, "paxos-phase2b");
      expect(status.isE_Proven).toBe(true);
      expect(th.leanCode).toContain("theorem paxos_phase2b_quorum");
    });
  });

  describe("BFT 3f+1 Quorum Overlap (Fault Tolerance)", () => {
    it("verifies Byzantine fault tolerance 3f+1 overlap bound and equivocation resistance", () => {
      const th = THEOREMS["bft-quorum"];
      expect(th).toBeDefined();
      expect(th.category).toBe("Fault Tolerance");
      expect(th.title).toBe("BFT 3f+1 Quorum Overlap");

      expect(th.nodes.find((n) => n.id === "A")?.label).toBe("Quorum1");
      expect(th.nodes.find((n) => n.id === "B")?.label).toBe("Quorum2");
      expect(th.nodes.find((n) => n.id === "C")?.label).toBe("HonestOverlap");
      expect(th.nodes.find((n) => n.id === "E")?.label).toBe("ByzantineSafety");

      const edges = [
        { source: "A", target: "C" },
        { source: "B", target: "C" },
        { source: "C", target: "E" },
        { source: "D", target: "E" },
      ];
      const status = evaluateProofStatus(edges, "bft-quorum");
      expect(status.isC_Proven).toBe(true);
      expect(status.isE_Proven).toBe(true);

      const hint = getNextTacticHint(edges, "bft-quorum");
      expect(hint.isCompleted).toBe(true);
      expect(hint.title).toContain("Discharged");

      expect(th.leanCode).toContain("theorem bft_3f_plus_1_quorum_safety");
      expect(th.latexCode).toContain("ByzantineSafety");
    });
  });
});
