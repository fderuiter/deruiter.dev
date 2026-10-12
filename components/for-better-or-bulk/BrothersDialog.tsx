"use client";

/**
 * The text from Fred's brothers. The clock stops until he answers, and the
 * answer changes the level: staying keeps him on the lawn, a break needs a
 * promise about what he comes back for, and leaving is leaving.
 */

import React, { useEffect, useRef, useState } from "react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import {
  BREAK_SECONDS,
  LEAVE_SECONDS,
  availableCommitments,
  clockLabel,
  heldLabel,
  onLevelClock,
  type Commitment,
  type GameState,
  type PresenceDecision,
} from "@/lib/for-better-or-bulk";

/**
 * How long after the text opens that the keyboard cannot choose. A press of
 * the interact key that was already on its way (round 8, B1) must not answer
 * a text the player has not read yet. Mouse clicks are not delayed.
 */
const SETTLE_MS = 500;

/** The keys that would activate an option by accident during the settle time. */
const SETTLE_KEYS: ReadonlySet<string> = new Set(["Enter", " ", "e", "E"]);

/**
 * The resting look of every option in the text. The three answers share it, so
 * no option is highlighted before the player moves to it: only focus and hover
 * change the look (round 9, brothers dialog). The disabled state is a variant,
 * so it applies only when the break has nothing to promise, and the hover
 * highlight is limited to enabled options (`enabled:hover:`), so a disabled
 * option never lights up.
 */
const OPTION_CLASS =
  "min-h-11 rounded border border-[var(--fbb-control)] px-3 text-left text-xs font-bold active:scale-[0.98] enabled:hover:border-[var(--fbb-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fbb-focus)] disabled:opacity-40";

const COMMITMENT_LABELS: Readonly<Record<Commitment, string>> = {
  chairs: "The chairs",
  lanterns: "The lanterns",
  buffet: "The buffet",
  flowers: "The flowers",
};

interface BrothersDialogProps {
  state: GameState;
  onDecide: (decision: PresenceDecision) => void;
}

/** What Abbi is doing with her hands, read from the level as it stands. */
function abbiLine(state: GameState): string {
  const held = state.players.abbi.holding;
  return held
    ? `Abbi is carrying ${heldLabel(held)} and looking at him.`
    : "Abbi has her hands free and is looking at him.";
}

/** Fred's mood, read from the level as it stands. */
function fredLine(state: GameState): string {
  return state.players.fred.calm
    ? "Fred has calmed down."
    : "Fred has not calmed down yet.";
}

export function BrothersDialog({ state, onDecide }: BrothersDialogProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const openedAt = useRef<number | null>(null);
  const [promising, setPromising] = useState(false);
  const dialogRef = useFocusTrap<HTMLDivElement>(true, {
    initialFocusRef: headingRef,
  });
  const commitments = availableCommitments(state);

  useEffect(() => {
    openedAt.current = Date.now();
  }, []);

  // Focus the heading as the text opens. This effect is declared after
  // useFocusTrap, so the trap records the element focused before the dialog
  // (the game boundary) as its restore target, not the heading. The trap's own
  // initial focus waits 50 ms, and this moves focus at once (#1963).
  // When the options change (a break swaps them out), focus moves back to the
  // heading only if it was lost to the page or sits inside the dialog.
  const openedOnce = useRef(false);
  useEffect(() => {
    const opening = !openedOnce.current;
    openedOnce.current = true;
    const dialog = dialogRef.current;
    const active = document.activeElement;
    const lost = !active || active === document.body;
    const inside = !!dialog && !!active && dialog.contains(active);
    if (opening || lost || inside)
      headingRef.current?.focus({ preventScroll: true });
  }, [promising, dialogRef]);

  /** Swallows a settle-time key so it cannot activate the focused option. */
  const settling = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!SETTLE_KEYS.has(event.key)) return;
    const opened = openedAt.current;
    if (opened !== null && Date.now() - opened < SETTLE_MS) {
      event.preventDefault();
    }
  };

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[rgba(13,14,17,0.72)] p-3">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="fbb-brothers-title"
        aria-describedby="fbb-brothers-body"
        data-testid="fbb-brothers"
        onKeyDown={settling}
        onKeyUp={settling}
        className="w-full max-w-md rounded border border-[var(--fbb-control)] bg-[var(--fbb-panel)] p-4 font-mono text-[var(--fbb-text)] shadow-2xl"
      >
        <h2
          ref={headingRef}
          tabIndex={-1}
          id="fbb-brothers-title"
          className="text-base font-extrabold focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fbb-focus)]"
        >
          Text from Fred&apos;s brothers
        </h2>
        <p
          id="fbb-brothers-body"
          className="mt-2 text-xs text-[var(--fbb-dim)]"
        >
          &quot;Breakfast? You look like you need to get out of there for a
          bit.&quot; {fredLine(state)} {abbiLine(state)}
        </p>
        {!promising ? (
          <div className="mt-4 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => onDecide({ choice: "stay", commitment: null })}
              className={OPTION_CLASS}
            >
              Stay and help. (He will keep stopping to retie a shoelace.)
            </button>
            <button
              type="button"
              disabled={commitments.length === 0}
              onClick={() => setPromising(true)}
              className={OPTION_CLASS}
            >
              Take a short break and promise to come back for something.
            </button>
            <button
              type="button"
              onClick={() => onDecide({ choice: "leave", commitment: null })}
              className={OPTION_CLASS}
            >
              Go with them. (Back around{" "}
              {clockLabel(
                state.time + onLevelClock(LEAVE_SECONDS, state.duration),
                state.duration
              )}
              . Whatever he carries is set down on the floor near him. Abbi
              works alone until Fred is back. The website is up.)
            </button>
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-2">
            <p className="text-xs">
              Back around{" "}
              {clockLabel(
                state.time + onLevelClock(BREAK_SECONDS, state.duration),
                state.duration
              )}
              , calmer. What does Fred promise to come back for?
            </p>
            {commitments.map((commitment) => (
              <button
                key={commitment}
                type="button"
                onClick={() => onDecide({ choice: "break", commitment })}
                className={OPTION_CLASS}
              >
                {COMMITMENT_LABELS[commitment]}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPromising(false)}
              className="min-h-11 rounded px-3 text-left text-xs text-[var(--fbb-dim)] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fbb-focus)]"
            >
              Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
