"use client";

import React from "react";
import type { StudyEvent } from "@/lib/study-director";
import { Card } from "./Panels";
import { URGENCY_LABELS } from "./labels";
import { URGENCY_STRIPE, URGENCY_TONE } from "./tones";

/** The message list. Selecting a row opens it in the reading pane. */
export const InboxPanel: React.FC<{
  events: StudyEvent[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
}> = ({ events, selectedId, onSelect }) => {
  const critical = events.filter((e) => e.urgency === "critical").length;
  return (
    <Card
      title="Inbox"
      hint={`${events.length} open${critical ? `, ${critical} critical` : ""}`}
    >
      {events.length === 0 ? (
        <p className="text-xs text-[var(--sd-muted)]">
          Inbox zero. Enjoy it. End the day when you are ready.
        </p>
      ) : (
        <ul className="-mx-1 space-y-1">
          {events.map((event) => {
            const active = selectedId === event.id;
            return (
              <li key={event.id}>
                <button
                  type="button"
                  onClick={() => onSelect(event.id)}
                  aria-current={active}
                  className={`relative w-full min-w-0 py-2 pr-2 pl-3 text-left transition-colors before:absolute before:inset-y-1 before:left-0 before:w-0.5 ${URGENCY_STRIPE[event.urgency]} ${active ? "bg-[var(--sd-amber)]/10 ring-1 ring-[var(--sd-amber)]/60" : "hover:bg-white/[0.03]"}`}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className={`shrink-0 border px-1 text-[9px] font-bold tracking-wide uppercase ${URGENCY_TONE[event.urgency]}`}
                    >
                      {URGENCY_LABELS[event.urgency]}
                    </span>
                    <span className="min-w-0 truncate text-[11px] text-[var(--sd-muted)]">
                      {event.from}
                    </span>
                  </span>
                  <span
                    className={`mt-0.5 block text-xs break-words ${active ? "font-bold text-[var(--sd-text)]" : "text-zinc-200"}`}
                  >
                    {event.subject}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
};
