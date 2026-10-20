"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import type { PauseMenuItem, PauseReason } from "./pause-controller";

/** Props for {@link PauseOverlay}. */
export interface PauseOverlayProps {
  readonly open: boolean;
  readonly reasons: ReadonlySet<PauseReason>;
  /** A bottom sheet on a phone, a centred card elsewhere. */
  readonly layout: "sheet" | "card";
  readonly onResume: () => void;
  readonly onRestart?: () => void;
  readonly onSettings?: () => void;
  readonly onExit?: () => void;
  /** The game's instructions, shown under How to play. */
  readonly howToPlay?: ReactNode;
  /** The game's own items, after the cabinet's. */
  readonly items?: readonly PauseMenuItem[];
  /** True after a second Escape: Exit takes focus and the overlay says so. */
  readonly exitOffered?: boolean;
  /**
   * Where focus goes on close when the control focused before the pause is
   * gone, such as after a view swap.
   */
  readonly returnFocusTo?: RefObject<HTMLElement | null>;
}

const REASON_COPY: ReadonlyArray<readonly [PauseReason, string]> = [
  ["view-swap", "Paused while the layout changed."],
  ["rotate", "Paused while the screen turned."],
  ["hidden", "Paused while you were away."],
  ["blur", "Paused when the window lost focus."],
  ["user", "Paused."],
];

/** The line under the title that says why the game stopped. */
export function pauseReasonCopy(reasons: ReadonlySet<PauseReason>): string {
  return REASON_COPY.find(([reason]) => reasons.has(reason))?.[1] ?? "Paused.";
}

const BUTTON =
  "w-full rounded-xl border px-4 py-2 text-left font-mono text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 active:scale-[0.98] touch-manipulation";
const QUIET = `${BUTTON} border-zinc-800 bg-[#13151a] text-zinc-200 hover:border-zinc-600`;

/**
 * The cabinet's one pause overlay (#2357): Resume, Restart, How to play,
 * Settings and Exit, plus any items the game adds. It is a bottom sheet on a
 * phone and a centred card elsewhere. It traps focus and opens on Resume, and
 * an automatic pause waits here for the player rather than resuming itself.
 */
export function PauseOverlay({
  open,
  reasons,
  layout,
  onResume,
  onRestart,
  onSettings,
  onExit,
  howToPlay,
  items = [],
  exitOffered = false,
  returnFocusTo,
}: PauseOverlayProps) {
  const titleId = useId();
  const resumeRef = useRef<HTMLButtonElement>(null);
  const exitRef = useRef<HTMLButtonElement>(null);
  const [showHelp, setShowHelp] = useState(false);
  const trapRef = useFocusTrap<HTMLDivElement>(open, {
    initialFocusRef: resumeRef,
    returnFocusTo,
    preventScroll: true,
  });

  // Each opening starts with the help folded away.
  const [openedAs, setOpenedAs] = useState(open);
  if (openedAs !== open) {
    setOpenedAs(open);
    if (!open) setShowHelp(false);
  }

  useEffect(() => {
    if (open && exitOffered) exitRef.current?.focus({ preventScroll: true });
  }, [open, exitOffered]);

  if (!open) return null;

  const sheet = layout === "sheet";
  return (
    <div
      data-testid="pause-overlay"
      data-pause-layout={layout}
      className={`absolute inset-0 z-40 flex bg-black/70 ${
        sheet ? "items-end" : "items-center justify-center p-4"
      }`}
    >
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-pause-overlay=""
        className={`flex max-h-full w-full min-w-0 flex-col gap-3 overflow-y-auto border border-zinc-800 bg-[#0d0e11] p-4 text-[#f4f4f6] ${
          sheet
            ? "rounded-t-2xl pb-[calc(1rem+env(safe-area-inset-bottom,0px))]"
            : "max-w-sm rounded-2xl"
        }`}
      >
        <div className="min-w-0">
          <h2
            id={titleId}
            className="font-mono text-lg font-bold tracking-[-0.035em]"
          >
            Paused
          </h2>
          <p className="font-mono text-sm text-zinc-300">
            {pauseReasonCopy(reasons)}
          </p>
        </div>
        <button
          ref={resumeRef}
          type="button"
          onClick={onResume}
          className={`min-h-12 ${BUTTON} border-amber-500/60 bg-amber-500/10 font-bold text-amber-300 hover:bg-amber-500/20`}
        >
          Resume
        </button>
        {onRestart ? (
          <button
            type="button"
            onClick={onRestart}
            className={`min-h-12 ${QUIET}`}
          >
            Restart
          </button>
        ) : null}
        {howToPlay ? (
          <>
            <button
              type="button"
              aria-expanded={showHelp}
              onClick={() => setShowHelp((shown) => !shown)}
              className={`min-h-12 ${QUIET}`}
            >
              How to play
            </button>
            {showHelp ? (
              <div className="min-w-0 break-words font-mono text-sm text-zinc-300">
                {howToPlay}
              </div>
            ) : null}
          </>
        ) : null}
        {onSettings ? (
          <button
            type="button"
            onClick={onSettings}
            className={`min-h-12 ${QUIET}`}
          >
            Settings
          </button>
        ) : null}
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={item.onSelect}
            className={`min-h-12 ${QUIET}`}
          >
            {item.label}
          </button>
        ))}
        {exitOffered ? (
          <p role="status" className="font-mono text-sm text-zinc-300">
            Leave the game? Choose Exit, or Resume to keep playing.
          </p>
        ) : null}
        {onExit ? (
          <button
            ref={exitRef}
            type="button"
            onClick={onExit}
            className={`min-h-12 ${BUTTON} border-zinc-800 bg-[#13151a] text-red-300 hover:border-red-500/60`}
          >
            Exit
          </button>
        ) : null}
      </div>
    </div>
  );
}
