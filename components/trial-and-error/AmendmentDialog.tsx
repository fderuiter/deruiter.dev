"use client";

import React from "react";
import { createPortal } from "react-dom";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import type { AmendmentPreview } from "@/lib/trial-and-error";

interface AmendmentDialogProps {
  preview: AmendmentPreview;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Filing a SAP Amendment (#1086) is irreversible for the run and stales the
 * outputs in hand compiled under the old rulebook, so the dialog spells out
 * the rule change and every output it stales before the player commits. It
 * focuses the safe choice, and Escape keeps the amendment in the tray.
 */
export function AmendmentDialog({
  preview,
  onConfirm,
  onCancel,
}: AmendmentDialogProps) {
  const ref = useFocusTrap<HTMLDivElement>(true, { onEscape: onCancel });
  const { staled } = preview;
  return createPortal(
    <div
      data-te-cabinet=""
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
    >
      <div
        ref={ref}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="amendment-heading"
        aria-describedby="amendment-consequence"
        className="max-h-dvh w-full max-w-md overflow-y-auto border border-amber-400/60 bg-[color:var(--te-surface-0)] p-4 font-mono text-[color:var(--te-text)]"
        data-testid="amendment-dialog"
      >
        <h2
          id="amendment-heading"
          className="text-sm font-bold uppercase tracking-wider text-amber-300 break-words"
        >
          File {preview.name}?
        </h2>
        <div
          id="amendment-consequence"
          className="mt-2 space-y-2 text-xs text-zinc-300 break-words"
        >
          <p>
            {preview.fromId} becomes {preview.toId} for the rest of the run.{" "}
            {preview.ruleLabel} rule {preview.ruleId}: correcting it earns +
            {preview.bonus.from} → +{preview.bonus.to} Mult, and a standing
            redline costs −{preview.penalty.from} → −{preview.penalty.to} Mult.
          </p>
          {staled.length > 0 ? (
            <>
              <p className="text-rose-300">
                {staled.length} output{staled.length === 1 ? "" : "s"} in hand
                compiled under {preview.fromId} will go stale and score 0 Chips
                until recompiled:
              </p>
              <ul
                className="list-disc pl-5 text-rose-200"
                data-testid="amendment-staled"
              >
                {staled.map((card) => (
                  <li key={card.cardId}>{card.name}</li>
                ))}
              </ul>
            </>
          ) : (
            <p>No output in hand was compiled under {preview.fromId}.</p>
          )}
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[48px] border border-zinc-600 px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-200 touch-manipulation hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 active:scale-[0.98]"
          >
            Keep in tray [Esc]
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="min-h-[48px] border border-amber-400 bg-amber-500/10 px-4 py-3 text-xs font-bold uppercase tracking-wider text-amber-300 touch-manipulation hover:bg-amber-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 active:scale-[0.98]"
            data-testid="amendment-confirm"
          >
            File amendment
          </button>
        </div>
      </div>
    </div>,
    document.fullscreenElement ?? document.body
  );
}
