"use client";

import React, { useEffect, useRef } from "react";
import {
  formatClock,
  type MorningDigest,
  type OvernightReport,
} from "@/lib/study-director-world";
import { OverlayButton } from "./TeamPieces";

type Tone = "neutral" | "good" | "bad";
interface ToneLine {
  tone: Tone;
  text: string;
}

const TONE_TEXT: Record<Tone, string> = {
  bad: "text-[var(--sd-red)]",
  good: "text-[var(--sd-emerald)]",
  neutral: "text-zinc-200",
};

/** A word beside the colour so tone is never carried by colour alone. */
const TONE_WORD: Record<Tone, string> = {
  bad: "Worse",
  good: "Better",
  neutral: "Same",
};

/** What moved comes first, in the order it was reported; what held steady follows. */
function changesFirst(lines: readonly ToneLine[]): {
  changes: ToneLine[];
  steady: ToneLine[];
} {
  return {
    changes: lines.filter((l) => l.tone !== "neutral"),
    steady: lines.filter((l) => l.tone === "neutral"),
  };
}

const Heading: React.FC<{ id: string; kicker: string; title: string }> = ({
  id,
  kicker,
  title,
}) => (
  <header>
    <p className="text-[10px] font-semibold tracking-[0.14em] text-[var(--sd-muted)] uppercase">
      {kicker}
    </p>
    <h3 id={id} className="mt-0.5 text-sm font-bold break-words">
      {title}
    </h3>
  </header>
);

const LineList: React.FC<{
  title: string;
  lines: readonly ToneLine[];
  /** Show the Better/Worse tag on each line. */
  tagged?: boolean;
}> = ({ title, lines, tagged }) =>
  lines.length === 0 ? null : (
    <section>
      <h4 className="text-[10px] font-semibold tracking-[0.14em] text-[var(--sd-muted)] uppercase">
        {title}
      </h4>
      <ul className="mt-1 space-y-1.5 text-xs leading-relaxed">
        {lines.map((l, i) => (
          <li key={i} className="flex min-w-0 items-start gap-2">
            {tagged ? (
              <span
                className={`mt-px shrink-0 border border-current px-1 text-[9px] font-semibold tracking-wide uppercase ${TONE_TEXT[l.tone]}`}
              >
                {TONE_WORD[l.tone]}
              </span>
            ) : null}
            <span className={`min-w-0 break-words ${TONE_TEXT[l.tone]}`}>
              {l.text}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );

const CARD =
  "sd-enter border border-[var(--sd-hairline-strong)] bg-[var(--sd-surface)] p-3 space-y-3";

/** The morning digest: the start time, then what changed, then what held. */
export const DigestCard: React.FC<{ digest: MorningDigest }> = ({ digest }) => {
  const { changes, steady } = changesFirst(digest.lines);
  return (
    <section
      aria-labelledby="sd-world-digest"
      data-testid="world-digest"
      className={CARD}
    >
      <Heading
        id="sd-world-digest"
        kicker={`Day ${digest.day}`}
        title={`${digest.weekday} morning`}
      />
      <p className="text-xs text-zinc-300">
        You start at{" "}
        <span className="font-bold text-zinc-100 tabular-nums">
          {formatClock(digest.startsAt)}
        </span>
        {digest.routineMinutes > 0
          ? ` after ${digest.routineMinutes} minutes of routine`
          : ""}
        .
      </p>
      <LineList title="What changed" lines={changes} tagged />
      <LineList title="As it was" lines={steady} />
    </section>
  );
};

/**
 * The overnight report. The primary button takes focus when the card opens,
 * so Enter starts the next day; N does the same from anywhere on the card.
 */
export const OvernightCard: React.FC<{
  report: OvernightReport;
  nextDay: number;
  onNextDay: () => void;
  onCloseout: () => void;
  closeoutLabel: string;
}> = ({ report, nextDay, onNextDay, onCloseout, closeoutLabel }) => {
  const primary = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    primary.current?.focus({ preventScroll: true });
  }, []);
  const { changes, steady } = changesFirst(report.lines);
  return (
    <section
      aria-labelledby="sd-world-report"
      data-testid="world-overnight"
      onKeyDown={(e) => {
        if (
          !report.complete &&
          (e.key === "n" || e.key === "N") &&
          !e.metaKey &&
          !e.ctrlKey &&
          !e.altKey
        ) {
          e.preventDefault();
          onNextDay();
        }
      }}
      className={CARD}
    >
      <Heading
        id="sd-world-report"
        kicker={report.complete ? "The study is over" : "While you were away"}
        title={`Overnight, day ${report.day}`}
      />
      {report.lines.length === 0 ? (
        <p className="text-xs text-zinc-300">A quiet night.</p>
      ) : null}
      <LineList title="What changed" lines={changes} tagged />
      <LineList title="As it was" lines={steady} />
      <div className="flex flex-wrap items-center gap-2">
        {report.complete ? (
          <OverlayButton ref={primary} primary onClick={onCloseout}>
            {closeoutLabel}
          </OverlayButton>
        ) : (
          <>
            <OverlayButton
              ref={primary}
              primary
              aria-keyshortcuts="N"
              onClick={onNextDay}
            >
              Drive in for day {nextDay}
            </OverlayButton>
            <span className="text-[11px] text-[var(--sd-muted)]">
              Press N to skip to the start of day {nextDay}.
            </span>
          </>
        )}
      </div>
    </section>
  );
};
