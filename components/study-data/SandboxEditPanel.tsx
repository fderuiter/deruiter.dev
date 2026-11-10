/*
 * Field edited: the late side of the Week 2 visit window in DEMO-301.
 * Preset: `lib/study-data/presets/demo-301.ts`, VISITS entry `enc_week2`,
 * `windowAfter` (3), which the preset writes to the USDM timing
 * `enc_week2_timing.windowUpper` as `P3D`. In a run it is
 * `StudyDefinition.design.visits[id = "enc_week2"].windowAfter`.
 */
"use client";

import { useId, useState, type FormEvent } from "react";
import {
  evaluateVisitWindowConflicts,
  type VisitWindowConflict,
} from "@/lib/clinical-standards/visit-window-conflicts";
import type { StudyDesignDefinition, VisitDefinition } from "@/lib/study-data";
import { BUTTON_PRIMARY, FIELD, PANEL } from "./ui";

/** The DEMO-301 visit whose window the sandbox edits. */
const SANDBOX_VISIT_ID = "enc_week2";

/**
 * The window conflicts the sandbox visit would have with a given late
 * window, by the same check CRF Studio's schedule uses.
 */
function conflictsWith(
  visits: readonly VisitDefinition[],
  windowAfter: number
): readonly VisitWindowConflict[] {
  const edited = visits.map((visit) =>
    visit.id === SANDBOX_VISIT_ID ? { ...visit, windowAfter } : visit
  );
  return (
    evaluateVisitWindowConflicts(edited).conflictsByVisitId[SANDBOX_VISIT_ID] ??
    []
  );
}

const refused = (conflicts: readonly VisitWindowConflict[]) =>
  conflicts.some((conflict) => conflict.severity === "error");

const title = (name: string) =>
  name.toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

/**
 * The allowed late windows for the sandbox visit: zero days up to the last
 * one the window check does not refuse, which stops short of the next
 * visit's target day. Null when the study has no such visit, no visit after
 * it, or no allowed value.
 */
function sandboxWindowRange(visits: readonly VisitDefinition[]): {
  max: number;
  visit: VisitDefinition;
  next: VisitDefinition;
} | null {
  const ordered = [...visits].sort((a, b) => a.targetDay - b.targetDay);
  const index = ordered.findIndex((visit) => visit.id === SANDBOX_VISIT_ID);
  if (index < 0 || index === ordered.length - 1) return null;
  const visit = ordered[index];
  const next = ordered[index + 1];
  let max = next.targetDay - visit.targetDay - 1;
  while (max >= 0 && refused(conflictsWith(visits, max))) max -= 1;
  return max < 0 ? null : { max, visit, next };
}

/**
 * A sandbox with one editable input: how many days after its target day the
 * Week 2 visit may fall. A valid value reruns the pipeline with the edited
 * design (#3161), and the diff against the last run appears below. A value
 * the window check refuses gets one sentence naming the allowed range; one
 * that only overlaps the next visit's early window is allowed, with the
 * check's warning, because that overlap is what moves records between
 * visits. The edit lives only in this component's state for this page view.
 */
export function SandboxEditPanel({
  design,
  disabled,
  onRerun,
}: {
  readonly design: StudyDesignDefinition;
  readonly disabled: boolean;
  readonly onRerun: (design: StudyDesignDefinition) => void;
}) {
  const inputId = useId();
  const helpId = useId();
  const noteId = useId();
  const range = sandboxWindowRange(design.visits);
  const [text, setText] = useState(() =>
    range ? String(range.visit.windowAfter) : ""
  );

  if (!range) return null;
  const { max, visit, next } = range;

  const trimmed = text.trim();
  const value = /^\d+$/.test(trimmed) ? Number(trimmed) : Number.NaN;
  const conflicts =
    Number.isInteger(value) && value <= max
      ? conflictsWith(design.visits, value)
      : null;
  const valid = conflicts !== null && !refused(conflicts);
  const overlap = valid ? conflicts[0] : undefined;
  const label = title(visit.name);
  const nextLabel = title(next.name);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!valid || disabled) return;
    onRerun({
      ...design,
      visits: design.visits.map((item) =>
        item.id === SANDBOX_VISIT_ID ? { ...item, windowAfter: value } : item
      ),
    });
  };

  return (
    <section
      aria-labelledby={`${inputId}-title`}
      data-testid="sandbox-edit-panel"
      className={`${PANEL} mt-6 p-4 sm:p-5`}
    >
      <h3 id={`${inputId}-title`} className="text-sm font-semibold text-white">
        Change a visit window
      </h3>
      <p
        id={helpId}
        className="mt-1 max-w-3xl break-words text-xs leading-relaxed text-slate-300"
      >
        {label} is planned for Day {visit.targetDay} and may fall up to{" "}
        {visit.windowAfter} days late. Change how late it may fall, then rerun
        the same seed and subjects to see what moves downstream.
      </p>
      <form
        onSubmit={onSubmit}
        noValidate
        className="mt-4 flex flex-wrap items-end gap-3"
      >
        <div className="min-w-0 basis-56">
          <label
            htmlFor={inputId}
            className="block text-xs font-medium text-slate-200"
          >
            Days allowed after {label}
          </label>
          <input
            id={inputId}
            type="number"
            inputMode="numeric"
            min={0}
            max={max}
            step={1}
            value={text}
            onChange={(event) => setText(event.target.value)}
            aria-invalid={!valid}
            aria-describedby={
              valid && !overlap ? helpId : `${helpId} ${noteId}`
            }
            className={`${FIELD} mt-1`}
          />
        </div>
        <button
          type="submit"
          disabled={!valid || disabled}
          className={BUTTON_PRIMARY}
        >
          Rerun with this window
        </button>
      </form>
      {!valid ? (
        <p
          id={noteId}
          role="alert"
          className="mt-2 break-words text-sm text-rose-300"
        >
          Enter a whole number of days from 0 to {max}, so {label}&apos;s window
          ends before {nextLabel}&apos;s target day, Day {next.targetDay}.
        </p>
      ) : overlap ? (
        <p id={noteId} className="mt-2 break-words text-sm text-amber-200">
          {overlap.message} A record in the overlap goes to the visit whose
          target day is nearer.
        </p>
      ) : null}
    </section>
  );
}
