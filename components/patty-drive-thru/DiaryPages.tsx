"use client";

import React, { useEffect, useRef } from "react";
import Link from "next/link";
import { FieldManualButton } from "@/components/FieldManualButton";
import {
  CLOSING_NOTE,
  COMPANION_POST_PATH,
  DIARY_INTRO,
  computePayStub,
  formatCents,
  getShiftEnding,
  scoreShift,
  type ShiftState,
} from "@/lib/patty-drive-thru";

const PAGE_CLASS =
  "pdt-diary mx-auto flex w-full max-w-2xl min-w-0 flex-col gap-4 rounded-md border border-[var(--pdt-paper-rule)] bg-[var(--pdt-paper)] p-5 text-[var(--pdt-paper-ink)] sm:p-7";

/** The bump-bar yellow button that starts a shift. */
function ShiftButton({
  ref,
  onClick,
  children,
}: {
  ref?: React.Ref<HTMLButtonElement>;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      className="min-h-12 rounded border-2 border-[var(--pdt-bump-edge)] bg-[var(--pdt-bump)] px-5 font-mono text-sm font-bold uppercase tracking-wide text-[var(--pdt-ink)] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pdt-focus)]"
    >
      {children}
    </button>
  );
}

/** Moves focus to a page's main button when the page appears. */
function useFocusOnMount<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  return ref;
}

/** The diary page shown before the player clocks in (#1814). */
export function DiaryIntroPage({ onClockIn }: { onClockIn: () => void }) {
  const buttonRef = useFocusOnMount<HTMLButtonElement>();
  return (
    <article
      className={PAGE_CLASS}
      aria-labelledby="pdt-intro-title"
      data-testid="pdt-intro"
    >
      <header>
        <h2
          id="pdt-intro-title"
          className="font-mono text-2xl font-extrabold tracking-[-0.035em]"
        >
          {DIARY_INTRO.title}
        </h2>
        <p className="mt-1 font-mono text-xs uppercase tracking-wider text-[var(--pdt-paper-dim)]">
          {DIARY_INTRO.dateline}
        </p>
      </header>
      {DIARY_INTRO.paragraphs.map((paragraph) => (
        <p key={paragraph} className="text-sm leading-relaxed">
          {paragraph}
        </p>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <ShiftButton ref={buttonRef} onClick={onClockIn}>
          Clock in
        </ShiftButton>
        <FieldManualButton manualId="patty-drive-thru" label="Manual" />
      </div>
    </article>
  );
}

interface ShiftEndPageProps {
  shift: ShiftState;
  onClockIn: () => void;
}

/** The pay stub and the closing note, shown when the shift ends. */
export function ShiftEndPage({ shift, onClockIn }: ShiftEndPageProps) {
  const headingRef = useFocusOnMount<HTMLHeadingElement>();
  const ending = getShiftEnding(shift);
  const stub = computePayStub(shift);
  const rows: [string, number][] = [
    [
      `Gross pay (${stub.paidMinutes} min at the minimum wage)`,
      stub.grossCents,
    ],
    ["Uniform", -stub.uniformCents],
    ["Break adjustment (break not taken)", -stub.breakAdjustmentCents],
    ["Till shortage", -stub.tillShortCents],
  ];

  return (
    <article
      className={PAGE_CLASS}
      aria-labelledby="pdt-end-title"
      data-testid="pdt-end"
      data-outcome={ending.outcome}
    >
      <header>
        <h2
          id="pdt-end-title"
          ref={headingRef}
          tabIndex={-1}
          className="font-mono text-2xl font-extrabold tracking-[-0.035em] focus:outline-none"
        >
          {ending.title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed">{ending.summary}</p>
      </header>

      <section aria-labelledby="pdt-stub-title" className="font-mono">
        <h3
          id="pdt-stub-title"
          className="text-xs font-bold uppercase tracking-wider text-[var(--pdt-paper-dim)]"
        >
          Pay stub · Patty&apos;s Drive-Thru
        </h3>
        <table className="mt-1 w-full text-xs">
          <tbody>
            {rows.map(([label, cents]) => (
              <tr
                key={label}
                className="border-b border-[var(--pdt-paper-rule)]"
              >
                <th scope="row" className="py-1 pr-2 text-left font-normal">
                  {label}
                </th>
                <td className="py-1 text-right tabular-nums">
                  {formatCents(cents)}
                </td>
              </tr>
            ))}
            <tr>
              <th scope="row" className="py-1 pr-2 text-left font-bold">
                Net pay
              </th>
              <td
                className="py-1 text-right font-bold tabular-nums"
                data-testid="pdt-net-pay"
              >
                {formatCents(stub.netCents)}
              </td>
            </tr>
          </tbody>
        </table>
        <p className="mt-2 text-xs text-[var(--pdt-paper-dim)]">
          Score {scoreShift(shift)}
        </p>
      </section>

      <section aria-label="Closing note" className="space-y-3">
        {CLOSING_NOTE.map((paragraph) => (
          <p key={paragraph} className="text-sm leading-relaxed">
            {paragraph}
          </p>
        ))}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <ShiftButton onClick={onClockIn}>Work another shift</ShiftButton>
        <Link
          href={COMPANION_POST_PATH}
          className="inline-flex min-h-12 items-center font-mono text-xs font-bold underline underline-offset-4 hover:text-[var(--pdt-paper-dim)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pdt-focus)]"
        >
          Read the notes behind this shift
        </Link>
      </div>
    </article>
  );
}
