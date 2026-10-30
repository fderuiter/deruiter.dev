"use client";

import React, { useState } from "react";
import { getSuggestion } from "@/lib/proof";

interface ProofConsoleInputOptions {
  /** Runs a submitted, trimmed, non-blank line. */
  onSubmit: (command: string) => void;
  /** Escape leaves the input; the page decides where focus goes. */
  onEscape: () => void;
  playAutocomplete: () => void;
}

/**
 * The terminal's input line: the draft, Up/Down history recall, Tab
 * completion of the current suggestion and Escape to leave.
 */
export function useProofConsoleInput({
  onSubmit,
  onEscape,
  playAutocomplete,
}: ProofConsoleInputOptions) {
  const [consoleInput, setConsoleInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);

  const suggestion = getSuggestion(consoleInput);

  const handleConsoleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const command = consoleInput.trim();
    if (!command) return;
    setHistory((prev) => [command, ...prev]);
    setHistoryIdx(-1);
    setConsoleInput("");
    onSubmit(command);
  };

  const recall = (idx: number) => {
    setHistoryIdx(idx);
    setConsoleInput(idx === -1 ? "" : history[idx]);
  };

  const handleConsoleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length > 0) {
        recall(Math.min(historyIdx + 1, history.length - 1));
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIdx >= 0) recall(historyIdx - 1);
    } else if (e.key === "Tab") {
      // Tab completes only while a suggestion is showing. Shift+Tab, a Tab
      // with nothing to complete and browser chords (Ctrl/Alt/Meta+Tab) are
      // left alone so focus moves on normally (#1616, WCAG 2.1.2).
      if (e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return;
      if (!suggestion) return;
      e.preventDefault();
      setConsoleInput(suggestion);
      try {
        playAutocomplete();
      } catch {}
    } else if (e.key === "Escape") {
      // A single Escape leaves the input and lands on the console toggle, so
      // focus stays in a predictable place rather than dropping to the body.
      e.preventDefault();
      onEscape();
    }
  };

  return {
    consoleInput,
    setConsoleInput,
    suggestion,
    handleConsoleSubmit,
    handleConsoleKeyDown,
  };
}
