"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { IconPlayerPlay, IconRefresh } from "@tabler/icons-react";
import {
  RUN_SAVE_KEY,
  clearRun,
  parseRunSave,
  requestRunResume,
  type RetroLabyrinthRunSave,
} from "@/lib/retro-labyrinth";
import { STORAGE_CHANGE_EVENT, safeGetRawItem } from "@/lib/safe-storage";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(STORAGE_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(STORAGE_CHANGE_EVENT, onChange);
  };
}

/**
 * The saved Retro Labyrinth run, if one can be resumed (#3466). The server
 * render and the first client render see none, so the Launch screen
 * hydrates the same either way.
 */
export function useSavedRun(): RetroLabyrinthRunSave | null {
  const raw = useSyncExternalStore(
    subscribe,
    () => safeGetRawItem(RUN_SAVE_KEY),
    () => null
  );
  return useMemo(() => (raw === null ? null : parseRunSave(raw)), [raw]);
}

/** The room a save resumes in, as the Resume button names it. */
function resumeLabel(save: RetroLabyrinthRunSave): string {
  const room = save.roomIndex + 1;
  return save.runLength
    ? `Resume run (Room ${room} of ${save.runLength})`
    : `Resume run (Room ${room})`;
}

/**
 * The Launch screen's choice when a run is saved (#3466): resume it in the
 * room it was saved in, or start a new run after confirming that the saved
 * one is discarded.
 */
export function RunResumeChoice({
  launch,
  prefetch,
}: {
  launch: () => void;
  prefetch: () => void;
}) {
  const save = useSavedRun();
  const [confirming, setConfirming] = useState(false);
  const keepRef = useRef<HTMLButtonElement>(null);

  // Focus moves to the safe answer when the question appears, so it is not
  // lost with the New run button.
  useEffect(() => {
    if (confirming) keepRef.current?.focus();
  }, [confirming]);

  if (!save) return null;

  if (confirming) {
    return (
      <div
        role="group"
        aria-labelledby="retro-labyrinth-discard-question"
        className="flex flex-col gap-2 font-mono text-xs"
      >
        <p id="retro-labyrinth-discard-question" className="text-zinc-200">
          Start a new run? The saved run in Room {save.roomIndex + 1} is
          discarded.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="min-h-12 px-4 rounded-xl border border-rose-500/50 bg-rose-500/10 text-rose-200 font-bold uppercase tracking-wider hover:bg-rose-500/20"
            onClick={() => {
              clearRun();
              launch();
            }}
          >
            Discard and start
          </button>
          <button
            ref={keepRef}
            type="button"
            className="min-h-12 px-4 rounded-xl border border-zinc-700 bg-zinc-900 text-zinc-200 font-bold uppercase tracking-wider hover:bg-zinc-800"
            onClick={() => setConfirming(false)}
          >
            Keep my run
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2 sm:flex-row">
      <button
        type="button"
        onMouseEnter={prefetch}
        onFocus={prefetch}
        onClick={() => {
          requestRunResume(save);
          launch();
        }}
        className="min-h-12 px-6 py-3 arcade-launch-button text-black font-extrabold rounded-xl border-b-4 hover:border-b-2 active:border-b-0 active:translate-y-1 active:scale-95 transition-all duration-75 flex items-center justify-center gap-2 font-mono text-xs sm:text-sm tracking-wider uppercase cursor-pointer touch-manipulation select-none"
      >
        <IconPlayerPlay
          className="w-4 h-4 fill-black text-black"
          aria-hidden="true"
        />
        <span>{resumeLabel(save)}</span>
      </button>
      <button
        type="button"
        onMouseEnter={prefetch}
        onClick={() => setConfirming(true)}
        className="min-h-12 px-4 rounded-xl border border-zinc-700 bg-zinc-950 text-zinc-200 font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-zinc-900 active:scale-[0.98]"
      >
        <IconRefresh className="w-4 h-4" aria-hidden="true" />
        <span>New run</span>
      </button>
    </div>
  );
}
