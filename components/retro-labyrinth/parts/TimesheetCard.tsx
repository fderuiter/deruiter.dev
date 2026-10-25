"use client";

import React from "react";
import { IconCheck, IconFileText } from "@tabler/icons-react";
import { useLabyrinthSession } from "@/components/retro-labyrinth/RetroLabyrinthSession";

/**
 * The Billable Hours timesheet the Darknet Vault's chest asks for (#2376).
 * Shown while the room waits on it.
 */
export function TimesheetCard({
  onSubmitted,
}: {
  /** Called after the timesheet is submitted, to refocus the board. */
  readonly onSubmitted: () => void;
}) {
  const { session } = useLabyrinthSession();
  const { view, intents } = session;
  const { gameStatus } = view;
  return (
    <>
      {/* Billable Hours Timesheet Modal (Room 4) */}
      {gameStatus === "timesheet" && (
        <div className="absolute inset-0 bg-neutral-950/95 backdrop-blur-sm flex flex-col items-center justify-center text-center p-3 rounded-lg border border-amber-500/40 z-40">
          <div className="w-7 h-7 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-1 text-amber-400">
            <IconFileText className="w-4 h-4" />
          </div>
          <h2 className="text-amber-400 font-bold text-xs uppercase tracking-wider">
            BILLABLE HOURS INTERRUPT
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5 leading-tight">
            Opening this abandoned repo chest requires logging 0.25h of admin
            work.
          </p>
          <div className="w-full max-w-[210px] bg-neutral-900/90 border border-neutral-800 rounded p-1.5 my-1.5 text-left text-xs space-y-0.5 text-neutral-300">
            <div>
              CLIENT: <span className="text-zinc-100">Abandoned Repos LLC</span>
            </div>
            <div>
              TASK:{" "}
              <span className="text-amber-300">
                JIRA-404: Refactor Legacy Rust
              </span>
            </div>
            <div>
              HOURS:{" "}
              <span className="text-emerald-400 font-bold">
                0.25 hrs (Admin)
              </span>
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              intents.submitTimesheet();
              onSubmitted();
            }}
            className="inline-flex items-center gap-1 px-3 py-1 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold rounded-md transition-all cursor-pointer shadow-md"
          >
            <IconCheck className="w-3 h-3" />
            Submit Timesheet & Open Vault [ENTER]
          </button>
        </div>
      )}
    </>
  );
}
