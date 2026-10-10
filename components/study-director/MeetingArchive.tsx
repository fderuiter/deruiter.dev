"use client";

import React, { useState } from "react";
import { getEvent } from "@/lib/study-director";
import type { MeetingReport } from "@/lib/study-director-world";

const KIND_LABEL: Record<MeetingReport["kind"], string> = {
  team: "Team meeting",
  sponsor: "Sponsor call",
};

/**
 * The meetings held in an office run, newest first, each with who was there,
 * what changed in the room and the verdict. It keeps the summary the meeting
 * produced, not a word-for-word record: the game does not write the lines.
 */
export const MeetingArchive: React.FC<{
  meetings: readonly MeetingReport[];
}> = ({ meetings }) => {
  const [picked, setPicked] = useState(0);
  if (meetings.length === 0)
    return (
      <p className="text-xs text-zinc-300" data-testid="meeting-archive-empty">
        No meetings held yet.
      </p>
    );
  const ordered = [...meetings].reverse();
  const open = ordered[Math.min(picked, ordered.length - 1)];
  return (
    <div className="space-y-3 text-xs" data-testid="meeting-archive">
      <ul className="flex flex-wrap gap-1.5" aria-label="Meetings">
        {ordered.map((m, i) => (
          <li key={`${m.day}-${m.kind}-${ordered.length - i}`}>
            <button
              type="button"
              aria-pressed={i === picked}
              onClick={() => setPicked(i)}
              className={`min-h-[36px] border px-2.5 py-1 text-xs font-semibold active:scale-[0.98] ${
                i === picked
                  ? "border-[var(--sd-amber)] bg-[var(--sd-amber)]/10 text-amber-300"
                  : "border-zinc-700 text-zinc-300 hover:border-zinc-500"
              }`}
            >
              Day {m.day} · {m.kind === "team" ? "Team" : "Sponsor"}
            </button>
          </li>
        ))}
      </ul>
      <section
        aria-label={`Day ${open.day} ${KIND_LABEL[open.kind]}`}
        className="space-y-2 border-t border-zinc-800 pt-2"
        data-testid="meeting-archive-entry"
      >
        <h4 className="text-sm font-bold text-amber-300">
          Day {open.day}: {KIND_LABEL[open.kind]}
        </h4>
        <p className="break-words text-[var(--sd-muted)]">
          {open.attendees.length > 0
            ? `With ${open.attendees.join(", ")}. `
            : ""}
          {open.minutes} minutes, {open.personMinutes} person-minutes.
        </p>
        <p className="font-bold text-zinc-100">{open.verdict}</p>
        {open.changes.length === 0 ? (
          <p className="text-zinc-300">Nothing changed.</p>
        ) : (
          <ul className="list-disc space-y-1 pl-4 text-zinc-200">
            {open.changes.map((change, i) => (
              <li key={i} className="break-words">
                {change}
              </li>
            ))}
          </ul>
        )}
        {open.raised.length > 0 ? (
          <p className="break-words text-zinc-300">
            Raised:{" "}
            {open.raised.map((id) => getEvent(id)?.subject ?? id).join("; ")}
          </p>
        ) : null}
      </section>
    </div>
  );
};
