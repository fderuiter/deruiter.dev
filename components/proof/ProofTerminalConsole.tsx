"use client";

import React, { RefObject, useId } from "react";
import { IconTerminal } from "@tabler/icons-react";

export interface TerminalLog {
  id: string;
  type: "command" | "output" | "error" | "info" | "success";
  text: string;
}

interface ProofTerminalConsoleProps {
  isConsoleOpen: boolean;
  toggleConsole: () => void;
  mobileActiveView: "canvas" | "ledger" | "systems" | "fallacy" | "terminal";
  consoleLogs: TerminalLog[];
  consoleInput: string;
  setConsoleInput: (val: string) => void;
  handleConsoleSubmit: (e: React.FormEvent) => void;
  handleConsoleKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  suggestion?: string;
  consoleInputRef: RefObject<HTMLInputElement | null>;
  toggleBtnRef: RefObject<HTMLButtonElement | null>;
  terminalLogsContainerRef: RefObject<HTMLDivElement | null>;
}

export const ProofTerminalConsole: React.FC<ProofTerminalConsoleProps> = ({
  isConsoleOpen,
  toggleConsole,
  mobileActiveView,
  consoleLogs,
  consoleInput,
  setConsoleInput,
  handleConsoleSubmit,
  handleConsoleKeyDown,
  suggestion,
  consoleInputRef,
  toggleBtnRef,
  terminalLogsContainerRef,
}) => {
  const hintId = useId();
  return (
    <div
      data-keyboard-boundary="true"
      className={`rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden flex flex-col shadow-2xl ${
        mobileActiveView === "terminal" ? "flex" : "hidden lg:flex"
      }`}
    >
      <div className="px-4 py-2 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <IconTerminal className="w-4 h-4 text-brand-cyan" />
          <span className="text-xs font-mono font-semibold text-slate-300">
            proof-cli @ formal-verification
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
          <span>Toggle: Ctrl + `</span>
          <button
            ref={toggleBtnRef}
            onClick={toggleConsole}
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition cursor-pointer active:scale-[0.98]"
          >
            {isConsoleOpen ? "Collapse" : "Expand"}
          </button>
        </div>
      </div>

      {isConsoleOpen && (
        <div className="flex flex-col">
          <div
            ref={terminalLogsContainerRef}
            className="p-4 font-mono text-xs text-slate-300 h-44 overflow-y-auto space-y-1.5 bg-slate-950/80"
          >
            {consoleLogs.map((log) => (
              <div
                key={log.id}
                className={`whitespace-pre-wrap ${
                  log.type === "command"
                    ? "text-brand-cyan font-bold"
                    : log.type === "error"
                      ? "text-red-400 font-semibold"
                      : log.type === "success"
                        ? "text-emerald-400"
                        : "text-slate-300"
                }`}
              >
                {log.type === "command" ? `$ ${log.text}` : log.text}
              </div>
            ))}
          </div>

          <form
            onSubmit={handleConsoleSubmit}
            className="relative border-t border-slate-800 flex items-center"
          >
            <span className="pl-4 text-brand-cyan font-mono text-xs font-bold">
              $
            </span>
            <input
              ref={consoleInputRef}
              type="text"
              value={consoleInput}
              onChange={(e) => setConsoleInput(e.target.value)}
              onKeyDown={handleConsoleKeyDown}
              aria-describedby={suggestion ? hintId : undefined}
              placeholder="Enter logic command (e.g. 'connect A C', 'apply mp A B', 'help')..."
              className="w-full min-w-0 bg-transparent px-3 py-2.5 font-mono text-xs text-white placeholder-slate-600 focus:outline-none"
            />
            {suggestion && (
              <span className="absolute left-6 pointer-events-none font-mono text-xs text-slate-600 pl-[1ch]">
                <span className="invisible">{consoleInput}</span>
                {suggestion.substring(consoleInput.length)}
              </span>
            )}
            {suggestion && (
              <span
                id={hintId}
                className="shrink-0 whitespace-nowrap pr-4 pl-2 font-mono text-[11px] text-slate-400"
              >
                <kbd className="rounded border border-slate-700 bg-slate-900 px-1 py-px text-slate-300">
                  Tab
                </kbd>{" "}
                to complete
                <span className="sr-only">: {suggestion}</span>
              </span>
            )}
          </form>
        </div>
      )}
    </div>
  );
};
