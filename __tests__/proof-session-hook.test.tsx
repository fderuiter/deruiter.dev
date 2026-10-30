import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { THEOREMS, type TheoremDefinition } from "@/lib/proof";
import { createCustomTheorem } from "@/lib/proof-custom";
import {
  WELCOME_LOG,
  makeLogId,
  useProofSession,
  type ProofSessionOptions,
} from "@/app/proof/useProofSession";

const MP = THEOREMS["modus-ponens"];

function setup(theorem: TheoremDefinition = MP) {
  const options: ProofSessionOptions = {
    theorem,
    feedback: {
      toast: vi.fn(),
      announce: vi.fn(),
      playSuccess: vi.fn(),
      playAutocomplete: vi.fn(),
      playHover: vi.fn(),
    },
    onFallacy: vi.fn(),
    onInspect: vi.fn(),
    onSwitchTheorem: vi.fn(),
    onSimulate: vi.fn(),
    onOpenExport: vi.fn(),
  };
  const hook = renderHook(
    (props: ProofSessionOptions) => useProofSession(props),
    {
      initialProps: options,
    }
  );
  return { ...hook, options };
}

type Session = ReturnType<typeof setup>["result"]["current"];

const lastLog = (session: Session) => session.consoleLogs.at(-1)!;
const edgePairs = (session: Session) =>
  session.edges.map((e) => `${e.source}${e.target}`);

describe("makeLogId", () => {
  it("never repeats within one millisecond", () => {
    vi.spyOn(Date, "now").mockReturnValue(42);
    const ids = new Set([makeLogId("x"), makeLogId("x"), makeLogId("x")]);
    expect(ids.size).toBe(3);
    vi.restoreAllMocks();
  });
});

describe("useProofSession: initial state", () => {
  it("starts from the theorem's given edges, the welcome log and no selection", () => {
    const { result } = setup();
    expect(result.current.edges).toEqual(MP.initialEdges);
    expect(result.current.selectedNodeIds).toEqual([]);
    expect(result.current.currentFallacy).toBeNull();
    expect(result.current.consoleLogs).toEqual([WELCOME_LOG]);
    expect(result.current.isE_Proven).toBe(false);
    expect(result.current.deductionLedger.length).toBeGreaterThan(0);
    expect(result.current.activeTacticHint).toBeTruthy();
  });
});

describe("useProofSession: connecting nodes", () => {
  it("completes modus ponens with C to E and D to E", () => {
    const { result, options } = setup();
    act(() => result.current.connectNodes("C", "E"));
    act(() => result.current.connectNodes("D", "E"));
    expect(edgePairs(result.current)).toEqual(["AC", "BC", "CE", "DE"]);
    expect(result.current.isE_Proven).toBe(true);
    expect(options.feedback.playSuccess).toHaveBeenCalledTimes(2);
    expect(options.feedback.toast).toHaveBeenLastCalledWith(
      "✔ Connected Node D → Node E!",
      "success",
      { announce: false }
    );
    expect(lastLog(result.current).text).toBe(
      "✔ Established edge: Node D (Q → R) → Node E (R)"
    );
  });

  it("rejects an invalid pair with a diagnosis and no new edge", () => {
    const { result, options } = setup();
    act(() => result.current.connectNodes("A", "E"));
    expect(result.current.edges).toEqual(MP.initialEdges);
    expect(result.current.currentFallacy).toMatchObject({
      sourceId: "A",
      targetId: "E",
    });
    expect(options.onFallacy).toHaveBeenCalledTimes(1);
    expect(options.feedback.toast).toHaveBeenCalledWith(
      expect.stringMatching(/^Invalid Connection: /),
      "error",
      { announce: false }
    );
    expect(lastLog(result.current)).toMatchObject({ type: "error" });
    expect(lastLog(result.current).text).toMatch(/^\[FALLACY DETECTED\]/);
  });

  it("keeps working when the audio context throws", () => {
    const { result, options } = setup();
    vi.mocked(options.feedback.playSuccess).mockImplementation(() => {
      throw new Error("audio blocked");
    });
    act(() => result.current.connectNodes("C", "E"));
    expect(edgePairs(result.current)).toContain("CE");
  });

  it("adds a cord the drag validated, naming its rule or a fallback", () => {
    const { result, options } = setup();
    act(() => result.current.connectByDrag("C", "E", "MP"));
    act(() => result.current.connectByDrag("D", "E", undefined));
    expect(edgePairs(result.current)).toEqual(["AC", "BC", "CE", "DE"]);
    expect(options.feedback.announce).toHaveBeenCalledWith(
      "Connected Node C to Node E via MP."
    );
    expect(options.feedback.announce).toHaveBeenCalledWith(
      "Connected Node D to Node E via deductive rule."
    );
    expect(lastLog(result.current).text).toContain("Rule: Inference");
  });

  it("diagnoses a cord dropped on the wrong target", () => {
    const { result, options } = setup();
    act(() => result.current.rejectDrag("A", "E"));
    expect(result.current.edges).toEqual(MP.initialEdges);
    expect(result.current.currentFallacy?.targetId).toBe("E");
    expect(options.onFallacy).toHaveBeenCalled();
    expect(options.feedback.announce).toHaveBeenCalledWith(
      expect.stringMatching(/^Connection rejected: /)
    );
  });
});

describe("useProofSession: clicking nodes", () => {
  it("selects, deselects and inspects a node", () => {
    const { result, options } = setup();
    act(() => result.current.handleNodeClick("C"));
    expect(result.current.selectedNodeIds).toEqual(["C"]);
    expect(options.onInspect).toHaveBeenCalledWith("C");
    expect(options.feedback.playHover).toHaveBeenCalled();
    act(() => result.current.handleNodeClick("C"));
    expect(result.current.selectedNodeIds).toEqual([]);
    expect(options.feedback.announce).toHaveBeenLastCalledWith(
      "Deselected Node C."
    );
  });

  it("connects the selected node to the second one clicked", () => {
    const { result } = setup();
    act(() => result.current.handleNodeClick("C"));
    act(() => result.current.handleNodeClick("E"));
    expect(edgePairs(result.current)).toContain("CE");
    expect(result.current.selectedNodeIds).toEqual([]);
  });

  it("builds a multi-selection with the modifier and toggles members off", () => {
    const { result, options } = setup();
    act(() => result.current.handleNodeClick("A", true));
    act(() => result.current.handleNodeClick("B", true));
    expect(result.current.selectedNodeIds).toEqual(["A", "B"]);
    act(() => result.current.handleNodeClick("A", true));
    expect(result.current.selectedNodeIds).toEqual(["B"]);
    expect(options.feedback.announce).toHaveBeenLastCalledWith(
      "Deselected Node A for rule application."
    );
  });

  it("starts over from the clicked node when two are already selected", () => {
    const { result } = setup();
    act(() => result.current.handleNodeClick("A", true));
    act(() => result.current.handleNodeClick("B", true));
    act(() => result.current.handleNodeClick("D"));
    expect(result.current.selectedNodeIds).toEqual(["D"]);
    expect(result.current.edges).toEqual(MP.initialEdges);
  });
});

describe("useProofSession: applying rules", () => {
  it("asks for a selection first", () => {
    const { result, options } = setup();
    act(() => result.current.handleApplyRule("mp"));
    expect(options.feedback.toast).toHaveBeenCalledWith(
      "Select premise/lemma nodes before applying an inference rule.",
      "info"
    );
    expect(result.current.edges).toEqual(MP.initialEdges);
  });

  it("derives the conclusion from the current selection and links it", () => {
    const { result, options } = setup();
    act(() => result.current.handleNodeClick("C", true));
    act(() => result.current.handleNodeClick("D", true));
    act(() => result.current.handleApplyRule("mp"));
    expect(result.current.edges.slice(-2)).toEqual([
      { source: "C", target: "E", ruleApplied: "MP" },
      { source: "D", target: "E", ruleApplied: "MP" },
    ]);
    expect(result.current.isE_Proven).toBe(true);
    expect(result.current.selectedNodeIds).toEqual([]);
    expect(options.feedback.announce).toHaveBeenLastCalledWith(
      expect.stringMatching(/^Applied rule MP: /)
    );
    expect(result.current.consoleLogs.at(-2)).toMatchObject({
      type: "command",
      text: "apply mp C D",
    });
  });

  it("skips edges that already exist when re-deriving a step", () => {
    const { result } = setup({ ...MP, initialEdges: [] });
    act(() => result.current.handleApplyRule("mp", ["A", "B"]));
    expect(edgePairs(result.current)).toEqual(["AC", "BC"]);
    act(() => result.current.handleApplyRule("mp", ["A", "B"]));
    expect(edgePairs(result.current)).toEqual(["AC", "BC"]);
  });

  it("explains a derivation that matches no workspace step", () => {
    const { result, options } = setup();
    act(() => result.current.handleApplyRule("and_intro", ["A", "D"]));
    expect(options.feedback.toast).toHaveBeenLastCalledWith(
      "The derived formula does not match an available workspace step.",
      "info"
    );
    expect(result.current.edges).toEqual(MP.initialEdges);
  });

  it("diagnoses a rule that does not apply, using the lone node as both ends", () => {
    const { result, options } = setup();
    act(() => result.current.handleApplyRule("mt", ["A"]));
    expect(result.current.edges).toEqual(MP.initialEdges);
    expect(result.current.currentFallacy).toMatchObject({
      sourceId: "A",
      targetId: "A",
    });
    expect(options.onFallacy).toHaveBeenCalled();
    expect(lastLog(result.current).text).toMatch(/^\[RULE ERROR\]/);
  });

  it("ignores node ids the theorem does not have", () => {
    const { result } = setup();
    act(() => result.current.handleApplyRule("mp", ["Z", "Y"]));
    expect(result.current.edges).toEqual(MP.initialEdges);
    expect(result.current.currentFallacy).not.toBeNull();
  });
});

describe("useProofSession: auto-step", () => {
  it("adds the next deduction until the goal is discharged", () => {
    const { result, options } = setup();
    act(() => result.current.handleAutoStep());
    expect(result.current.isE_Proven).toBe(true);
    expect(result.current.consoleLogs.at(-2)).toMatchObject({
      type: "command",
      text: "autostep",
    });
    act(() => result.current.handleAutoStep());
    expect(options.feedback.toast).toHaveBeenLastCalledWith(
      "Goal already fully discharged (Q.E.D.)!",
      "info"
    );
  });
});

describe("useProofSession: pruning and rollback", () => {
  it("prunes a derived step and everything that depends on it", () => {
    const { result, options } = setup();
    act(() => result.current.connectNodes("C", "E"));
    act(() => result.current.handleDeleteStep("C"));
    expect(result.current.edges).toEqual([]);
    expect(options.feedback.playAutocomplete).toHaveBeenCalled();
    expect(lastLog(result.current).text).toMatch(/^✔ Pruned Step/);
  });

  it("refuses to prune a premise", () => {
    const { result, options } = setup();
    act(() => result.current.handleDeleteStep("A"));
    expect(result.current.edges).toEqual(MP.initialEdges);
    expect(options.feedback.toast).toHaveBeenLastCalledWith(
      expect.stringMatching(/immutable axiom/),
      "error",
      { announce: false }
    );
    expect(lastLog(result.current).text).toMatch(/^\[PRUNE ERROR\]/);
  });

  it("does nothing on rollback without a diagnosis", () => {
    const { result, options } = setup();
    act(() => result.current.handleRollback());
    expect(result.current.edges).toEqual(MP.initialEdges);
    expect(options.feedback.toast).not.toHaveBeenCalled();
  });

  it("adding a premise edge, discharging the goal and rolling back restores the previous graph", () => {
    const { result } = setup();
    act(() => result.current.connectNodes("C", "E"));
    const before = result.current.edges;
    act(() => result.current.connectNodes("D", "E"));
    expect(result.current.isE_Proven).toBe(true);
    act(() =>
      result.current.setCurrentFallacy({
        ...result.current.currentFallacy!,
        fallacyName: "test",
        formalFormula: "",
        plainEnglish: "",
        softwareAnalogy: "",
        truthTable: [],
        sourceId: "D",
        targetId: "E",
      })
    );
    act(() => result.current.handleRollback());
    // E is a derived step, so rolling back prunes every edge into it.
    expect(result.current.edges).toEqual(MP.initialEdges);
    expect(before).toContainEqual({ source: "C", target: "E" });
    expect(result.current.currentFallacy).toBeNull();
    expect(lastLog(result.current).text).toBe(
      "✔ [ROLLBACK] Rolled back step (D → E) and cleared fallacy diagnosis."
    );
  });

  it("removes just the offending pair, either direction, when the target is a premise", () => {
    const { result } = setup({
      ...MP,
      initialEdges: [
        { source: "a", target: "d" },
        { source: "D", target: "A" },
        { source: "A", target: "C" },
      ],
    });
    act(() => result.current.rejectDrag("A", "D"));
    act(() => result.current.handleRollback());
    expect(edgePairs(result.current)).toEqual(["AC"]);
  });

  it("drops the last edge when the diagnosis names no target", () => {
    const { result, options } = setup();
    act(() =>
      result.current.setCurrentFallacy({
        fallacyName: "x",
        formalFormula: "",
        plainEnglish: "",
        softwareAnalogy: "",
        truthTable: [],
      })
    );
    act(() => result.current.handleRollback());
    expect(edgePairs(result.current)).toEqual(["AC"]);
    expect(options.feedback.announce).toHaveBeenLastCalledWith(
      "Rolled back invalid step and cleared fallacy diagnosis."
    );
  });

  it("keeps the edges when a derived target cannot be pruned and no source is known", () => {
    const empty = { ...MP, initialEdges: [] };
    const { result } = setup(empty);
    act(() =>
      result.current.setCurrentFallacy({
        fallacyName: "x",
        formalFormula: "",
        plainEnglish: "",
        softwareAnalogy: "",
        truthTable: [],
        targetId: "Z",
      })
    );
    act(() => result.current.handleRollback());
    expect(result.current.edges).toEqual([]);
    expect(result.current.currentFallacy).toBeNull();
  });
});

describe("useProofSession: rollback without a source", () => {
  it("keeps the edges when the target is a premise and no source is known", () => {
    const { result } = setup();
    act(() =>
      result.current.setCurrentFallacy({
        fallacyName: "x",
        formalFormula: "",
        plainEnglish: "",
        softwareAnalogy: "",
        truthTable: [],
        targetId: "A",
      })
    );
    act(() => result.current.handleRollback());
    expect(result.current.edges).toEqual(MP.initialEdges);
    expect(result.current.currentFallacy).toBeNull();
  });
});

describe("useProofSession: resetGraph", () => {
  it("replaces the edges and clears selection and diagnosis", () => {
    const { result } = setup();
    act(() => result.current.handleNodeClick("A"));
    act(() => result.current.rejectDrag("A", "E"));
    act(() => result.current.resetGraph([]));
    expect(result.current.edges).toEqual([]);
    expect(result.current.selectedNodeIds).toEqual([]);
    expect(result.current.currentFallacy).toBeNull();
  });
});

describe("useProofSession: terminal commands", () => {
  it("ignores a blank line", () => {
    const { result } = setup();
    act(() => result.current.runCommand("   "));
    expect(result.current.consoleLogs).toEqual([WELCOME_LOG]);
  });

  it("prints help, then clears the buffer", () => {
    const { result, options } = setup();
    act(() => result.current.runCommand("help"));
    expect(lastLog(result.current).text).toMatch(
      /^Interactive Proof Workspace CLI/
    );
    act(() => result.current.runCommand("clear"));
    expect(result.current.consoleLogs).toEqual([]);
    expect(options.feedback.announce).toHaveBeenLastCalledWith(
      "Cleared terminal logs."
    );
  });

  it("lists the graph and prints the ledger", () => {
    const { result } = setup();
    act(() => result.current.runCommand("list"));
    expect(lastLog(result.current).text).toContain("A -> C [MP]");
    act(() => result.current.runCommand("ledger"));
    expect(lastLog(result.current).text).toMatch(/^--- Deduction Ledger: /);
  });

  it("prints usage for incomplete commands", () => {
    const { result } = setup();
    for (const line of ["connect C", "disconnect", "prune", "apply mp"]) {
      act(() => result.current.runCommand(line));
      expect(lastLog(result.current)).toMatchObject({ type: "error" });
      expect(lastLog(result.current).text).toMatch(/^Usage: /);
    }
  });

  it("connects, disconnects either direction, prunes and applies", () => {
    const { result } = setup();
    act(() => result.current.runCommand("connect c e"));
    expect(edgePairs(result.current)).toContain("CE");
    act(() => result.current.runCommand("disconnect E C"));
    expect(edgePairs(result.current)).not.toContain("CE");
    expect(lastLog(result.current).text).toBe(
      "Removed edge between Node E and Node C."
    );
    act(() => result.current.runCommand("apply mp c d"));
    expect(result.current.isE_Proven).toBe(true);
    act(() => result.current.runCommand("delete-step E"));
    expect(result.current.isE_Proven).toBe(false);
  });

  it("auto-steps through solve", () => {
    const { result } = setup();
    act(() => result.current.runCommand("solve"));
    expect(result.current.isE_Proven).toBe(true);
  });

  it("inspects a known node and reports an unknown one", () => {
    const { result, options } = setup();
    act(() => result.current.runCommand("inspect c"));
    expect(options.onInspect).toHaveBeenCalledWith("C");
    expect(lastLog(result.current).text).toMatch(
      /^\[Node C\] Q\nType: INTERMEDIATE/
    );
    act(() => result.current.runCommand("inspect zz"));
    expect(lastLog(result.current).text).toBe("Node 'ZZ' not found.");
  });

  it("hands a known theorem to the page and reports an unknown one", () => {
    const { result, options } = setup();
    act(() => result.current.runCommand("theorem 2pc"));
    expect(options.onSwitchTheorem).toHaveBeenCalledWith("two-phase-commit");
    act(() => result.current.runCommand("switch nope"));
    expect(options.onSwitchTheorem).toHaveBeenCalledTimes(1);
    expect(lastLog(result.current).text).toMatch(/^Unknown theorem ID 'nope'/);
  });

  it("exports inline or opens the export dialog", () => {
    const { result, options } = setup();
    act(() => result.current.runCommand("export lean"));
    expect(lastLog(result.current).text.length).toBeGreaterThan(0);
    expect(options.onOpenExport).not.toHaveBeenCalled();
    act(() => result.current.runCommand("export"));
    expect(options.onOpenExport).toHaveBeenCalledTimes(1);
  });

  it("hands simulations to the page", () => {
    const { result, options } = setup();
    act(() => result.current.runCommand("simulate loop"));
    expect(options.onSimulate).toHaveBeenCalledWith("loop");
  });

  it("reports an unknown command", () => {
    const { result } = setup();
    act(() => result.current.runCommand("dance"));
    expect(lastLog(result.current).text).toBe(
      "Unknown command 'dance'. Type 'help' for available commands."
    );
  });
});

describe("useProofSession: custom theorems", () => {
  it("works on a theorem built from entered formulas", () => {
    const custom = createCustomTheorem(["P", "P -> Q", "Q -> R"], "R");
    const { result } = setup(custom);
    expect(result.current.edges).toEqual(custom.initialEdges);
    act(() => result.current.runCommand("autostep"));
    act(() => result.current.runCommand("autostep"));
    expect(result.current.isE_Proven).toBe(true);
  });
});

describe("useProofSession: theorem changes", () => {
  it("recomputes proof status for the new theorem's nodes", () => {
    const { result, rerender, options } = setup();
    act(() => result.current.connectNodes("C", "E"));
    act(() => result.current.connectNodes("D", "E"));
    expect(result.current.isE_Proven).toBe(true);
    const mt = THEOREMS["modus-tollens"];
    rerender({ ...options, theorem: mt });
    act(() => result.current.resetGraph(mt.initialEdges));
    expect(result.current.edges).toEqual(mt.initialEdges);
    expect(result.current.isE_Proven).toBe(false);
  });
});
