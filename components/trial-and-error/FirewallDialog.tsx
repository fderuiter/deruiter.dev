"use client";

import React from "react";
import { createPortal } from "react-dom";
import {
  closeNow,
  useClaimFocus,
  usePortalTarget,
} from "@/components/trial-and-error/sheet-host";
import { useFocusTrap } from "@/hooks/useFocusTrap";

interface FirewallDialogProps {
  /** The face-down output the player tried to view, e.g. "Table 14.1.1". */
  cardName: string;
  /** The charter that governs the closed session, when the Blind has a DMC. */
  charter: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * The DMC firewall's peek friction (T&E-08): viewing a face-down output in
 * the open session is an unauthorized unblinding. The dialog spells out the
 * audit consequence before the player commits, and focuses the safe choice.
 * Escape keeps the card blinded.
 */
export function FirewallDialog({
  cardName,
  charter,
  onConfirm,
  onCancel,
}: FirewallDialogProps) {
  const portalTarget = usePortalTarget();
  const ref = useFocusTrap<HTMLDivElement>(true, {
    onEscape: closeNow(onCancel),
  });
  useClaimFocus(ref);
  return createPortal(
    <div
      data-te-cabinet=""
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
    >
      <div
        ref={ref}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="firewall-heading"
        aria-describedby="firewall-consequence"
        className="w-full max-w-md border border-rose-400/60 bg-[color:var(--te-surface-0)] p-4 font-mono text-[color:var(--te-text)]"
        data-testid="firewall-dialog"
      >
        <h2
          id="firewall-heading"
          className="text-sm font-bold uppercase tracking-wider text-rose-300 break-words"
        >
          Unblind {cardName}?
        </h2>
        <p
          id="firewall-consequence"
          className="mt-2 text-xs text-zinc-300 break-words"
        >
          {cardName} is a closed-session output. Viewing it in the open session
          is an unauthorized unblinding: it is logged to the DMC access history
          as an audit finding, and the next hand you play scores ×0 Mult.
          {charter
            ? ` To see it without penalty, run structural QC and convene the closed session under ${charter}.`
            : ""}
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[48px] border border-zinc-600 px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-200 touch-manipulation hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 active:scale-[0.98]"
          >
            Keep blinded [Esc]
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="min-h-[48px] border border-rose-400 bg-rose-500/10 px-4 py-3 text-xs font-bold uppercase tracking-wider text-rose-300 touch-manipulation hover:bg-rose-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 active:scale-[0.98]"
            data-testid="firewall-confirm"
          >
            Unblind (×0 Mult)
          </button>
        </div>
      </div>
    </div>,
    portalTarget
  );
}
