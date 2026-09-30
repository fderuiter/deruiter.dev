"use client";

import React, { useEffect, useRef } from "react";
import { CompilerLogEntry } from "@/lib/quasi-perfect/types";

interface TerminalLogProps {
  logs: CompilerLogEntry[];
}

export const TerminalLog: React.FC<TerminalLogProps> = ({ logs }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="w-full rounded-xl border border-zinc-800 bg-black/90 font-mono overflow-hidden shadow-inner">
      {/* Terminal Title Bar */}
      <div className="flex items-center justify-between border-b border-zinc-800/80 bg-zinc-950 px-3 py-1.5 text-[10px] text-zinc-400">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-rose-500/70" />
          <span className="w-2 h-2 rounded-full bg-amber-500/70" />
          <span className="w-2 h-2 rounded-full bg-emerald-500/70" />
          <span className="ml-2 font-bold text-zinc-400">
            Local Tactic Simulator
          </span>
        </div>
        <span>Interactive Proof TTY</span>
      </div>

      {/* Log Output Area */}
      <div
        ref={containerRef}
        aria-live="polite"
        className="p-3 max-h-36 min-h-[90px] overflow-y-auto space-y-1 text-xs select-text scrollbar-thin scrollbar-thumb-zinc-800"
      >
        {logs.map((log) => {
          let textStyle = "text-zinc-300";
          let prefix = ">";

          if (log.type === "error") {
            textStyle = "text-rose-400 font-semibold";
            prefix = "✖";
          } else if (log.type === "warning") {
            textStyle = "text-amber-400 font-medium";
            prefix = "▲";
          } else if (log.type === "success") {
            textStyle = "text-emerald-400 font-semibold";
            prefix = "✔";
          } else {
            textStyle = "text-zinc-400";
          }

          return (
            <div
              key={log.id}
              className="flex items-start gap-2 leading-relaxed"
            >
              <span className="text-zinc-400 shrink-0 select-none text-[10px]">
                {log.timestamp}
              </span>
              <span className={`${textStyle} shrink-0 select-none`}>
                {prefix}
              </span>
              <span className={`${textStyle} break-words`}>{log.text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
