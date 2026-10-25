"use client";

import React, {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { copyToClipboard } from "@/lib/clipboard";
import { clamp } from "@/lib/game-utils";

type Verdict = "win" | "loss" | "neutral";

interface ResultStat {
  label: string;
  value: number;
  /** Text after the number, e.g. "x" for a combo. */
  suffix?: string;
}

interface ResultAction {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
}

interface ResultShare {
  /** The text to share, e.g. "I cleared Act 1 with 1,250 points." */
  text: string;
  title?: string;
  url?: string;
  /** The button label. Defaults to "Share". */
  label?: string;
}

type ShareOutcome = "shared" | "cancelled" | "copied" | "failed";

interface ResultCardProps {
  title: string;
  /** Short stamp text, e.g. "Cleared" or "Down". */
  stamp: string;
  verdict: Verdict;
  message?: ReactNode;
  /** Two to four numbers that count up when the card opens. */
  stats: ResultStat[];
  /** The run's score and the best before this run, for the best-score line. */
  score?: number;
  previousBest?: number;
  primary: ResultAction;
  secondary?: ResultAction;
  /** Game-specific numbers, kept in a "More stats" disclosure. */
  details?: ResultStat[];
  /** Offers a Share action: Web Share where it exists, else a copy. */
  share?: ResultShare;
  /** Extra content under the numbers, such as an unlocked reward. */
  children?: ReactNode;
  /** A stable id for the title, when tests or the game refer to it. */
  headingId?: string;
  /** Escape is left to the cabinet unless the game handles it here. */
  onEscape?: () => void;
  /**
   * Take focus without scrolling the page, for a card that opens beside the
   * game rather than over it, so the game's own end screen stays in view.
   */
  preventScroll?: boolean;
}

const ROLL_UP_MS = 700;

const STAT_COLUMNS: Record<number, string> = {
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-4",
};

const STAMP_TONE: Record<Verdict, string> = {
  win: "border-emerald-400/70 text-emerald-300",
  loss: "border-rose-400/70 text-rose-300",
  neutral: "border-amber-400/70 text-amber-300",
};

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** A number that counts up from zero once, writing to the DOM directly. */
function RollUp({ value, suffix = "" }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || value <= 0 || prefersReducedMotion()) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      // A frame's timestamp can predate the start; never roll below zero.
      const t = clamp((now - start) / ROLL_UP_MS, 0, 1);
      const eased = 1 - (1 - t) ** 3;
      el.textContent = `${Math.round(value * eased)}${suffix}`;
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      el.textContent = `${value}${suffix}`;
    };
  }, [value, suffix]);

  return (
    <span ref={ref} className="tabular-nums">
      {`${value}${suffix}`}
    </span>
  );
}

function bestLine(score: number, previousBest: number): ReactNode {
  if (score <= 0 && previousBest <= 0) return null;
  if (score > previousBest) {
    return previousBest > 0 ? (
      <span className="text-emerald-300">
        New best, {score - previousBest} over your old record
      </span>
    ) : (
      <span className="text-emerald-300">First score on the board</span>
    );
  }
  if (score === previousBest && score > 0) {
    return <span className="text-zinc-300">Tied your best</span>;
  }
  return (
    <span className="text-zinc-400">
      {previousBest - score} short of your best ({previousBest})
    </span>
  );
}

/**
 * Shares through the Web Share API where the browser has it, and copies the
 * text otherwise. Dismissing the share sheet is not a failure.
 */
async function shareResult({
  text,
  title,
  url,
}: ResultShare): Promise<ShareOutcome> {
  const data = { text, title, url };
  if (
    typeof navigator.share === "function" &&
    (typeof navigator.canShare !== "function" || navigator.canShare(data))
  ) {
    try {
      await navigator.share(data);
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return "cancelled";
      }
    }
  }
  try {
    await copyToClipboard(url ? `${text} ${url}` : text);
    return "copied";
  } catch {
    return "failed";
  }
}

const SHARE_STATUS: Record<ShareOutcome, string> = {
  shared: "",
  cancelled: "",
  copied: "Copied to the clipboard.",
  failed: "Sharing is not available here.",
};

/**
 * The shared end-of-round card: a title, a verdict stamp, a roll-up of the
 * round's numbers, a best-score line and Replay / Next actions.
 *
 * It is a modal dialog that traps focus and starts on the primary action.
 * Escape is left to the cabinet unless `onEscape` is given. The roll-up and the stamp's entrance are
 * skipped under reduced motion.
 *
 * On a phone it fills the cabinet and moves the actions to the bottom, with
 * the primary action nearest the thumb (`app/arcade/arcade.css`, #2794).
 */
export function ResultCard({
  title,
  stamp,
  verdict,
  message,
  stats,
  score,
  previousBest,
  primary,
  secondary,
  details,
  share,
  children,
  headingId,
  onEscape,
  preventScroll = false,
}: ResultCardProps) {
  const generatedId = useId();
  const titleId = headingId ?? generatedId;
  const best =
    score !== undefined && previousBest !== undefined
      ? bestLine(score, previousBest)
      : null;
  const primaryRef = useRef<HTMLButtonElement>(null);
  const [shareStatus, setShareStatus] = useState("");
  const onShare = async () => {
    if (!share) return;
    setShareStatus(SHARE_STATUS[await shareResult(share)]);
  };
  const trapRef = useFocusTrap<HTMLDivElement>(true, {
    initialFocusRef: primaryRef,
    onEscape,
    preventScroll,
  });

  return (
    <div className="arcade-result-overlay absolute inset-0 z-30 flex items-center justify-center overflow-y-auto bg-black/75 p-4 select-none">
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="arcade-result-card relative my-auto w-full max-w-[28rem] rounded-2xl border border-white/[0.08] bg-[#13151a] p-6 text-left shadow-2xl"
      >
        <span
          aria-hidden="true"
          className={`arcade-result-stamp absolute right-5 top-5 rotate-[-8deg] rounded border-2 px-2 py-0.5 font-mono text-xs font-bold uppercase tracking-[0.2em] ${STAMP_TONE[verdict]}`}
        >
          {stamp}
        </span>
        <h3
          id={titleId}
          className="pr-24 font-mono text-xl font-bold tracking-[-0.035em] text-[#f4f4f6]"
        >
          {title}
        </h3>
        <span className="sr-only">{stamp}.</span>
        {message && (
          <p className="mt-2 text-xs leading-relaxed text-zinc-400">
            {message}
          </p>
        )}

        <dl
          className={`mt-5 grid gap-px overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.08] ${
            STAT_COLUMNS[stats.length] ?? "grid-cols-2"
          }`}
        >
          {stats.map((stat) => (
            <div key={stat.label} className="bg-[#0d0e11] px-3 py-2.5">
              <dt className="arcade-result-small font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                {stat.label}
              </dt>
              <dd className="mt-0.5 font-mono text-lg font-bold text-[#f4f4f6]">
                <RollUp
                  key={stat.value}
                  value={stat.value}
                  suffix={stat.suffix}
                />
              </dd>
            </div>
          ))}
        </dl>

        {details && details.length > 0 && (
          <details className="group mt-3 rounded-xl border border-white/[0.08]">
            <summary className="flex min-h-[44px] cursor-pointer items-center px-3 font-mono text-xs uppercase tracking-wider text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--game-accent)]">
              More stats
            </summary>
            <dl className="grid grid-cols-2 gap-px border-t border-white/[0.08] bg-white/[0.08]">
              {details.map((stat) => (
                <div key={stat.label} className="bg-[#0d0e11] px-3 py-2">
                  <dt className="font-mono text-xs text-zinc-400">
                    {stat.label}
                  </dt>
                  <dd className="font-mono text-sm font-bold tabular-nums text-[#f4f4f6]">
                    {`${stat.value}${stat.suffix ?? ""}`}
                  </dd>
                </div>
              ))}
            </dl>
          </details>
        )}

        {best && (
          <p className="arcade-result-small mt-3 font-mono text-[11px]">
            {best}
          </p>
        )}

        {children}

        <div className="arcade-result-actions mt-6 flex flex-wrap items-center justify-end gap-2 font-mono text-xs font-bold uppercase tracking-wider">
          {secondary && (
            <button
              type="button"
              onClick={secondary.onClick}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-transparent px-4 text-zinc-200 transition-colors hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--game-accent)]"
            >
              {secondary.icon}
              {secondary.label}
            </button>
          )}
          {share && (
            <button
              type="button"
              onClick={onShare}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-transparent px-4 text-zinc-200 transition-colors hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--game-accent)]"
            >
              {share.label ?? "Share"}
            </button>
          )}
          <button
            ref={primaryRef}
            type="button"
            onClick={primary.onClick}
            className="arcade-launch-button inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-xl border px-5 text-zinc-950 transition-colors active:scale-[0.98]"
          >
            {primary.icon}
            {primary.label}
          </button>
        </div>
        {share && (
          <p
            role="status"
            className="mt-2 min-h-[1rem] text-right font-mono text-xs text-zinc-300"
          >
            {shareStatus}
          </p>
        )}
      </div>
    </div>
  );
}
