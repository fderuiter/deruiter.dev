"use client";

import React, { useRef } from "react";
import { useFocusTrap } from "@/hooks/useFocusTrap";

const CONTROLS: Array<{ keys: string; action: string }> = [
  { keys: "W A S D or arrow keys", action: "Walk around the floor" },
  { keys: "E", action: "Use what you face, or talk to whoever is there" },
  { keys: "F", action: "Ask yourself how it is going" },
  { keys: "Office directory", action: "Walk to a place without steering" },
];

/**
 * First-run help for the walkable office: how to move, how to act, and
 * what a day is. It is a dialog, so focus stays inside it and Escape or
 * the button closes it; the Controls button on the stage opens it again.
 */
export const WorldIntro: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const startRef = useRef<HTMLButtonElement>(null);
  const trapRef = useFocusTrap<HTMLDivElement>(true, {
    initialFocusRef: startRef,
    onEscape: onClose,
  });
  return (
    <div
      key="world-intro"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
    >
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sd-world-intro-title"
        data-testid="world-intro"
        className="max-h-full w-full max-w-lg overflow-y-auto border border-[var(--sd-hairline-strong)] bg-[var(--sd-surface)] p-5 font-mono text-[var(--sd-text)]"
      >
        <h2 id="sd-world-intro-title" className="text-base font-bold">
          Welcome to the CRO floor
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-zinc-300">
          You run one clinical study. Each day starts at 8:00 and every action
          costs minutes and energy. Walk the floor, talk to your team, answer
          the phone, and go home when you run out of day. Everything is fine.
        </p>
        <dl className="mt-4 space-y-2 text-xs">
          {CONTROLS.map((row) => (
            <div
              key={row.keys}
              className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] gap-3"
            >
              <dt className="font-bold break-words text-[var(--sd-amber)]">
                {row.keys}
              </dt>
              <dd className="break-words text-zinc-200">{row.action}</dd>
            </div>
          ))}
        </dl>
        <button
          ref={startRef}
          type="button"
          onClick={onClose}
          className="mt-5 min-h-12 w-full border border-[var(--sd-amber)] bg-[var(--sd-amber)]/10 px-4 text-sm font-bold text-amber-300 hover:bg-[var(--sd-amber)]/20 active:scale-[0.98]"
        >
          Start the day
        </button>
      </div>
    </div>
  );
};
