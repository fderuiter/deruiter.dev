import React from "react";
import {
  DEFAULT_STAKE,
  STAKES,
  sponsorById,
  type RunChoice,
} from "@/lib/trial-and-error";

const BADGE =
  "inline-block max-w-full border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider break-words";

/**
 * The run's sponsor and GCP-audit stake as two badges (#950), for the Blind
 * panel and Run Info. A stake above Routine Monitoring is shown in amber,
 * since it changes the rules.
 */
export function RunChoiceBadges({
  choice,
  className = "",
}: {
  choice: RunChoice;
  className?: string;
}) {
  const sponsor = sponsorById(choice.sponsorId);
  const stake = STAKES[choice.stake - 1];
  const raised = choice.stake > DEFAULT_STAKE;
  return (
    <p
      className={`flex min-w-0 flex-wrap gap-1 ${className}`}
      data-testid="run-choice-badges"
    >
      <span
        className={`${BADGE} border-zinc-600 text-zinc-200`}
        data-testid="sponsor-badge"
        data-sponsor={choice.sponsorId}
      >
        <span className="sr-only">Sponsor: </span>
        {sponsor.name}
      </span>
      <span
        className={`${BADGE} tabular-nums ${raised ? "border-amber-400/70 text-amber-300" : "border-zinc-600 text-zinc-300"}`}
        data-testid="stake-badge"
        data-stake={choice.stake}
        title={stake.rule}
      >
        Stake {choice.stake}: {stake.name}
      </span>
    </p>
  );
}
