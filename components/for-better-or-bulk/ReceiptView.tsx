"use client";

/**
 * The end of a run: the receipt the engine computes, laid out plainly. It
 * explains what happened and why; it is not a grade.
 */

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { copyToClipboard, getActiveHostUrl } from "@/lib/clipboard";
import {
  CHALLENGE_COPY,
  bankText,
  dollars,
  runLinkFor,
  type Receipt,
  type Readiness,
} from "@/lib/for-better-or-bulk";
import { ChallengeStrip, type TimeChallenge } from "./ChallengeStrip";
import { scrollBelowNavbar } from "./scroll";

const STATUS_LABELS: Readonly<Record<Readiness, string>> = {
  ready: "Ready",
  simplified: "Simplified",
  unfinished: "Unfinished",
  unplanned: "Not planned",
};

interface ReceiptViewProps {
  receipt: Receipt;
  /** The run code, or null when this run cannot be shared. */
  runCode: string | null;
  onPlayAgain: () => void;
  onChangePlan: () => void;
  onWatchReplay: () => void;
  /**
   * Par and the personal best, shown in their own strip apart from the
   * receipt (#2056). Absent where a front end does not track them.
   */
  timeChallenge?: TimeChallenge | null;
}

const BUTTON_CLASS =
  "min-h-11 rounded border px-4 text-xs font-bold uppercase tracking-wide active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fbb-focus)]";

export function ReceiptView({
  receipt,
  runCode,
  onPlayAgain,
  onChangePlan,
  onWatchReplay,
  timeChallenge,
}: ReceiptViewProps) {
  const [copyNote, setCopyNote] = useState("");
  const titleRef = useRef<HTMLHeadingElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // The playback hands over here. The receipt scrolls the page so its top sits
  // its scroll margin below the viewport top, clear of the fixed navbar, then
  // the title takes focus without a second scroll. The margin is the
  // scroll-mt-28 class on the root (7rem, 112px), read back through
  // getComputedStyle, so that class and this read must change together. The
  // page is scrolled by hand: scrollIntoView ignores the margin here, because
  // the cabinet's clipped ancestors are scroll containers of their own.
  useEffect(() => {
    const root = rootRef.current;
    if (root) scrollBelowNavbar(root);
    titleRef.current?.focus({ preventScroll: true });
  }, []);

  /** Copies the link that opens this run. The code never leaves the page otherwise. */
  async function copyRunCode(): Promise<void> {
    if (!runCode) return;
    const link = runLinkFor(
      `${getActiveHostUrl()}${window.location.pathname}`,
      runCode
    );
    try {
      await copyToClipboard(link);
      setCopyNote("Run link copied. Anyone who opens it can watch this run.");
    } catch {
      setCopyNote(`Could not copy. The run link is ${link}`);
    }
  }

  const stars =
    "★".repeat(receipt.stars) +
    "☆".repeat(receipt.challenges.length - receipt.stars);

  return (
    <div
      ref={rootRef}
      className="scroll-mt-28 flex w-full min-w-0 flex-col gap-4 border-x-2 border-dashed border-[var(--fbb-rule)] bg-[var(--fbb-panel)] p-3 font-mono tabular-nums text-[var(--fbb-text)] sm:p-6"
      data-testid="fbb-receipt"
    >
      <div className="min-w-0 border-b border-dashed border-[var(--fbb-rule)] pb-3">
        <p className="text-xs uppercase tracking-wide text-[var(--fbb-dim)]">
          Receipt
        </p>
        <h2
          ref={titleRef}
          tabIndex={-1}
          className="text-2xl font-extrabold tracking-[-0.035em] break-words focus:outline-none"
          data-testid="fbb-title"
        >
          {receipt.title}
        </h2>
        <p className="mt-1 text-xs text-[var(--fbb-dim)]">
          {receipt.signatureMoment}
        </p>
      </div>

      <div className="grid min-w-0 gap-4 @3xl:grid-cols-2">
        <section className="min-w-0" aria-labelledby="fbb-receipt-spending">
          <h3
            id="fbb-receipt-spending"
            className="mb-2 text-xs font-bold uppercase tracking-wide"
          >
            Spending
          </h3>
          <ul className="flex flex-col gap-1 text-xs tabular-nums">
            {receipt.spending.lines.map((line) => (
              <li key={line.id} className="flex min-w-0 justify-between gap-3">
                <span className="min-w-0 break-words">{line.label}</span>
                <span>{dollars(line.dollars)}</span>
              </li>
            ))}
            <li className="flex justify-between gap-3 border-t border-[var(--fbb-rule)] pt-1 font-bold">
              <span>Total (budget {dollars(receipt.spending.budget)})</span>
              <span>{dollars(receipt.spending.total)}</span>
            </li>
          </ul>
        </section>

        <section className="min-w-0" aria-labelledby="fbb-receipt-website">
          <h3
            id="fbb-receipt-website"
            className="mb-2 text-xs font-bold uppercase tracking-wide"
          >
            The website
          </h3>
          <ul className="flex flex-col gap-1 text-xs">
            {receipt.website.map((line) => (
              <li
                key={line.capability}
                className={line.chosen ? "" : "text-[var(--fbb-dim)]"}
              >
                {line.text}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="min-w-0" aria-labelledby="fbb-receipt-readiness">
        <h3
          id="fbb-receipt-readiness"
          className="mb-2 text-xs font-bold uppercase tracking-wide"
        >
          {/* A day set early is not read at 4:00 (round 20, N-2); the finish
              time itself stays under the 3:00 challenge only (round 17). */}
          {receipt.finishedAt ? "When everything was set" : "At 4:00"}
        </h3>
        <ul className="flex flex-col gap-2 text-xs">
          {receipt.readiness.map((line) => (
            <li key={line.category} className="min-w-0">
              <span className="font-bold">
                {line.label}: {STATUS_LABELS[line.status]}
              </span>
              {/* "Not planned" already says it all (round 19, N-4). */}
              {line.status === "unplanned" ? null : (
                <span className="block break-words text-[var(--fbb-dim)]">
                  {line.explanation}
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section
        className="min-w-0 rounded border border-dashed border-[var(--fbb-rule)] p-3"
        aria-labelledby="fbb-receipt-challenges"
        data-testid="fbb-challenges"
      >
        <h3
          id="fbb-receipt-challenges"
          className="break-words text-xs font-bold uppercase tracking-wide"
        >
          {CHALLENGE_COPY}
        </h3>
        <p className="mt-1 text-xs tabular-nums" data-testid="fbb-stars">
          <span
            aria-hidden="true"
            className="tracking-widest text-[var(--fbb-accent)]"
          >
            {stars}
          </span>{" "}
          {receipt.stars} of {receipt.challenges.length} met
        </p>
        {receipt.assist ? (
          // The setup says helper days earn no trophies or board score, so the
          // stars say so too (round 17).
          <p className="mt-1 text-xs text-[var(--fbb-dim)]">
            A helper day, so these stars earn no trophies or board score.
          </p>
        ) : null}
        <ul className="mt-2 flex min-w-0 flex-col gap-2 text-xs">
          {receipt.challenges.map((challenge) => (
            <li
              key={challenge.id}
              className="flex min-w-0 flex-col"
              data-testid={`fbb-challenge-${challenge.id}`}
            >
              <span className="break-words font-bold">
                <span
                  className={
                    challenge.met ? "text-[var(--fbb-ok)]" : "text-[#94a3b8]"
                  }
                >
                  {challenge.met ? "Met" : "Not met"}
                </span>
                {": "}
                {challenge.label}
              </span>
              <span className="break-words text-[var(--fbb-dim)]">
                {challenge.detail}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {timeChallenge ? <ChallengeStrip {...timeChallenge} /> : null}

      <ul className="flex min-w-0 flex-col gap-1 border-t border-dashed border-[var(--fbb-rule)] pt-3 text-xs">
        <li data-testid="fbb-follow-through">
          <span className="font-bold">Follow-through:</span>{" "}
          {receipt.followThrough.explanation}
        </li>
        {/* The finish time is under the 3:00 challenge row (round 17). */}
        {receipt.kitchen ? <li>{receipt.kitchen}</li> : null}
        {receipt.assist ? (
          <li data-testid="fbb-assist">{receipt.assist}</li>
        ) : null}
        <li>
          <span className="font-bold">Weather:</span> {receipt.weather}
        </li>
        {receipt.gameWeather ? (
          <li className="text-[var(--fbb-dim)]">{receipt.gameWeather}</li>
        ) : null}
        <li>
          <span className="font-bold">Leftovers:</span> {receipt.leftovers}
        </li>
        <li>
          <span className="font-bold">Suit:</span> {receipt.suit}
        </li>
      </ul>
      <p className="text-[11px] text-[var(--fbb-dim)]">{receipt.disclaimer}</p>

      <section
        className="flex min-w-0 flex-col gap-2 border-t border-dashed border-[var(--fbb-rule)] pt-3 text-xs"
        aria-labelledby="fbb-receipt-actual"
        data-testid="fbb-actual"
      >
        <h3
          id="fbb-receipt-actual"
          className="break-words font-bold uppercase tracking-wide"
        >
          {receipt.actual.heading}
        </h3>
        {receipt.actual.lines.map((line) => (
          <p key={line} className="break-words">
            {line}
          </p>
        ))}
        <Link
          href={receipt.actual.href}
          className="min-h-11 self-start break-words py-3 font-bold text-[var(--fbb-accent)] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fbb-focus)]"
        >
          {bankText("actual-link")}
        </Link>
      </section>

      <div className="flex flex-wrap gap-2">
        {runCode ? (
          <button
            id="fbb-watch-replay"
            type="button"
            onClick={onWatchReplay}
            className={`${BUTTON_CLASS} border-[var(--fbb-accent)] text-[var(--fbb-accent)]`}
          >
            Watch replay
          </button>
        ) : null}
        {runCode ? (
          <button
            type="button"
            onClick={() => void copyRunCode()}
            className={`${BUTTON_CLASS} border-[var(--fbb-control)]`}
          >
            Copy replay link
          </button>
        ) : null}
        <button
          type="button"
          onClick={onPlayAgain}
          className={`${BUTTON_CLASS} border-[var(--fbb-accent)] bg-[var(--fbb-accent)] text-[#0d0e11]`}
        >
          Same plan, again
        </button>
        <button
          type="button"
          onClick={onChangePlan}
          className={`${BUTTON_CLASS} border-[var(--fbb-control)]`}
        >
          Change the plan
        </button>
      </div>
      {copyNote ? (
        <p role="status" className="break-all text-xs text-[var(--fbb-dim)]">
          {copyNote}
        </p>
      ) : null}
    </div>
  );
}
