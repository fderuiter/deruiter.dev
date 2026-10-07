"use client";

import React, { useState } from "react";
import type { MeetingReport } from "@/lib/study-director-world";
import { Overlay, OverlayButton } from "./TeamPieces";

export const MeetingReplayPanel: React.FC<{
  meetings: MeetingReport[];
  onClose: () => void;
  returnFocusTo?: React.RefObject<HTMLElement | null>;
}> = ({ meetings, onClose, returnFocusTo }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectedMeeting = meetings[selectedIndex] ?? null;

  return (
    <Overlay
      titleId="sd-meeting-replay-title"
      title="Meeting Archive & Replay"
      subtitle={`${meetings.length} meeting${meetings.length === 1 ? "" : "s"} recorded`}
      testId="meeting-replay-panel"
      onClose={onClose}
      returnFocusTo={returnFocusTo}
    >
      {meetings.length === 0 ? (
        <p className="text-xs text-zinc-300">
          No past meetings have been recorded yet.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5 border-b border-zinc-700/60 pb-3">
            {meetings.map((m, idx) => {
              const label = `Day ${m.day ?? idx + 1} ${m.kind === "team" ? "Team" : "Sponsor"}`;
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedIndex(idx)}
                  className={`px-2.5 py-1 text-xs font-semibold border ${
                    isSelected
                      ? "border-[var(--sd-amber)] bg-[var(--sd-amber)]/20 text-amber-300"
                      : "border-zinc-700 bg-zinc-800/60 text-zinc-300 hover:border-zinc-500"
                  }`}
                  aria-pressed={isSelected}
                  data-testid={`meeting-tab-${idx}`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {selectedMeeting ? (
            <div
              className="space-y-3 text-xs"
              data-testid="selected-meeting-details"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-2">
                <div>
                  <h4 className="text-sm font-bold text-amber-300">
                    Day {selectedMeeting.day ?? "?"} ·{" "}
                    {selectedMeeting.kind === "team"
                      ? "Team Meeting"
                      : "Sponsor Call"}
                  </h4>
                  <p className="mt-0.5 text-[11px] text-[var(--sd-muted)]">
                    Attendees: {selectedMeeting.attendees.join(", ") || "None"}
                  </p>
                </div>
                <div className="text-right text-[11px] text-zinc-400">
                  <p>{selectedMeeting.minutes} min meeting</p>
                  <p>{selectedMeeting.personMinutes} person-min total</p>
                </div>
              </div>

              <div>
                <h5 className="text-[10px] font-semibold tracking-wider text-[var(--sd-muted)] uppercase">
                  Transcript & Key Points
                </h5>
                {selectedMeeting.changes.length === 0 ? (
                  <p className="mt-1 italic text-zinc-400">
                    No major changes or disclosures were recorded.
                  </p>
                ) : (
                  <ul className="mt-1.5 space-y-1 pl-3 list-disc text-zinc-200">
                    {selectedMeeting.changes.map((change, i) => (
                      <li key={i} className="break-words">
                        {change}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {selectedMeeting.raised.length > 0 ? (
                <div>
                  <h5 className="text-[10px] font-semibold tracking-wider text-amber-400 uppercase">
                    Raised Concerns / Issues
                  </h5>
                  <ul className="mt-1 space-y-1 text-amber-200">
                    {selectedMeeting.raised.map((item, i) => (
                      <li key={i} className="break-words">
                        • {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="border-t border-zinc-800 pt-2">
                <p className="text-[11px] text-zinc-300">
                  <span className="font-semibold text-[var(--sd-muted)]">
                    Verdict:{" "}
                  </span>
                  {selectedMeeting.verdict}
                </p>
              </div>
            </div>
          ) : null}
        </div>
      )}

      <div className="pt-2">
        <OverlayButton onClick={onClose}>Close Replay</OverlayButton>
      </div>
    </Overlay>
  );
};
