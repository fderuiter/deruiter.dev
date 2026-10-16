"use client";

import React from "react";
import { useTerminology } from "@/components/providers/TerminologyProvider";

export function TerminologyToggle() {
  // Underlying state is managed via: usePersistentState("simplified-terminology", false)
  const { simplified, setSimplified } = useTerminology();

  return (
    <div className="flex items-center gap-3 bg-zinc-900/40 border border-zinc-800/80 px-3 py-1.5 rounded-lg select-none">
      <span className="text-xs font-mono font-medium text-neutral-400">
        Simplified Terminology
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={simplified}
        aria-label="Toggle simplified terminology"
        onClick={() => setSimplified((prev) => !prev)}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 ${
          simplified ? "bg-accent" : "bg-zinc-800"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-zinc-100 shadow ring-0 transition duration-200 ease-in-out ${
            simplified ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
