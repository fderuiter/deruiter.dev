"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  IconAlertTriangle,
  IconPlayerPause,
  IconPlayerPlay,
  IconRefresh,
  IconX,
} from "@tabler/icons-react";
import { useFocusTrap } from "@/hooks/useFocusTrap";

type RunEndingAction = "restart" | "exit";

interface PauseMenuProps {
  /** Current run score. Above 0, Restart and Exit ask before ending the run. */
  score: number;
  actNum: number;
  onResume: () => void;
  onRestart: () => void;
  onExit: () => void;
}

const SECONDARY_BUTTON =
  "min-h-[44px] min-w-[44px] w-full px-6 py-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-xl border border-neutral-700 transition-all flex items-center justify-center gap-2 cursor-pointer focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:outline-none";

/**
 * The Laser Loon pause dialog. Restart and Exit end the run, so when the run
 * has scored they ask first (#1551): a stray fire click used to land on Exit
 * and drop a 1570-point run. Focus stays trapped in the dialog, and Esc backs
 * out of the confirmation before it resumes the game.
 */
export function PauseMenu({
  score,
  actNum,
  onResume,
  onRestart,
  onExit,
}: PauseMenuProps) {
  const [pending, setPending] = useState<RunEndingAction | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const restartRef = useRef<HTMLButtonElement>(null);
  const exitRef = useRef<HTMLButtonElement>(null);
  // Where focus goes back to when the confirmation is cancelled.
  const returnFocusRef = useRef<RunEndingAction | null>(null);

  function cancel() {
    returnFocusRef.current = pending;
    setPending(null);
  }

  function request(action: RunEndingAction) {
    if (score <= 0) {
      if (action === "restart") onRestart();
      else onExit();
      return;
    }
    setPending(action);
  }

  function confirm() {
    if (pending === "restart") onRestart();
    else if (pending === "exit") onExit();
  }

  const trapRef = useFocusTrap<HTMLDivElement>(true, {
    onEscape: () => {
      if (pending) {
        cancel();
      } else {
        onResume();
      }
    },
  });

  useEffect(() => {
    if (pending) {
      cancelRef.current?.focus();
      return;
    }
    const back = returnFocusRef.current;
    returnFocusRef.current = null;
    if (back === "restart") restartRef.current?.focus();
    else if (back === "exit") exitRef.current?.focus();
  }, [pending]);

  return (
    <div
      ref={trapRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="laser-loon-pause-title"
      className="max-w-md w-full bg-neutral-900/95 border border-red-500/40 rounded-3xl p-6 shadow-2xl flex flex-col items-center my-auto"
    >
      <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-3 text-red-400">
        {pending ? (
          <IconAlertTriangle className="w-7 h-7" />
        ) : (
          <IconPlayerPause className="w-7 h-7" />
        )}
      </div>
      <h3
        id="laser-loon-pause-title"
        className="text-2xl font-bold text-white font-mono tracking-tight mb-1"
      >
        {pending ? "END THIS RUN?" : "GAME PAUSED"}
      </h3>
      <p
        id="laser-loon-pause-detail"
        className="text-xs text-neutral-400 mb-6 font-mono"
      >
        {pending
          ? `Your score of ${score} will be lost.`
          : `Act ${actNum} campaign session paused.`}
      </p>

      {pending ? (
        <div className="flex flex-col gap-3 w-full font-mono text-xs font-bold">
          <button
            ref={cancelRef}
            type="button"
            onClick={cancel}
            className="min-h-[44px] min-w-[44px] w-full px-6 py-3 bg-red-500 hover:bg-red-400 text-white rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
          >
            <span>KEEP THIS RUN [ESC]</span>
          </button>
          <button
            type="button"
            onClick={confirm}
            aria-describedby="laser-loon-pause-detail"
            className={SECONDARY_BUTTON}
          >
            {pending === "restart" ? (
              <IconRefresh className="w-4 h-4 text-red-400" />
            ) : (
              <IconX className="w-4 h-4 text-red-500" />
            )}
            <span>
              {pending === "restart"
                ? "YES, RESTART CAMPAIGN"
                : "YES, EXIT TO CABINET MENU"}
            </span>
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3 w-full font-mono text-xs font-bold">
          <button
            type="button"
            onClick={onResume}
            className="min-h-[44px] min-w-[44px] w-full px-6 py-3 bg-red-500 hover:bg-red-400 text-white rounded-xl shadow-[0_0_20px_rgba(239,68,68,0.4)] transition-all flex items-center justify-center gap-2 cursor-pointer focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
          >
            <IconPlayerPlay className="w-4 h-4 fill-current" />
            <span>RESUME GAME [P / SPACE]</span>
          </button>

          <button
            ref={restartRef}
            type="button"
            onClick={() => request("restart")}
            className={SECONDARY_BUTTON}
          >
            <IconRefresh className="w-4 h-4 text-red-400" />
            <span>RESTART CAMPAIGN</span>
          </button>

          <button
            ref={exitRef}
            type="button"
            onClick={() => request("exit")}
            className="min-h-[44px] min-w-[44px] w-full px-6 py-3 bg-neutral-950 hover:bg-neutral-900 text-neutral-400 hover:text-white rounded-xl border border-neutral-800 transition-all flex items-center justify-center gap-2 cursor-pointer focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:outline-none"
          >
            <IconX className="w-4 h-4 text-red-500" />
            <span>EXIT TO CABINET MENU</span>
          </button>
        </div>
      )}

      <div className="mt-6 pt-4 border-t border-neutral-800 w-full text-[10px] font-mono text-neutral-500 flex justify-around flex-wrap gap-2">
        <span>WASD: Move</span>
        <span>Click: Fire</span>
        <span>1-4: Optics</span>
        <span>U: Tremolo</span>
      </div>
    </div>
  );
}
