"use client";

import React, { useEffect, useRef } from "react";
import {
  PRIORITIES,
  formatClock,
  type GuestScene,
  type Interruption,
  type MorningDigest,
  type OvernightReport,
  type PriorityId,
  type SiteVisitReport,
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

/** A site visit's write-up as overnight lines: verdict, findings, what you learned. */
function visitLines(visit: SiteVisitReport): ToneLine[] {
  return [
    { text: visit.verdict, tone: "neutral" },
    ...visit.findings.map((f) => ({
      text: f.hidden ? `Hidden by the dashboard: ${f.text}` : f.text,
      tone: f.hidden ? ("bad" as const) : ("neutral" as const),
    })),
    ...visit.learned.map((t) => ({
      text: `Learned: ${t.label}. ${t.detail}`,
      tone: "good" as const,
    })),
  ];
}

const CARD_FRAME =
  "sd-enter scroll-mt-nav-24 border border-[var(--sd-hairline-strong)] bg-[var(--sd-surface)] p-3";
const CARD = `${CARD_FRAME} space-y-3`;

/** Clearance for the fixed site navbar above the cabinet, in pixels. */
const TOP_CLEARANCE = 96;

/**
 * Brings a newly opened card fully into view, from above or below. After a
 * walk from the office directory, which sits below the floor, a card can
 * open off the top of the page (#1936); a keyboard player at the car, or
 * one stopped by the hard stop, saw the card open below the fold (#2252).
 * A card already on screen is left where it is, and one taller than the
 * viewport is brought in by its top. Smooth unless the visitor asks for
 * less motion.
 */
export function revealInView(el: HTMLElement | null): void {
  if (!el || typeof el.getBoundingClientRect !== "function") return;
  if (typeof el.scrollIntoView !== "function") return;
  const { top, bottom, height } = el.getBoundingClientRect();
  const viewport = window.innerHeight || document.documentElement.clientHeight;
  if (top >= TOP_CLEARANCE && bottom <= viewport) return;
  const reduced =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({
    block:
      top < TOP_CLEARANCE || height > viewport - TOP_CLEARANCE
        ? "start"
        : "end",
    behavior: reduced ? "auto" : "smooth",
  });
}

/** The morning digest: the start time, then what changed, then what held. */
export const DigestCard: React.FC<{ digest: MorningDigest }> = ({ digest }) => {
  const { changes, steady } = changesFirst(digest.lines);
  return (
    <section
      aria-labelledby="sd-world-digest"
      data-testid="world-digest"
      className={`${CARD_FRAME} space-y-2`}
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

const PRIORITY_ORDER: readonly PriorityId[] = ["people", "sites", "desk"];

/**
 * The morning's one choice: what the day is about. It is a promise, picked
 * once; the card then shrinks to a line the Today panel keeps.
 */
export const PriorityCard: React.FC<{
  onChoose: (id: PriorityId) => void;
}> = ({ onChoose }) => (
  <section
    aria-labelledby="sd-world-priority"
    data-testid="world-priority"
    // A little tighter than the other cards, so the day-1 digest and this
    // card fit beside the floor at 1280x800 (#2252).
    className={`@container ${CARD_FRAME} space-y-0.5 p-2`}
  >
    <Heading
      id="sd-world-priority"
      kicker="Before you start"
      title="What is today about?"
    />
    <ul className="grid gap-0.5 @lg:grid-cols-3 @lg:gap-2">
      {PRIORITY_ORDER.map((id) => (
        <li key={id} className="min-w-0">
          <OverlayButton
            className="h-full w-full px-2 py-0.5 leading-tight"
            data-priority={id}
            onClick={() => onChoose(id)}
          >
            {/* Stacked in a narrow column the promise runs on after the
                label, so the card fits beside the floor (#2252). */}
            <span className="font-bold @lg:block">{PRIORITIES[id].label}</span>{" "}
            <span className="text-[11px] font-normal break-words text-[var(--sd-muted)] @lg:mt-1 @lg:block">
              {PRIORITIES[id].promise}
            </span>
          </OverlayButton>
        </li>
      ))}
    </ul>
    <p className="text-[11px] text-[var(--sd-muted)]">
      Or start walking with no promise.
    </p>
  </section>
);

/** Something that landed on the day, with its ways to answer and what each costs. */
export const InterruptionCard: React.FC<{
  interruption: Interruption;
  onAnswer: (optionId: string) => void;
}> = ({ interruption, onAnswer }) => (
  <section
    aria-labelledby="sd-world-interruption"
    data-testid="world-interruption"
    className={`${CARD} border-[var(--sd-amber)]/60`}
  >
    <Heading
      id="sd-world-interruption"
      kicker="Just now"
      title={interruption.title}
    />
    <p className="text-xs leading-relaxed text-zinc-200">{interruption.body}</p>
    <ul className="flex flex-wrap gap-2">
      {interruption.options.map((o) => (
        <li key={o.id} className="min-w-0">
          <OverlayButton onClick={() => onAnswer(o.id)}>
            {o.label}
            <span className="ml-1 text-[var(--sd-muted)]">
              {o.cost.minutes === 0 ? "· no time" : `· ${o.cost.minutes} min`}
            </span>
          </OverlayButton>
        </li>
      ))}
    </ul>
  </section>
);

/** A visitor in the conference room, and what each way of spending the visit costs. */
export const GuestCard: React.FC<{
  scene: GuestScene;
  onMeet: (optionId: string) => void;
}> = ({ scene, onMeet }) => (
  <section
    aria-labelledby="sd-world-guest"
    data-testid="world-guest"
    data-guest={scene.id}
    className={`${CARD} border-[var(--sd-amber)]/60`}
  >
    <Heading id="sd-world-guest" kicker={scene.kicker} title={scene.title} />
    <p className="text-[11px] text-[var(--sd-muted)]">
      {scene.visitor.name}, {scene.visitor.role}, {scene.visitor.organisation}.
      Waiting until {formatClock(scene.leavesAt)}.
    </p>
    {scene.body.map((line) => (
      <p key={line} className="text-xs leading-relaxed text-zinc-200">
        {line}
      </p>
    ))}
    {scene.here ? null : (
      <p data-testid="world-guest-where" className="text-xs text-zinc-300">
        Walk to the conference room to meet them.
      </p>
    )}
    <ul className="flex flex-wrap gap-2">
      {scene.options.map((o) => (
        <li key={o.id} className="min-w-0">
          <OverlayButton
            aria-disabled={!o.available}
            className={o.available ? "" : "opacity-50"}
            onClick={() => {
              if (o.available) onMeet(o.id);
            }}
            aria-describedby={o.reason ? `sd-guest-why-${o.id}` : undefined}
          >
            {o.label}
            <span className="ml-1 text-[var(--sd-muted)]">
              · {o.cost.minutes} min
            </span>
          </OverlayButton>
          {o.reason && scene.here ? (
            <p
              id={`sd-guest-why-${o.id}`}
              className="mt-0.5 text-[11px] text-[var(--sd-muted)]"
            >
              {o.reason}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  </section>
);

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
  /** The write-up of a site visit the player drove home from (#2185). */
  visit?: SiteVisitReport | null;
}> = ({ report, nextDay, onNextDay, onCloseout, closeoutLabel, visit }) => {
  const primary = useRef<HTMLButtonElement>(null);
  const card = useRef<HTMLElement>(null);
  useEffect(() => {
    primary.current?.focus({ preventScroll: true });
    revealInView(card.current);
  }, []);
  const { changes, steady } = changesFirst(report.lines);
  return (
    <section
      ref={card}
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
      <LineList
        title="What the team did with your day"
        lines={report.delegated ?? []}
      />
      {visit ? (
        <LineList
          title={`${visit.siteName} visit write-up`}
          lines={visitLines(visit)}
        />
      ) : null}
      <LineList title="How today went" lines={report.wrapUp ?? []} />
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
