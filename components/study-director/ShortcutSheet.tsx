"use client";

import React from "react";
import { useFocusTrap } from "@/hooks/useFocusTrap";

/** Every key the desk answers to, in the order a day is played. */
const SHORTCUTS: Array<{ keys: string[]; action: string }> = [
  { keys: ["1", "–", "5"], action: "Choose an option on the open message" },
  { keys: ["D"], action: "Toggle documenting the decision" },
  { keys: ["J", "K"], action: "Next or previous message" },
  { keys: ["↓", "↑"], action: "Next or previous message" },
  { keys: ["E"], action: "End the day" },
  { keys: ["N"], action: "Skip to the next message when the inbox is empty" },
  { keys: ["Esc"], action: "Dismiss the last outcome" },
  { keys: ["?"], action: "Show or hide this sheet" },
];

/** A modal list of the desk's keyboard shortcuts. */
export const ShortcutSheet: React.FC<{ onClose: () => void }> = ({
  onClose,
}) => {
  const closeRef = React.useRef<HTMLButtonElement>(null);
  const trapRef = useFocusTrap<HTMLDivElement>(true, {
    initialFocusRef: closeRef,
    onEscape: onClose,
  });
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sd-shortcuts-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "?") {
            e.preventDefault();
            onClose();
          }
        }}
        className="sd-enter w-full max-w-md border border-[var(--sd-hairline-strong)] bg-[var(--sd-surface)] p-5 font-mono text-[var(--sd-text)]"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id="sd-shortcuts-title" className="text-sm font-bold">
            Keyboard shortcuts
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="min-h-[36px] border border-zinc-700 px-3 text-xs hover:border-[var(--sd-amber)]"
          >
            Close
          </button>
        </div>
        <dl className="mt-4 space-y-2 text-xs">
          {SHORTCUTS.map((s) => (
            <div
              key={s.action + s.keys.join()}
              className="flex items-start justify-between gap-4"
            >
              <dt className="flex shrink-0 gap-1">
                {s.keys.map((k) =>
                  k === "–" ? (
                    <span key={k} className="text-[var(--sd-muted)]">
                      to
                    </span>
                  ) : (
                    <kbd
                      key={k}
                      className="min-w-[1.5rem] border border-zinc-600 px-1.5 text-center text-zinc-200"
                    >
                      {k}
                    </kbd>
                  )
                )}
              </dt>
              <dd className="text-right text-zinc-300">{s.action}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
};
