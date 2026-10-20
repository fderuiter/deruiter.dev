import React, { useState } from "react";
import { HELP_TEXT, parseCommand, suggestCommand } from "./proof-graph";
import type { AddLog } from "./useConsoleLog";

interface TacticConsoleOptions {
  addLog: AddLog;
  clearLogs: () => void;
  connectNodes: (source: string, target: string) => void;
  disconnectNodes: (source: string, target: string) => void;
  executeRollback: () => void;
  toggleSolverLoop: () => void;
}

/**
 * The tactic shell's prompt: what is typed, its completion, the recall
 * history behind the arrow keys, and running a command.
 */
export function useTacticConsole({
  addLog,
  clearLogs,
  connectNodes,
  disconnectNodes,
  executeRollback,
  toggleSolverLoop,
}: TacticConsoleOptions) {
  const [consoleInput, setConsoleInput] = useState("");
  const [cliHistory, setCliHistory] = useState<string[]>([]);
  const [cliHistoryIdx, setCliHistoryIdx] = useState(-1);

  const suggestion = suggestCommand(consoleInput);

  const runCliCommand = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    addLog("command", trimmed);
    setConsoleInput("");
    setCliHistory((prev) => [...prev.filter((c) => c !== trimmed), trimmed]);
    setCliHistoryIdx(-1);

    const { verb, op, source, target } = parseCommand(trimmed);
    switch (op) {
      case "help":
        addLog("info", HELP_TEXT);
        return;
      case "clear":
        clearLogs();
        return;
      case "rollback":
        executeRollback();
        return;
      case "simulate":
        toggleSolverLoop();
        return;
      case "connect":
      case "disconnect":
        if (!source || !target) {
          addLog(
            "error",
            `Syntax Error: '${op}' requires source and target. Example: ${op} A C`
          );
        } else if (op === "connect") {
          connectNodes(source, target);
        } else {
          disconnectNodes(source, target);
        }
        return;
      default:
        addLog(
          "error",
          `Unrecognized command: '${verb}'. Type 'help' for registry references.`
        );
    }
  };

  const recall = (index: number) => {
    setCliHistoryIdx(index);
    setConsoleInput(index === -1 ? "" : cliHistory[index]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      runCliCommand(consoleInput);
    } else if (e.key === "Tab") {
      e.preventDefault();
      if (suggestion) setConsoleInput(suggestion);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (cliHistory.length === 0) return;
      recall(
        cliHistoryIdx === -1
          ? cliHistory.length - 1
          : Math.max(0, cliHistoryIdx - 1)
      );
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (cliHistoryIdx === -1) return;
      const next = cliHistoryIdx + 1;
      recall(next >= cliHistory.length ? -1 : next);
    }
  };

  return {
    consoleInput,
    setConsoleInput,
    suggestion,
    runCliCommand,
    handleKeyDown,
  };
}
