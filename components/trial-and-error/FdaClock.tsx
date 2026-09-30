"use client";

import React from "react";
import type { ClockView, IrQuestionView } from "@/lib/trial-and-error";
import { clamp } from "@/lib/game-utils";

interface FdaClockProps {
  clock: ClockView;
  questions: readonly IrQuestionView[];
}

const RADIUS = 26;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * The FDA Information Request's 48-hour clock (#921), the Blind panel's hero:
 * a dial and a digital readout of the hours left, what each move takes, and
 * the targeted questions. It renders the view's clock and moves only when a
 * move is made; nothing here reads the time. With time for one last hand it
 * turns rose and says the response is due soon, in text as well as color.
 */
export function FdaClock({ clock, questions }: FdaClockProps) {
  const left = clamp(clock.hoursLeft, 0, clock.totalHours);
  const spent = CIRCUMFERENCE * (1 - left / clock.totalHours);
  const tone = clock.urgent ? "text-rose-300" : "text-amber-300";
  return (
    <section
      aria-labelledby="fda-clock-heading"
      className={`mt-2 min-w-0 border p-2 ${clock.urgent ? "border-rose-400/60" : "border-amber-500/40"}`}
      data-testid="fda-clock"
      data-urgent={clock.urgent || undefined}
    >
      <h3
        id="fda-clock-heading"
        className="text-[10px] font-bold uppercase tracking-wider text-zinc-400"
      >
        Response due
      </h3>
      <div className="mt-1 flex min-w-0 items-center gap-3">
        <svg
          viewBox="0 0 64 64"
          className="h-16 w-16 shrink-0 -rotate-90"
          aria-hidden="true"
        >
          <circle
            cx="32"
            cy="32"
            r={RADIUS}
            fill="none"
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth="6"
          />
          <circle
            cx="32"
            cy="32"
            r={RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={spent}
            className={`${tone} motion-safe:transition-[stroke-dashoffset] motion-safe:duration-500`}
          />
        </svg>
        <p className="min-w-0 tabular-nums">
          <span
            className={`block text-2xl font-bold ${tone}`}
            data-testid="fda-clock-hours"
          >
            {left}h
          </span>
          <span className="block text-zinc-400">
            of {clock.totalHours} hours left
          </span>
          {clock.urgent && !clock.hold && (
            <span className="block font-bold text-rose-300">Due soon</span>
          )}
        </p>
      </div>
      <p className="mt-1 text-zinc-400 break-words tabular-nums">
        Hand {clock.costs.PLAY_HAND}h · Discard {clock.costs.DISCARD}h · Inspect{" "}
        {clock.costs.INSPECT}h · Trace {clock.costs.TRACE}h
      </p>
      <ol
        aria-label="The FDA's questions"
        className="mt-2 space-y-1"
        data-testid="fda-questions"
      >
        {questions.map((q) => (
          <li
            key={q.id}
            className={`min-w-0 border p-2 break-words ${q.answered ? "border-emerald-500/60" : "border-zinc-700"}`}
            data-testid="fda-question"
            data-answered={q.answered || undefined}
          >
            <span className="block text-zinc-200">{q.question}</span>
            <span className="block text-zinc-400 tabular-nums">
              {q.cardNumber} · {q.quota} ·{" "}
              <span
                className={q.answered ? "text-emerald-300" : "text-amber-300"}
              >
                {q.answered ? "Answered" : "Open"}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
