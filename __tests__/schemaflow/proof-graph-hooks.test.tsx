import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { fromPartial } from "@total-typescript/shoehorn";
import type React from "react";
import { useConsoleLog } from "@/components/schemaflow/useConsoleLog";
import { useProofGraph } from "@/components/schemaflow/useProofGraph";
import { useSolverTelemetry } from "@/components/schemaflow/useSolverTelemetry";
import { useTacticConsole } from "@/components/schemaflow/useTacticConsole";
import {
  HELP_TEXT,
  solverRamPercent,
} from "@/components/schemaflow/proof-graph";

afterEach(() => {
  vi.useRealTimers();
});

describe("useConsoleLog", () => {
  it("opens with the welcome message and appends entries with unique ids", () => {
    const { result } = renderHook(() => useConsoleLog());
    expect(result.current.consoleLogs).toHaveLength(1);
    expect(result.current.consoleLogs[0].text).toMatch(
      /^Logical Proof Assistant CLI/
    );

    act(() => {
      result.current.addLog("error", "first");
      result.current.addLog("error", "second");
    });
    const ids = result.current.consoleLogs.map((l) => l.id);
    expect(new Set(ids).size).toBe(3);
    expect(result.current.consoleLogs.at(-1)).toMatchObject({
      type: "error",
      text: "second",
    });

    act(() => result.current.clearLogs());
    expect(result.current.consoleLogs).toEqual([]);
  });
});

function setupGraph() {
  const addLog = vi.fn();
  const hook = renderHook(() => useProofGraph(addLog));
  return { ...hook, addLog };
}

describe("useProofGraph", () => {
  it("starts with one edge, no history and nothing selected", () => {
    const { result } = setupGraph();
    expect(result.current.edges).toEqual([{ source: "A", target: "C" }]);
    expect(result.current.history).toEqual([]);
    expect(result.current.selectedNodeId).toBeNull();
    expect(result.current.inspectorNode).toBeUndefined();
    expect(result.current.isC_Proven).toBe(false);
  });

  it("connects nodes, recording the previous edges for rollback", () => {
    const { result, addLog } = setupGraph();
    act(() => result.current.connectNodes("B", "C"));
    expect(result.current.edges).toHaveLength(2);
    expect(result.current.history).toEqual([[{ source: "A", target: "C" }]]);
    expect(result.current.isC_Proven).toBe(true);
    expect(addLog).toHaveBeenLastCalledWith(
      "success",
      "Established directed path: Node B → Node C"
    );
  });

  it("logs a refused connection and changes nothing", () => {
    const { result, addLog } = setupGraph();
    act(() => result.current.connectNodes("A", "C"));
    expect(result.current.edges).toHaveLength(1);
    expect(result.current.history).toEqual([]);
    expect(addLog).toHaveBeenCalledWith(
      "error",
      "Pathway from Node A to Node C is already active."
    );
  });

  it("disconnects an existing edge and refuses a missing one", () => {
    const { result, addLog } = setupGraph();
    act(() => result.current.disconnectNodes("A", "C"));
    expect(result.current.edges).toEqual([]);
    expect(result.current.history).toHaveLength(1);
    expect(addLog).toHaveBeenLastCalledWith(
      "success",
      "Severed path: Node A ↛ Node C"
    );

    act(() => result.current.disconnectNodes("A", "C"));
    expect(result.current.history).toHaveLength(1);
    expect(addLog).toHaveBeenLastCalledWith(
      "error",
      "No active pathway from Node A to Node C exists."
    );
  });

  it("rolls back one step at a time and reports an empty history", () => {
    const { result, addLog } = setupGraph();
    act(() => result.current.connectNodes("B", "C"));
    act(() => result.current.resetCanvas());
    expect(result.current.edges).toEqual([]);
    expect(addLog).toHaveBeenLastCalledWith("info", "All pathways cleared.");

    act(() => result.current.executeRollback());
    expect(result.current.edges).toHaveLength(2);
    act(() => result.current.executeRollback());
    expect(result.current.edges).toEqual([{ source: "A", target: "C" }]);
    expect(result.current.history).toEqual([]);

    act(() => result.current.executeRollback());
    expect(addLog).toHaveBeenLastCalledWith(
      "error",
      "Rollback failed: No historical step state recorded."
    );
  });

  it("selects, deselects and connects through node clicks", () => {
    const { result, addLog } = setupGraph();
    act(() => result.current.handleNodeClick("B"));
    expect(result.current.selectedNodeId).toBe("B");
    expect(result.current.inspectorNode?.id).toBe("B");
    expect(addLog).toHaveBeenLastCalledWith(
      "info",
      "Selected Node B. Click another node to establish a directed pathway."
    );

    act(() => result.current.handleNodeClick("B"));
    expect(result.current.selectedNodeId).toBeNull();
    expect(addLog).toHaveBeenLastCalledWith("info", "Deselected Node B.");

    act(() => result.current.handleNodeClick("B"));
    act(() => result.current.handleNodeClick("C"));
    expect(result.current.selectedNodeId).toBeNull();
    expect(result.current.isC_Proven).toBe(true);
  });

  it("prefers the hovered node over the selected one in the inspector", () => {
    const { result } = setupGraph();
    act(() => result.current.handleNodeClick("A"));
    act(() => result.current.setHoveredNodeId("E"));
    expect(result.current.hoveredNode?.id).toBe("E");
    expect(result.current.inspectorNode?.id).toBe("E");
    act(() => result.current.setHoveredNodeId(null));
    expect(result.current.hoveredNode).toBeUndefined();
    expect(result.current.inspectorNode?.id).toBe("A");
  });

  it("proves the goal through the full chain", () => {
    const { result } = setupGraph();
    act(() => result.current.connectNodes("B", "C"));
    act(() => result.current.connectNodes("C", "E"));
    act(() => result.current.connectNodes("D", "E"));
    expect(result.current.isE_Proven).toBe(true);
    expect(result.current.status).toEqual({
      isC_Proven: true,
      isE_Proven: true,
    });
  });
});

describe("useSolverTelemetry", () => {
  it("writes the gauge into the DOM on each tick while running, and stops cleanly", () => {
    vi.useFakeTimers();
    const addLog = vi.fn();
    const { result, unmount } = renderHook(() => useSolverTelemetry(addLog));
    const gauge = document.createElement("div");
    const text = document.createElement("span");
    result.current.gaugeContainerRef.current = gauge;
    result.current.ramTextRef.current = text;

    act(() => result.current.toggleSolverLoop());
    expect(result.current.isSolverLoopActive).toBe(true);
    expect(addLog).toHaveBeenCalledOnce();
    expect(addLog).toHaveBeenLastCalledWith(
      "info",
      "High-frequency mathematical solver loop initiated. RAM Telemetry active."
    );

    act(() => vi.advanceTimersByTime(160));
    expect(result.current.ramValRef.current).toBe(solverRamPercent(2));
    expect(gauge.style.getPropertyValue("--gauge-progress")).toBe(
      solverRamPercent(2).toString()
    );
    expect(text.textContent).toBe(`${solverRamPercent(2).toFixed(0)}%`);

    act(() => result.current.toggleSolverLoop());
    expect(result.current.isSolverLoopActive).toBe(false);
    expect(addLog).toHaveBeenLastCalledWith(
      "info",
      "Solver loop telemetry simulation suspended."
    );
    act(() => vi.advanceTimersByTime(800));
    expect(result.current.ramValRef.current).toBe(solverRamPercent(2));

    act(() => result.current.toggleSolverLoop());
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps ticking when the gauge is not mounted", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useSolverTelemetry(vi.fn()));
    act(() => result.current.toggleSolverLoop());
    act(() => vi.advanceTimersByTime(80));
    expect(result.current.ramValRef.current).toBe(solverRamPercent(1));
  });
});

function setupConsole() {
  const options = {
    addLog: vi.fn(),
    clearLogs: vi.fn(),
    connectNodes: vi.fn(),
    disconnectNodes: vi.fn(),
    executeRollback: vi.fn(),
    toggleSolverLoop: vi.fn(),
  };
  const hook = renderHook(() => useTacticConsole(options));
  return { ...hook, ...options };
}

const key = (k: string) => {
  const preventDefault = vi.fn();
  return {
    event: fromPartial<React.KeyboardEvent<HTMLInputElement>>({
      key: k,
      preventDefault,
    }),
    preventDefault,
  };
};

describe("useTacticConsole", () => {
  it("ignores a blank command", () => {
    const { result, addLog } = setupConsole();
    act(() => result.current.runCliCommand("   "));
    expect(addLog).not.toHaveBeenCalled();
  });

  it("echoes each command, clears the prompt and dispatches it", () => {
    const c = setupConsole();
    act(() => c.result.current.setConsoleInput("connect a c"));
    act(() => c.result.current.runCliCommand("  connect a c "));
    expect(c.addLog).toHaveBeenCalledWith("command", "connect a c");
    expect(c.result.current.consoleInput).toBe("");
    expect(c.connectNodes).toHaveBeenCalledWith("A", "C");

    act(() => c.result.current.runCliCommand("disconnect b c"));
    expect(c.disconnectNodes).toHaveBeenCalledWith("B", "C");
    act(() => c.result.current.runCliCommand("ROLLBACK"));
    expect(c.executeRollback).toHaveBeenCalledOnce();
    act(() => c.result.current.runCliCommand("simulate"));
    expect(c.toggleSolverLoop).toHaveBeenCalledOnce();
    act(() => c.result.current.runCliCommand("clear"));
    expect(c.clearLogs).toHaveBeenCalledOnce();
    act(() => c.result.current.runCliCommand("help"));
    expect(c.addLog).toHaveBeenLastCalledWith("info", HELP_TEXT);
  });

  it("reports missing arguments and unknown commands", () => {
    const c = setupConsole();
    act(() => c.result.current.runCliCommand("connect A"));
    expect(c.addLog).toHaveBeenLastCalledWith(
      "error",
      "Syntax Error: 'connect' requires source and target. Example: connect A C"
    );
    act(() => c.result.current.runCliCommand("disconnect"));
    expect(c.addLog).toHaveBeenLastCalledWith(
      "error",
      "Syntax Error: 'disconnect' requires source and target. Example: disconnect A C"
    );
    act(() => c.result.current.runCliCommand("Frobnicate now"));
    expect(c.addLog).toHaveBeenLastCalledWith(
      "error",
      "Unrecognized command: 'Frobnicate'. Type 'help' for registry references."
    );
    expect(c.connectNodes).not.toHaveBeenCalled();
    expect(c.disconnectNodes).not.toHaveBeenCalled();
  });

  it("runs the prompt on Enter and completes it on Tab", () => {
    const c = setupConsole();
    act(() => c.result.current.setConsoleInput("sim"));
    expect(c.result.current.suggestion).toBe("simulate");

    const tab = key("Tab");
    act(() => c.result.current.handleKeyDown(tab.event));
    expect(tab.preventDefault).toHaveBeenCalled();
    expect(c.result.current.consoleInput).toBe("simulate");

    act(() => c.result.current.handleKeyDown(key("Enter").event));
    expect(c.toggleSolverLoop).toHaveBeenCalledOnce();

    act(() => c.result.current.setConsoleInput("zz"));
    act(() => c.result.current.handleKeyDown(key("Tab").event));
    expect(c.result.current.consoleInput).toBe("zz");
  });

  it("recalls earlier commands with the arrow keys, newest first and without repeats", () => {
    const c = setupConsole();
    const up = () =>
      act(() => c.result.current.handleKeyDown(key("ArrowUp").event));
    const down = () =>
      act(() => c.result.current.handleKeyDown(key("ArrowDown").event));

    up();
    down();
    expect(c.result.current.consoleInput).toBe("");

    act(() => c.result.current.runCliCommand("help"));
    act(() => c.result.current.runCliCommand("rollback"));
    act(() => c.result.current.runCliCommand("help"));

    up();
    expect(c.result.current.consoleInput).toBe("help");
    up();
    expect(c.result.current.consoleInput).toBe("rollback");
    up();
    expect(c.result.current.consoleInput).toBe("rollback");
    down();
    expect(c.result.current.consoleInput).toBe("help");
    down();
    expect(c.result.current.consoleInput).toBe("");
    down();
    expect(c.result.current.consoleInput).toBe("");
  });

  it("leaves other keys alone", () => {
    const c = setupConsole();
    const other = key("a");
    act(() => c.result.current.handleKeyDown(other.event));
    expect(other.preventDefault).not.toHaveBeenCalled();
  });
});
