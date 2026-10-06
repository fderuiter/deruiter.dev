"use client";

import React from "react";
import {
  MODIFIER_LABELS,
  formatClock,
  type KdsBand,
  type KdsTicket,
} from "@/lib/patty-drive-thru";
import { useTickets } from "./hooks";
import type { BoothStore } from "./store";

const BAND_LABEL: Record<KdsBand, string> = {
  green: "On time",
  yellow: "Getting slow",
  red: "Late",
};

const BAND_CLASS: Record<KdsBand, string> = {
  green: "bg-[var(--pdt-band-green)]",
  yellow: "bg-[var(--pdt-band-yellow)]",
  red: "bg-[var(--pdt-band-red)]",
};

function TicketCard({ ticket }: { ticket: KdsTicket }) {
  return (
    <li
      className={`flex min-w-0 flex-col overflow-hidden rounded border-2 ${
        ticket.active
          ? "border-[var(--pdt-kds-active)]"
          : "border-[var(--pdt-kds-rule)]"
      }`}
    >
      <div
        className={`flex items-center justify-between gap-2 px-2 py-1 font-bold text-[var(--pdt-kds-text)] ${BAND_CLASS[ticket.band]}`}
      >
        <span>#{ticket.orderId}</span>
        <span className="tabular-nums">
          {formatClock(ticket.ageSec)}
          <span className="sr-only">, {BAND_LABEL[ticket.band]}</span>
        </span>
      </div>
      <ul className="space-y-0.5 px-2 py-1.5 text-xs">
        {ticket.lines.map((line, index) => (
          <li key={`${line.itemId}-${index}`} className="min-w-0 break-words">
            <span
              className={
                line.status === "dropped" || line.status === "locked"
                  ? "text-[var(--pdt-kds-alert)]"
                  : "text-[var(--pdt-kds-text)]"
              }
            >
              {line.label}
              {line.status === "dropped" ? " · dropped" : ""}
              {line.status === "locked" ? " · 18+" : ""}
              {line.status === "brewing" ? " · brewing" : ""}
              {line.status === "rung" ? " ✓" : ""}
            </span>
            {line.modifier ? (
              <span
                className={`block pl-2 ${
                  line.modifierPending
                    ? "text-[var(--pdt-kds-alert)]"
                    : "text-[var(--pdt-kds-dim)]"
                }`}
              >
                {MODIFIER_LABELS[line.modifier]}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      {ticket.ready ? (
        <p className="mt-auto px-2 pb-1.5 text-xs font-bold text-[var(--pdt-kds-text)]">
          Ready
        </p>
      ) : null}
    </li>
  );
}

/**
 * The kitchen display as plain HTML, for the flat view (ADR 0059, decision
 * 6). The 3D scene draws the same tickets into a texture instead.
 */
export function KdsBoard({ store }: { store: BoothStore }) {
  const { tickets } = useTickets(store);
  return (
    <section
      aria-label="Order screen"
      data-testid="pdt-kds-board"
      className="min-w-0 rounded-md border-4 border-[var(--pdt-kds-frame)] bg-[var(--pdt-kds-bg)] p-2 font-mono"
    >
      {tickets.length === 0 ? (
        <p className="py-6 text-center text-sm font-bold text-[var(--pdt-kds-dim)]">
          No orders
        </p>
      ) : (
        <ol className="grid grid-cols-2 gap-2 @lg:grid-cols-3">
          {tickets.map((ticket) => (
            <TicketCard key={ticket.orderId} ticket={ticket} />
          ))}
        </ol>
      )}
    </section>
  );
}
