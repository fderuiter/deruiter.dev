"use client";

import React, { useState, useRef, useEffect } from "react";
import { StudyProtocol, StudioMode } from "@/lib/crf/types";
import { executeCliString, stripAnsi } from "@/lib/crf/cli-engine";
import {
  IconTerminal2,
  IconX,
  IconPlayerPlay,
  IconTrash,
  IconCheck,
  IconCopy,
  IconSparkles,
} from "@tabler/icons-react";
import { useClipboard } from "@/hooks/useClipboard";

interface StudioTerminalProps {
  isOpen: boolean;
  study: StudyProtocol;
  onClose: () => void;
  onUpdateStudy: (updated: StudyProtocol) => void;
  onOpenWizard?: () => void;
  onSwitchMode?: (mode: StudioMode) => void;
  onOpenModal?: (
    modal: "wizard" | "branding" | "diagnostics" | "export"
  ) => void;
}

interface TerminalHistoryItem {
  id: string;
  command: string;
  output: string;
  success: boolean;
  timestamp: string;
}

export const StudioTerminal: React.FC<StudioTerminalProps> = ({
  isOpen,
  study,
  onClose,
  onUpdateStudy,
  onOpenWizard,
  onSwitchMode,
  onOpenModal,
}) => {
  const [inputVal, setInputVal] = useState("");
  const cmdCounterRef = useRef<number>(1);
  const [history, setHistory] = useState<TerminalHistoryItem[]>(() => [
    {
      id: "init",
      command: "crf info",
      output: `CRF Studio Headless Command Engine & Terminal initialized.\nProtocol: ${study.protocolNumber} (${study.forms.length} domains, ${study.visits.length} visits).\nType 'crf wizard' to launch the 5-stage authoring wizard, or 'help' for command matrix.`,
      success: true,
      timestamp: "READY",
    },
  ]);
  const [commandIndex, setCommandIndex] = useState<number>(-1);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { copy: copyOutput, copied } = useClipboard({
    successMessage: "Terminal output copied to clipboard",
    errorMessage: "Failed to copy terminal output",
  });

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus?.(), 100);
      if (typeof bottomRef.current?.scrollIntoView === "function") {
        bottomRef.current.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [isOpen, history]);

  if (!isOpen) return null;

  const handleExecute = (rawCmd: string) => {
    const cmd = rawCmd.trim();
    if (!cmd) return;

    if (cmd === "clear") {
      setHistory([]);
      setInputVal("");
      return;
    }

    const res = executeCliString(study, cmd);
    const plainOutput = stripAnsi(res.document);
    cmdCounterRef.current += 1;

    const newItem: TerminalHistoryItem = {
      id: `cmd_${cmdCounterRef.current}`,
      command: cmd,
      output: plainOutput,
      success: res.success,
      timestamp: "OK",
    };

    setHistory((prev) => [...prev, newItem]);
    setInputVal("");
    setCommandIndex(-1);

    if (res.updatedStudy) {
      onUpdateStudy(res.updatedStudy);
    }

    // Handle UI actions dispatched from terminal CLI
    if (res.uiAction) {
      if (res.uiAction.type === "launch_wizard") {
        if (onOpenWizard) {
          onOpenWizard();
        } else if (onOpenModal) {
          onOpenModal("wizard");
        }
      } else if (res.uiAction.type === "switch_mode" && res.uiAction.payload) {
        onSwitchMode?.(res.uiAction.payload as StudioMode);
      } else if (res.uiAction.type === "open_modal" && res.uiAction.payload) {
        if (res.uiAction.payload === "wizard") {
          onOpenWizard?.();
        } else {
          onOpenModal?.(
            res.uiAction.payload as
              "wizard" | "branding" | "diagnostics" | "export"
          );
        }
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleExecute(inputVal);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length > 0) {
        const nextIdx =
          commandIndex === -1
            ? history.length - 1
            : Math.max(0, commandIndex - 1);
        setCommandIndex(nextIdx);
        setInputVal(history[nextIdx]?.command || "");
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (commandIndex !== -1) {
        const nextIdx = commandIndex + 1;
        if (nextIdx >= history.length) {
          setCommandIndex(-1);
          setInputVal("");
        } else {
          setCommandIndex(nextIdx);
          setInputVal(history[nextIdx]?.command || "");
        }
      }
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  const handleCopyOutput = async (item: TerminalHistoryItem) => {
    setCopiedId(item.id);
    await copyOutput(item.output);
  };

  const QUICK_COMMANDS = [
    "crf wizard",
    "crf info",
    "crf validate",
    "crf list domains",
    "crf preset list",
    "crf add form VS",
    "crf add field VS --var TEMPC --type number --unit C",
    "crf export --format odm",
    "help",
  ];

  return (
    <div
      role="region"
      aria-label="Interactive Clinical Terminal Console"
      className="border-t border-zinc-800 bg-zinc-950 text-zinc-200 flex flex-col h-72 sm:h-80 shadow-2xl relative z-20 animate-in slide-in-from-bottom-5 duration-200 font-mono"
    >
      {/* Terminal Title Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900/90 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-2">
          <IconTerminal2 className="w-4 h-4 text-brand-cyan" />
          <span className="text-xs font-bold text-white tracking-wide">
            CRF Studio Terminal Console
          </span>
          <span className="text-[10px] text-zinc-500 hidden sm:inline">
            • Live Bidirectional Studio Sync
          </span>
        </div>

        {/* Quick Command Chips */}
        <div className="hidden lg:flex items-center gap-1.5 overflow-x-auto max-w-lg scrollbar-none">
          {QUICK_COMMANDS.map((qc) => (
            <button
              key={qc}
              onClick={() => handleExecute(qc)}
              className="px-2 py-0.5 rounded text-[10px] bg-zinc-950 hover:bg-zinc-800 text-zinc-400 hover:text-brand-cyan border border-zinc-800 transition-colors whitespace-nowrap"
            >
              {qc === "crf wizard" ? (
                <span className="inline-flex items-center gap-1 text-sky-400 font-bold">
                  <IconSparkles className="w-2.5 h-2.5" />
                  <span>{qc}</span>
                </span>
              ) : (
                qc
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setHistory([])}
            className="p-1 rounded text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
            title="Clear Console (clear)"
          >
            <IconTrash className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
            title="Close Terminal Drawer (Esc or `)"
          >
            <IconX className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Terminal Output Log Area */}
      <div className="flex-1 p-3 overflow-y-auto space-y-3 text-xs leading-relaxed">
        {history.map((item) => (
          <div key={item.id} className="space-y-1">
            <div className="flex items-center justify-between text-zinc-500 text-[10px]">
              <div className="flex items-center gap-1.5">
                <span className="text-brand-cyan font-bold">crf&gt;</span>
                <span className="text-white font-bold">{item.command}</span>
              </div>
              <div className="flex items-center gap-2">
                <span>{item.timestamp}</span>
                <button
                  onClick={() => handleCopyOutput(item)}
                  className="hover:text-white p-0.5 rounded"
                  title="Copy Output"
                >
                  {copied && copiedId === item.id ? (
                    <IconCheck className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <IconCopy className="w-3 h-3" />
                  )}
                </button>
              </div>
            </div>
            <pre
              className={`p-2 rounded-lg text-[11px] whitespace-pre-wrap font-mono ${
                item.success
                  ? "bg-zinc-900/60 text-zinc-300 border border-zinc-850"
                  : "bg-red-950/30 text-red-300 border border-red-900/40"
              }`}
            >
              {item.output}
            </pre>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Command Input Prompt Bar */}
      <div className="px-3 py-2 bg-zinc-900 border-t border-zinc-850 flex items-center gap-2 shrink-0">
        <span className="text-brand-cyan font-bold text-xs select-none">
          crf&gt;
        </span>
        <input
          ref={inputRef}
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type 'crf wizard', 'crf validate', 'crf list domains', 'crf add form VS'..."
          className="flex-1 bg-transparent text-xs text-white placeholder:text-zinc-600 focus:outline-none font-mono"
        />
        <button
          onClick={() => handleExecute(inputVal)}
          disabled={!inputVal.trim()}
          className="p-1 rounded bg-brand-cyan/20 hover:bg-brand-cyan text-brand-cyan hover:text-black disabled:opacity-30 disabled:pointer-events-none transition-all"
          title="Execute Command (Enter)"
        >
          <IconPlayerPlay className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
