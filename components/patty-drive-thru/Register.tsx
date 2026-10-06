"use client";

import React from "react";
import {
  BOOTH_CREW,
  MODIFIER_LABELS,
  getPosBreadcrumb,
  getPosScreen,
  type KdsTicket,
  type TicketLineStatus,
} from "@/lib/patty-drive-thru";
import { useTickets } from "./hooks";
import type { BoothStore } from "./store";

const STATUS_TEXT: Record<TicketLineStatus, string> = {
  "to-ring": "To ring",
  rung: "Rung",
  dropped: "Dropped: re-enter",
  locked: "Needs someone 18+",
  brewing: `${BOOTH_CREW.coworker} is brewing`,
  "ready-to-ring": "Ready to ring",
};

const STATUS_TONE: Record<TicketLineStatus, string> = {
  "to-ring": "text-[var(--pdt-screen-dim)]",
  rung: "text-[var(--pdt-screen-ok)]",
  dropped: "text-[var(--pdt-screen-alert)]",
  locked: "text-[var(--pdt-screen-alert)]",
  brewing: "text-[var(--pdt-screen-dim)]",
  "ready-to-ring": "text-[var(--pdt-screen-ok)]",
};

/** Ticket strip label for screen readers: the order number and its lines. */
function ticketLabel(ticket: KdsTicket): string {
  const lines = ticket.lines
    .map((line) =>
      line.modifier
        ? `${line.label}, ${MODIFIER_LABELS[line.modifier].toLowerCase()}`
        : line.label
    )
    .join("; ");
  return `Order ${ticket.orderId}${ticket.ready ? ", ready to bump" : ""}: ${lines}`;
}

interface RegisterProps {
  store: BoothStore;
  /** Called when the player presses Escape inside the register. */
  onLeave?: () => void;
  className?: string;
}

/**
 * The drive-thru register (POS): the order strip, the open ticket, the
 * order actions and the deliberately deep menu tree. Every control is a real
 * button, so the whole shift can be played with a keyboard or a screen
 * reader (ADR 0059, decision 4).
 */
export const Register = React.forwardRef<HTMLDivElement, RegisterProps>(
  function Register({ store, onLeave, className }, ref) {
    const { tickets, pos } = useTickets(store);
    const act = store.getState().act;
    const screen = getPosScreen({ pos });
    const breadcrumb = getPosBreadcrumb({ pos });
    const active = tickets.find((t) => t.active) ?? null;
    const hasDropped = active?.lines.some((l) => l.status === "dropped");

    return (
      <div
        ref={ref}
        data-testid="pdt-register"
        role="group"
        aria-label="Register"
        onKeyDown={(event) => {
          if (event.key === "Escape" && onLeave) {
            event.preventDefault();
            onLeave();
          }
        }}
        className={`pdt-register flex min-w-0 flex-col gap-2 rounded-md border-4 border-[var(--pdt-bezel)] bg-[var(--pdt-screen)] p-2 font-mono text-[var(--pdt-screen-text)] ${className ?? ""}`}
      >
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-[var(--pdt-screen-rule)] pb-1 text-[11px] uppercase tracking-wider">
          <span className="font-bold">Patty&apos;s POS 2.1</span>
          <span className="min-w-0 truncate text-[var(--pdt-screen-dim)]">
            {breadcrumb.join(" › ")}
          </span>
        </div>

        <div
          role="toolbar"
          aria-label="Open orders"
          className="flex min-h-11 flex-wrap gap-1.5"
        >
          {tickets.length === 0 ? (
            <span className="self-center text-xs text-[var(--pdt-screen-dim)]">
              No cars. Wipe something.
            </span>
          ) : (
            tickets.map((ticket, index) => (
              <button
                key={ticket.orderId}
                type="button"
                aria-pressed={ticket.active}
                aria-label={ticketLabel(ticket)}
                aria-keyshortcuts={index < 9 ? String(index + 1) : undefined}
                onClick={() =>
                  act({ type: "selectOrder", orderId: ticket.orderId })
                }
                className={`min-h-11 min-w-14 rounded border-2 px-2 text-sm font-bold active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pdt-focus)] ${
                  ticket.active
                    ? "border-[var(--pdt-key-active)] bg-[var(--pdt-key-active)] text-[var(--pdt-ink)]"
                    : "border-[var(--pdt-key-edge)] bg-[var(--pdt-key)] text-[var(--pdt-ink)]"
                }`}
              >
                #{ticket.orderId}
                {ticket.ready ? " ✓" : ""}
              </button>
            ))
          )}
        </div>

        <div
          aria-live="polite"
          className="min-h-16 rounded border border-[var(--pdt-screen-rule)] px-2 py-1 text-xs"
        >
          {active ? (
            <>
              <p className="font-bold">Order #{active.orderId}</p>
              <ul className="mt-0.5 space-y-0.5">
                {active.lines.map((line, index) => (
                  <li
                    key={`${line.itemId}-${index}`}
                    className="flex min-w-0 flex-wrap justify-between gap-x-3"
                  >
                    <span className="min-w-0">
                      {line.label}
                      {line.modifier ? (
                        <span
                          className={
                            line.modifierPending
                              ? "text-[var(--pdt-screen-alert)]"
                              : "text-[var(--pdt-screen-ok)]"
                          }
                        >
                          {" "}
                          · {MODIFIER_LABELS[line.modifier]}
                          {line.modifierPending ? " (not entered)" : " ✓"}
                        </span>
                      ) : null}
                    </span>
                    <span className={STATUS_TONE[line.status]}>
                      {STATUS_TEXT[line.status]}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-[var(--pdt-screen-dim)]">
              Pick an order to ring it up.
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <ActionKey
            disabled={!active || !hasDropped}
            shortcut="R"
            onClick={() =>
              active && act({ type: "reenterDrink", orderId: active.orderId })
            }
          >
            Re-enter drink
          </ActionKey>
          <ActionKey
            disabled={!active || !active.needsCoworker}
            shortcut="C"
            onClick={() =>
              active && act({ type: "flagCoworker", orderId: active.orderId })
            }
          >
            Flag {BOOTH_CREW.coworker}
          </ActionKey>
          <ActionKey
            disabled={!active}
            shortcut="B"
            tone="bump"
            onClick={() =>
              active && act({ type: "bump", orderId: active.orderId })
            }
          >
            Bump order
          </ActionKey>
        </div>

        <div
          role="group"
          aria-label={`Menu: ${screen.label}`}
          className="grid grid-cols-2 gap-1.5 border-t border-[var(--pdt-screen-rule)] pt-2 @md:grid-cols-4"
        >
          {(screen.children ?? []).map((node) => (
            <button
              key={node.id}
              type="button"
              onClick={() => act({ type: "posTap", nodeId: node.id })}
              className="min-h-12 rounded border-2 border-[var(--pdt-key-edge)] bg-[var(--pdt-key)] px-2 text-sm font-bold text-[var(--pdt-ink)] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pdt-focus)]"
            >
              {node.label}
              {node.children ? " ›" : ""}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <ActionKey
            disabled={pos.path.length === 0}
            shortcut="Backspace"
            onClick={() => act({ type: "posBack" })}
          >
            ‹ Back
          </ActionKey>
          <ActionKey
            disabled={pos.path.length === 0}
            shortcut="Home"
            onClick={() => act({ type: "posHome" })}
          >
            Home
          </ActionKey>
        </div>
      </div>
    );
  }
);

interface ActionKeyProps {
  children: React.ReactNode;
  disabled: boolean;
  shortcut: string;
  tone?: "plain" | "bump";
  onClick: () => void;
}

function ActionKey({
  children,
  disabled,
  shortcut,
  tone = "plain",
  onClick,
}: ActionKeyProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-keyshortcuts={shortcut}
      onClick={onClick}
      className={`min-h-11 rounded border-2 px-3 text-xs font-bold uppercase tracking-wide active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pdt-focus)] ${
        tone === "bump"
          ? "border-[var(--pdt-bump-edge)] bg-[var(--pdt-bump)] text-[var(--pdt-ink)]"
          : "border-[var(--pdt-key-edge)] bg-[var(--pdt-key)] text-[var(--pdt-ink)]"
      }`}
    >
      {children}
    </button>
  );
}
