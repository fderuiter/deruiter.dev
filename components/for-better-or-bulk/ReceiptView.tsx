"use client";

/**
 * The end of a run: the receipt the engine computes, laid out plainly. It
 * explains what happened and why; it is not a grade.
 */

import React from "react";
import type { Receipt, Readiness } from "@/lib/for-better-or-bulk";

const STATUS_LABELS: Readonly<Record<Readiness, string>> = {
  ready: "Ready",
  simplified: "Simplified",
  unfinished: "Unfinished",
  unplanned: "Not planned",
};

interface ReceiptViewProps {
  receipt: Receipt;
  onPlayAgain: () => void;
  onChangePlan: () => void;
}

export function ReceiptView({
  receipt,
  onPlayAgain,
  onChangePlan,
}: ReceiptViewProps) {
  return (
    <div
      className="flex w-full min-w-0 flex-col gap-4 p-3 font-mono text-[var(--fbb-text)] sm:p-6"
      data-testid="fbb-receipt"
    >
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-[var(--fbb-dim)]">
          Receipt
        </p>
        <h2
          className="text-2xl font-extrabold tracking-[-0.035em] break-words"
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
                <span>${line.dollars}</span>
              </li>
            ))}
            <li className="flex justify-between gap-3 border-t border-[var(--fbb-rule)] pt-1 font-bold">
              <span>Total (budget ${receipt.spending.budget})</span>
              <span>${receipt.spending.total}</span>
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
          At 4:00
        </h3>
        <ul className="flex flex-col gap-2 text-xs">
          {receipt.readiness.map((line) => (
            <li key={line.category} className="min-w-0">
              <span className="font-bold">
                {line.label}: {STATUS_LABELS[line.status]}
              </span>
              <span className="block break-words text-[var(--fbb-dim)]">
                {line.explanation}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <ul className="flex min-w-0 flex-col gap-1 border-t border-[var(--fbb-rule)] pt-3 text-xs">
        <li data-testid="fbb-follow-through">
          <span className="font-bold">Follow-through:</span>{" "}
          {receipt.followThrough.explanation}
        </li>
        {receipt.finishedAt ? <li>{receipt.finishedAt}</li> : null}
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

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onPlayAgain}
          className="min-h-11 rounded border border-[var(--fbb-accent)] bg-[var(--fbb-accent)] px-4 text-xs font-bold uppercase tracking-wide text-[#0d0e11] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fbb-focus)]"
        >
          Same plan, again
        </button>
        <button
          type="button"
          onClick={onChangePlan}
          className="min-h-11 rounded border border-[var(--fbb-control)] px-4 text-xs font-bold uppercase tracking-wide active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fbb-focus)]"
        >
          Change the plan
        </button>
      </div>
    </div>
  );
}
