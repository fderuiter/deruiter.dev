import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { THEOREMS, type TheoremDefinition } from "@/lib/proof";
import {
  MAX_SANDBOX_NODES,
  buildSandboxNode,
  createSandboxTheorem,
} from "@/lib/proof-custom";
import {
  useProofSession,
  type ProofSessionOptions,
} from "@/app/proof/useProofSession";

function setup(theorem: TheoremDefinition = createSandboxTheorem()) {
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
    { initialProps: options }
  );
  return { ...hook, options };
}

type Session = ReturnType<typeof setup>["result"]["current"];

const ids = (session: Session) => session.nodes.map((n) => n.id);
const edgePairs = (session: Session) =>
  session.edges.map((e) => `${e.source}>${e.target}`);
const lastLog = (session: Session) => session.consoleLogs.at(-1)!;

function add(
  result: { current: Session },
  role: "premise" | "conclusion",
  formula: string
) {
  let outcome: ReturnType<Session["handleAddSandboxNode"]> = { ok: false };
  act(() => {
    outcome = result.current.handleAddSandboxNode(role, formula);
  });
  return outcome;
}

describe("useProofSession sandbox: guards outside Sandbox Mode", () => {
  it("refuses every sandbox edit on a guided theorem and leaves the graph alone", () => {
    const { result } = setup(THEOREMS["modus-ponens"]);
    const before = result.current.nodes;

    expect(add(result, "premise", "P")).toEqual({
      ok: false,
      error: "Switch to Sandbox Mode to add nodes.",
    });
    let edit: ReturnType<Session["handleUpdateSandboxNode"]> = { ok: true };
    act(() => {
      edit = result.current.handleUpdateSandboxNode("A", "P");
    });
    expect(edit).toEqual({
      ok: false,
      error: "Switch to Sandbox Mode to edit nodes.",
    });

    act(() => result.current.handleMoveSandboxNode("A", 1, 1));
    act(() => result.current.handleDeleteSandboxNode("A"));
    act(() => result.current.handleClearSandbox());
    act(() => result.current.handleLoadSandboxStarter());

    expect(result.current.nodes).toBe(before);
    expect(result.current.canUndo).toBe(false);
  });
});

describe("useProofSession sandbox: adding nodes", () => {
  it("numbers premises P1.. and goals G1.., formats the formula and logs it", () => {
    const { result, options } = setup();

    expect(add(result, "premise", "p -> q")).toEqual({
      ok: true,
      nodeId: "P1",
    });
    expect(add(result, "premise", "p")).toEqual({ ok: true, nodeId: "P2" });
    expect(add(result, "conclusion", "q")).toEqual({ ok: true, nodeId: "G1" });

    expect(ids(result.current)).toEqual(["P1", "P2", "G1"]);
    expect(result.current.nodes[0].type).toBe("premise");
    expect(result.current.nodes[2].type).toBe("conclusion");
    expect(options.feedback.announce).toHaveBeenLastCalledWith(
      `Added Goal Node G1, ${result.current.nodes[2].label}.`
    );
    expect(lastLog(result.current).text).toBe(
      `✔ Added Goal Node G1: ${result.current.nodes[2].label}`
    );
  });

  it("places new nodes on slots that do not overlap existing ones", () => {
    const { result } = setup();
    add(result, "premise", "a");
    add(result, "premise", "b");
    add(result, "premise", "c");
    const [n1, n2, n3] = result.current.nodes;
    for (const [m, n] of [
      [n1, n2],
      [n1, n3],
      [n2, n3],
    ]) {
      const overlaps = Math.abs(m.x - n.x) < 150 && Math.abs(m.y - n.y) < 76;
      expect(overlaps).toBe(false);
    }
  });

  it("returns the parser's message for an invalid formula and adds nothing", () => {
    const { result } = setup();
    const outcome = add(result, "premise", "p ->");
    expect(outcome.ok).toBe(false);
    expect(outcome.error).toBeTruthy();
    expect(result.current.nodes).toHaveLength(0);
  });

  it("refuses a node past the canvas cap with an error toast", () => {
    const full = Array.from({ length: MAX_SANDBOX_NODES }, (_, i) =>
      buildSandboxNode({
        id: `P${i + 1}`,
        label: "p",
        type: "premise",
        x: 40,
        y: 20,
      })
    );
    const { result, options } = setup(createSandboxTheorem(full));
    const outcome = add(result, "premise", "q");
    const msg = `Sandbox canvas is capped at ${MAX_SANDBOX_NODES} nodes.`;
    expect(outcome).toEqual({ ok: false, error: msg });
    expect(options.feedback.toast).toHaveBeenLastCalledWith(msg, "error");
  });

  it("links a new goal straight to a premise that already states it", () => {
    const { result } = setup();
    add(result, "premise", "p & q");
    add(result, "conclusion", "p & q");
    expect(edgePairs(result.current)).toEqual(["P1>G1"]);
    expect(result.current.edges[0].ruleApplied).toBe("Reit");
    expect(result.current.isE_Proven).toBe(true);
  });
});

describe("useProofSession sandbox: deriving steps", () => {
  it("spawns S1 from modus ponens, then links the goal when it is derived again", () => {
    const { result, options } = setup();
    add(result, "premise", "p -> q");
    add(result, "premise", "p");

    act(() => result.current.handleApplyRule("mp", ["P1", "P2"]));
    expect(ids(result.current)).toEqual(["P1", "P2", "S1"]);
    const s1 = result.current.nodes[2];
    expect(s1.type).toBe("intermediate");
    expect(s1.derivedFrom).toEqual(["P1", "P2"]);
    expect(edgePairs(result.current)).toEqual(["P1>S1", "P2>S1"]);
    expect(options.feedback.announce).toHaveBeenLastCalledWith(
      expect.stringMatching(/^Spawned intermediate Node S1, /)
    );

    add(result, "conclusion", "q");
    expect(edgePairs(result.current)).toContain("S1>G1");
    expect(result.current.isE_Proven).toBe(true);
  });

  it("rejects a rule on a node that is missing or not yet proven", () => {
    const { result, options } = setup();
    add(result, "premise", "p -> q");
    add(result, "conclusion", "q");

    act(() => result.current.handleApplyRule("mp", ["P1", "ZZ"]));
    expect(options.feedback.toast).toHaveBeenLastCalledWith(
      "One or more selected nodes do not exist on the canvas.",
      "error"
    );

    act(() => result.current.handleApplyRule("and_elim", ["G1"]));
    expect(options.feedback.toast).toHaveBeenLastCalledWith(
      expect.stringMatching(/^Node G1 .* is not yet proven\./),
      "error"
    );
    expect(result.current.edges).toEqual([]);
  });

  it("asks for a selection before applying a rule", () => {
    const { result, options } = setup();
    act(() => result.current.handleApplyRule("mp", []));
    expect(options.feedback.toast).toHaveBeenLastCalledWith(
      "Select premise/lemma nodes before applying an inference rule.",
      "info"
    );
  });

  it("selects a second premise with a plain click so binary rules can fire", () => {
    const { result } = setup();
    add(result, "premise", "p");
    add(result, "premise", "q");
    act(() => result.current.handleNodeClick("P1"));
    act(() => result.current.handleNodeClick("P2"));
    expect(result.current.selectedNodeIds).toEqual(["P1", "P2"]);
  });
});

describe("useProofSession sandbox: editing nodes", () => {
  it("reports a missing node and an invalid formula without changing history", () => {
    const { result } = setup();
    add(result, "premise", "p");
    const pastBefore = result.current.past.length;

    let outcome: ReturnType<Session["handleUpdateSandboxNode"]> = { ok: true };
    act(() => {
      outcome = result.current.handleUpdateSandboxNode("P9", "q");
    });
    expect(outcome).toEqual({ ok: false, error: "Node P9 not found." });

    act(() => {
      outcome = result.current.handleUpdateSandboxNode("P1", "(");
    });
    expect(outcome.ok).toBe(false);

    act(() => {
      outcome = result.current.handleUpdateSandboxNode("P1", "p");
    });
    expect(outcome).toEqual({ ok: true });
    expect(result.current.past.length).toBe(pastBefore);
  });

  it("prunes a derived step and unlinks the goal when a premise edit breaks the derivation", () => {
    const { result } = setup();
    add(result, "premise", "p -> q");
    add(result, "premise", "p");
    act(() => result.current.handleApplyRule("mp", ["P1", "P2"]));
    add(result, "conclusion", "q");
    expect(result.current.isE_Proven).toBe(true);

    act(() => {
      result.current.handleUpdateSandboxNode("P2", "r");
    });
    expect(ids(result.current)).toEqual(["P1", "P2", "G1"]);
    expect(result.current.edges).toEqual([]);
    expect(result.current.nodes[1].description).toMatch(/^Sandbox premise: /);
    expect(result.current.isE_Proven).toBe(false);
  });

  it("links an edited goal to a proven node with the same formula", () => {
    const { result } = setup();
    add(result, "premise", "p");
    add(result, "conclusion", "q");
    expect(result.current.edges).toEqual([]);

    act(() => {
      result.current.handleUpdateSandboxNode("G1", "p");
    });
    expect(edgePairs(result.current)).toEqual(["P1>G1"]);
    expect(lastLog(result.current).text).toMatch(/^✔ Updated Node G1: /);
  });
});

describe("useProofSession sandbox: moving, deleting, clearing and the starter", () => {
  it("records a drag as one undoable move and ignores a move to the same spot", () => {
    const { result } = setup();
    add(result, "premise", "p");
    const { x, y } = result.current.nodes[0];
    const pastBefore = result.current.past.length;

    act(() => result.current.handleMoveSandboxNode("P1", x, y));
    act(() => result.current.handleMoveSandboxNode("P9", 10, 10));
    expect(result.current.past.length).toBe(pastBefore);

    act(() => result.current.handleMoveSandboxNode("P1", 300.4, 199.6));
    expect(result.current.nodes[0]).toMatchObject({ x: 300, y: 200 });
    act(() => result.current.handleUndo());
    expect(result.current.nodes[0]).toMatchObject({ x, y });
  });

  it("deletes a premise with the steps that depend on it", () => {
    const { result, options } = setup();
    add(result, "premise", "p -> q");
    add(result, "premise", "p");
    act(() => result.current.handleApplyRule("mp", ["P1", "P2"]));
    act(() => result.current.handleNodeClick("P2"));

    act(() => result.current.handleDeleteSandboxNode("P2"));
    expect(ids(result.current)).toEqual(["P1"]);
    expect(result.current.edges).toEqual([]);
    expect(result.current.selectedNodeIds).toEqual([]);
    expect(lastLog(result.current).id).toMatch(/^sandbox-del-/);
    expect(options.feedback.toast).toHaveBeenLastCalledWith(
      expect.stringMatching(/^✔ /),
      "info",
      { announce: false }
    );
  });

  it("toasts the prune error for a node that is not on the canvas", () => {
    const { result, options } = setup();
    add(result, "premise", "p");
    act(() => result.current.handleDeleteSandboxNode("P9"));
    expect(ids(result.current)).toEqual(["P1"]);
    expect(options.feedback.toast).toHaveBeenLastCalledWith(
      expect.any(String),
      "error"
    );
  });

  it("clears the canvas as one undoable step, and does nothing when already empty", () => {
    const { result } = setup();
    act(() => result.current.handleClearSandbox());
    expect(result.current.canUndo).toBe(false);

    add(result, "premise", "p");
    act(() => result.current.handleClearSandbox());
    expect(result.current.nodes).toEqual([]);
    expect(lastLog(result.current).text).toBe(
      "✔ Cleared all sandbox nodes and edges."
    );
    act(() => result.current.handleUndo());
    expect(ids(result.current)).toEqual(["P1"]);
  });

  it("loads the P, P → Q, Q → R ⊢ R starter", () => {
    const { result } = setup();
    act(() => result.current.handleLoadSandboxStarter());
    expect(ids(result.current)).toEqual(["P1", "P2", "P3", "G1"]);
    expect(result.current.edges).toEqual([]);
    expect(lastLog(result.current).text).toBe(
      "✔ Loaded starter sandbox conjecture: P, P → Q, Q → R ⊢ R"
    );
  });
});

describe("useProofSession sandbox: countermodel check", () => {
  it("reports an error when there is nothing to check", () => {
    const { result } = setup();
    let outcome: ReturnType<Session["handleCheckCountermodel"]> | undefined;
    act(() => {
      outcome = result.current.handleCheckCountermodel();
    });
    expect(outcome?.status).toBe("error");
    expect(lastLog(result.current).id).toMatch(/^cm-err-/);
  });

  it("opens the fallacy panel when the premises do not entail the goal", () => {
    const { result, options } = setup();
    add(result, "premise", "p -> q");
    add(result, "conclusion", "p");
    let outcome: ReturnType<Session["handleCheckCountermodel"]> | undefined;
    act(() => {
      outcome = result.current.handleCheckCountermodel();
    });
    expect(outcome?.status).toBe("countermodel");
    expect(options.onFallacy).toHaveBeenCalledTimes(1);
    expect(result.current.currentFallacy).not.toBeNull();
    expect(lastLog(result.current).text).toMatch(/^\[COUNTERMODEL FOUND\]/);
  });

  it("confirms a valid argument across every valuation", () => {
    const { result } = setup();
    act(() => result.current.handleLoadSandboxStarter());
    let outcome: ReturnType<Session["handleCheckCountermodel"]> | undefined;
    act(() => {
      outcome = result.current.handleCheckCountermodel();
    });
    expect(outcome).toMatchObject({ status: "valid", valuationCount: 8 });
    expect(result.current.currentFallacy).toBeNull();
    expect(lastLog(result.current).text).toMatch(/^✔ Semantically valid /);
  });
});

describe("useProofSession sandbox: Auto-Step and failed rules", () => {
  it("spawns the next unary consequence when no goal can be reached yet", () => {
    const { result } = setup();
    add(result, "premise", "p & q");
    add(result, "conclusion", "r");

    act(() => result.current.handleAutoStep());
    expect(ids(result.current)).toEqual(["P1", "G1", "S1"]);
    expect(result.current.nodes[2].type).toBe("intermediate");
    expect(edgePairs(result.current)).toEqual(["P1>S1"]);
  });

  it("falls through to a binary consequence once unary rules add nothing new", () => {
    const { result } = setup();
    add(result, "premise", "p -> q");
    add(result, "premise", "p");
    add(result, "conclusion", "r");

    act(() => result.current.handleAutoStep());
    const spawned = result.current.nodes.find((n) => n.id === "S1");
    expect(spawned?.derivedFrom).toEqual(["P1", "P2"]);
    expect(edgePairs(result.current)).toEqual(["P1>S1", "P2>S1"]);
  });

  it("says so when a proven goal leaves nothing to do", () => {
    const { result, options } = setup();
    add(result, "premise", "p");
    add(result, "conclusion", "p");
    const before = result.current.nodes;

    act(() => result.current.handleAutoStep());
    expect(result.current.nodes).toBe(before);
    expect(options.feedback.toast).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.stringMatching(/^(info|success)$/)
    );
  });

  it("diagnoses a rule that does not fit the selected formulas", () => {
    const { result, options } = setup();
    add(result, "premise", "p");
    add(result, "premise", "q");

    act(() => result.current.handleApplyRule("mp", ["P1", "P2"]));
    expect(result.current.nodes).toHaveLength(2);
    expect(options.onFallacy).toHaveBeenCalledTimes(1);
    expect(options.feedback.toast).toHaveBeenLastCalledWith(
      expect.stringMatching(/^Rule Application Failed: /),
      "error",
      { announce: false }
    );
    expect(lastLog(result.current).text).toMatch(/^\[RULE ERROR\]/);
  });

  it("refuses to derive past the canvas cap", () => {
    const full = [
      buildSandboxNode({
        id: "P1",
        label: "p & q",
        type: "premise",
        x: 40,
        y: 20,
      }),
      ...Array.from({ length: MAX_SANDBOX_NODES - 1 }, (_, i) =>
        buildSandboxNode({
          id: `X${i + 1}`,
          label: "z",
          type: "premise",
          x: 40,
          y: 20,
        })
      ),
    ];
    const { result, options } = setup(createSandboxTheorem(full));
    act(() => result.current.handleApplyRule("and_elim", ["P1"]));
    expect(result.current.nodes).toHaveLength(MAX_SANDBOX_NODES);
    expect(options.feedback.toast).toHaveBeenLastCalledWith(
      expect.stringMatching(/^Sandbox canvas is capped at /),
      "error"
    );
  });

  it("discharges an existing goal instead of spawning a duplicate step", () => {
    const { result } = setup();
    add(result, "premise", "p & q");
    add(result, "conclusion", "q");

    act(() => result.current.handleApplyRule("and_elim_r", ["P1"]));
    expect(ids(result.current)).toEqual(["P1", "G1"]);
    expect(edgePairs(result.current)).toEqual(["P1>G1"]);
    expect(result.current.nodes[1].ruleUsed).toBeTruthy();
    expect(result.current.isE_Proven).toBe(true);
  });
});
