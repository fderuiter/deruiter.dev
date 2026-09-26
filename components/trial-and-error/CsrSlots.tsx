import React from "react";
import type { PackageSlot } from "@/lib/trial-and-error";

interface CsrSlotsProps {
  slots: PackageSlot[];
  /** Each selected card's short name, by id. */
  names: Record<string, string>;
}

/**
 * CSR Lock's five sequence slots (#922), left to right in pipeline order.
 * Selected cards fill them in selection order; a slot that breaks the
 * Straight says which card breaks it and why. It renders the view's
 * reconciliation only.
 */
export function CsrSlots({ slots, names }: CsrSlotsProps) {
  const firstBreak = slots.find((s) => s.status !== "OK");
  return (
    <div className="mt-1 min-w-0" data-testid="csr-slots">
      <ol
        aria-label="CSR Straight slots, in pipeline order"
        className="grid grid-cols-2 gap-1 sm:grid-cols-5"
      >
        {slots.map((slot, i) => {
          const ok = slot.status === "OK";
          const empty = slot.cardId === null;
          const name = slot.cardId ? (names[slot.cardId] ?? slot.cardId) : null;
          return (
            <li
              key={slot.stage}
              data-slot={slot.stage}
              data-status={slot.status}
              aria-current={slot === firstBreak ? "step" : undefined}
              className={`min-w-0 border p-1.5 text-[10px] ${
                ok
                  ? "border-emerald-500/70 text-emerald-200"
                  : empty
                    ? "border-dashed border-zinc-700 text-zinc-400"
                    : "border-rose-400/70 text-rose-200"
              }`}
            >
              <span className="block font-bold uppercase tracking-wider">
                {i + 1}. {slot.label}
              </span>
              <span className="block break-words">
                {name ?? "Empty"}
                <span className="sr-only">
                  {ok ? ", reconciled" : empty ? "" : ", breaks the Straight"}
                </span>
              </span>
              {!empty && (
                <span
                  aria-hidden="true"
                  className="block font-bold uppercase tracking-wider"
                >
                  {ok ? "✓ Reconciled" : slot.status.replace("_", " ")}
                </span>
              )}
            </li>
          );
        })}
      </ol>
      {firstBreak && firstBreak.cardId !== null && (
        <p
          className="mt-1 text-[11px] text-rose-200 break-words"
          data-testid="csr-slot-break"
        >
          {firstBreak.reason}
        </p>
      )}
    </div>
  );
}
