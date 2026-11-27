"use client";

import { useId, useState, type FormEvent } from "react";
import {
  STUDY_ENCOUNTER_TYPES,
  addStudyActivity,
  addStudyEncounter,
  moveStudyActivity,
  moveStudyEncounter,
  projectStudySchedule,
  removeStudyActivity,
  removeStudyEncounter,
  renameStudyActivity,
  renameStudyEncounter,
  toggleStudyScheduledActivity,
  updateStudyEncounterTiming,
  type StudyScheduleActivity,
  type StudyScheduleGrid,
  type StudyScheduleVisit,
  type StudyWorkspace,
} from "@/lib/study-workspace";
import type { StudyApplyFn } from "./StudyDesignGrid";

type ScheduleSelection =
  | { readonly kind: "visit"; readonly id: string }
  | { readonly kind: "activity"; readonly id: string };

const BUTTON =
  "min-h-12 rounded border border-white/[0.08] bg-[#0d0e11] px-3 py-1.5 text-sm text-[#f4f4f6] hover:border-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]";
const FIELD =
  "min-h-12 min-w-0 max-w-full rounded border border-white/[0.08] bg-[#0d0e11] px-2 py-1.5 text-sm text-[#f4f4f6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400";
const MONO = "font-[family-name:var(--font-geist-mono)] tabular-nums";

function formatVisitTimingBadge(visit: StudyScheduleVisit): string {
  if (visit.targetDay === null) {
    return visit.isUnscheduled ? "Unscheduled" : "No timing";
  }
  const hasWindow = visit.windowBefore > 0 || visit.windowAfter > 0;
  const windowText = hasWindow
    ? ` (-${visit.windowBefore}/+${visit.windowAfter}d)`
    : "";
  if (visit.isAnchor) {
    return `Day ${visit.targetDay} · Anchor${windowText}`;
  }
  return `Day ${visit.targetDay}${windowText}`;
}

/**
 * Interactive Schedule of Activities (SoA) view: visits ordered by planned
 * study day as columns, clinical activities as rows, toggleable cells,
 * planned day and visit window editing, and immediate window overlap checks.
 */
export function StudySchedulePanel({
  workspace,
  apply,
}: {
  readonly workspace: StudyWorkspace;
  readonly apply: StudyApplyFn;
}) {
  const [selection, setSelection] = useState<ScheduleSelection | null>(null);
  const schedule = projectStudySchedule(workspace);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/[0.08] bg-[#13151a] px-4 py-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-[#f4f4f6]">
            Schedule of activities
          </h3>
          <p className="text-xs text-slate-400">
            Visits are ordered by planned study day (Day 1 = anchor, no Day 0);
            unscheduled or untimed visits appear last.
          </p>
        </div>
        <div className={`${MONO} flex flex-wrap gap-3 text-xs text-slate-300`}>
          <span>
            {schedule.visits.length}{" "}
            {schedule.visits.length === 1 ? "encounter" : "encounters"}
          </span>
          <span aria-hidden="true" className="text-slate-600">
            ·
          </span>
          <span>
            {schedule.activities.length}{" "}
            {schedule.activities.length === 1 ? "activity" : "activities"}
          </span>
          <span aria-hidden="true" className="text-slate-600">
            ·
          </span>
          <span>
            {schedule.scheduledLinkCount} scheduled{" "}
            {schedule.scheduledLinkCount === 1 ? "link" : "links"}
          </span>
        </div>
      </div>

      {schedule.windowConflicts.hasConflicts && (
        <section
          aria-labelledby="schedule-window-conflicts"
          className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100"
        >
          <h4
            id="schedule-window-conflicts"
            className="font-semibold text-amber-300"
          >
            Visit window overlaps ({schedule.windowConflicts.totalConflicts})
          </h4>
          <ul className="space-y-1.5">
            {schedule.windowConflicts.conflicts.map((conflict) => (
              <li
                key={`${conflict.visitIdA}:${conflict.visitIdB}`}
                className="flex flex-wrap items-baseline gap-2"
              >
                <span
                  className={`${MONO} rounded px-1.5 py-0.5 text-xs uppercase ${
                    conflict.severity === "error"
                      ? "border border-rose-400/50 bg-rose-500/20 text-rose-200"
                      : "border border-amber-400/50 bg-amber-500/20 text-amber-200"
                  }`}
                >
                  {conflict.severity}
                </span>
                <span className="min-w-0 break-words">{conflict.message}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-6 @3xl:grid-cols-[minmax(0,1fr)_22rem]">
        <ScheduleMatrix
          schedule={schedule}
          selection={selection}
          onSelect={setSelection}
          apply={apply}
        />
        <ScheduleInspector
          key={JSON.stringify(selection)}
          schedule={schedule}
          selection={selection}
          onSelect={setSelection}
          apply={apply}
        />
      </div>

      <ScheduleAddForms apply={apply} />

      <section aria-labelledby="schedule-findings" className="min-w-0">
        <h3 id="schedule-findings" className="font-semibold">
          Schedule findings
        </h3>
        {schedule.findings.length === 0 ? (
          <p className="mt-2 text-sm text-emerald-300">
            Timeline, Fixed Reference anchor timing, and scheduled visits are
            complete.
          </p>
        ) : (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-200">
            {schedule.findings.map((finding, index) => (
              <li key={`${finding.kind}:${finding.ids.join(":")}:${index}`}>
                {finding.message}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ScheduleMatrix({
  schedule,
  selection,
  onSelect,
  apply,
}: {
  readonly schedule: StudyScheduleGrid;
  readonly selection: ScheduleSelection | null;
  readonly onSelect: (selection: ScheduleSelection) => void;
  readonly apply: StudyApplyFn;
}) {
  if (schedule.visits.length === 0 && schedule.activities.length === 0) {
    return (
      <p className="min-w-0 text-sm text-slate-400">
        This study has no visits or clinical activities yet. Add them below.
      </p>
    );
  }

  return (
    <div className="min-w-0 overflow-x-auto rounded-lg border border-white/[0.08]">
      <table className="w-full border-collapse text-left text-sm">
        <caption className="sr-only">
          Schedule of activities: clinical activities by scheduled visits.
          Select a visit or activity header to inspect it, or activate any cell
          to schedule or unschedule that activity.
        </caption>
        <thead>
          <tr>
            <th
              scope="col"
              className="border-b border-white/[0.08] bg-[#13151a] p-2 text-xs font-medium uppercase tracking-wider text-slate-400"
            >
              Activity
            </th>
            {schedule.visits.map((visit) => {
              const isSelected =
                selection?.kind === "visit" && selection.id === visit.id;
              const visitConflicts =
                schedule.windowConflicts.conflictsByVisitId[visit.id] ?? [];
              return (
                <th
                  key={visit.id}
                  scope="col"
                  className="min-w-[9.5rem] border-b border-l border-white/[0.08] bg-[#13151a] p-2 align-bottom"
                >
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => onSelect({ kind: "visit", id: visit.id })}
                    className={`${BUTTON} w-full text-left aria-pressed:border-amber-400`}
                  >
                    <span className="block break-words font-semibold">
                      {visit.name}
                    </span>
                    <span
                      className={`${MONO} mt-0.5 block text-xs text-slate-400`}
                    >
                      {formatVisitTimingBadge(visit)}
                    </span>
                    {visitConflicts.length > 0 && (
                      <span
                        className={`${MONO} mt-1 inline-block rounded border border-amber-400/40 bg-amber-500/15 px-1.5 py-0.5 text-[11px] text-amber-200`}
                      >
                        Window overlap
                      </span>
                    )}
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {schedule.rows.length === 0 ? (
            <tr>
              <td
                colSpan={schedule.visits.length + 1}
                className="p-4 text-sm text-slate-400"
              >
                No clinical activities yet. Add an activity below to populate
                rows.
              </td>
            </tr>
          ) : (
            schedule.rows.map((row) => {
              const isSelected =
                selection?.kind === "activity" &&
                selection.id === row.activity.id;
              return (
                <tr key={row.activity.id}>
                  <th
                    scope="row"
                    className="min-w-[13rem] border-t border-white/[0.08] bg-[#13151a]/60 p-2 align-middle"
                  >
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() =>
                        onSelect({ kind: "activity", id: row.activity.id })
                      }
                      className={`${BUTTON} w-full text-left aria-pressed:border-amber-400`}
                    >
                      <span className="block break-words font-medium">
                        {row.activity.name}
                      </span>
                      {row.activity.sdtmDomain && (
                        <span
                          className={`${MONO} mt-0.5 inline-block text-xs text-slate-400`}
                        >
                          SDTM {row.activity.sdtmDomain}
                        </span>
                      )}
                    </button>
                  </th>
                  {row.cells.map((cell, index) => {
                    const visit = schedule.visits[index];
                    const label = `${row.activity.name} at ${visit.name}: ${
                      cell.scheduled ? "scheduled" : "not scheduled"
                    }`;
                    return (
                      <td
                        key={cell.encounterId}
                        className="border-l border-t border-white/[0.08] p-2 text-center align-middle"
                      >
                        <button
                          type="button"
                          aria-pressed={cell.scheduled}
                          aria-label={label}
                          onClick={() =>
                            apply((w) =>
                              toggleStudyScheduledActivity(
                                w,
                                visit.id,
                                row.activity.id
                              )
                            )
                          }
                          className={`min-h-12 min-w-12 w-full rounded border px-2 py-1.5 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 active:scale-[0.98] ${
                            cell.scheduled
                              ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-200 hover:border-emerald-400"
                              : "border-white/[0.08] bg-[#0d0e11] text-slate-400 hover:border-slate-500"
                          }`}
                        >
                          <span aria-hidden="true">
                            {cell.scheduled ? "●" : "—"}
                          </span>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

function ScheduleInspector({
  schedule,
  selection,
  onSelect,
  apply,
}: {
  readonly schedule: StudyScheduleGrid;
  readonly selection: ScheduleSelection | null;
  readonly onSelect: (selection: ScheduleSelection | null) => void;
  readonly apply: StudyApplyFn;
}) {
  const panel =
    "min-w-0 space-y-4 rounded-lg border border-white/[0.08] bg-[#13151a] p-4";

  if (!selection) {
    return (
      <section aria-label="Edit schedule item" className={panel}>
        <p className="text-sm text-slate-400">
          Select a visit column header or an activity row header to rename,
          reorder, remove, or edit visit timing and windows.
        </p>
      </section>
    );
  }

  if (selection.kind === "visit") {
    const visitIndex = schedule.visits.findIndex((v) => v.id === selection.id);
    const visit = schedule.visits[visitIndex];
    if (!visit) return null;
    return (
      <VisitInspector
        visit={visit}
        visitIndex={visitIndex}
        visitCount={schedule.visits.length}
        conflicts={schedule.windowConflicts.conflictsByVisitId[visit.id] ?? []}
        onClearSelection={() => onSelect(null)}
        apply={apply}
        className={panel}
      />
    );
  }

  const activityIndex = schedule.activities.findIndex(
    (a) => a.id === selection.id
  );
  const activity = schedule.activities[activityIndex];
  if (!activity) return null;

  return (
    <ActivityInspector
      activity={activity}
      activityIndex={activityIndex}
      activityCount={schedule.activities.length}
      onClearSelection={() => onSelect(null)}
      apply={apply}
      className={panel}
    />
  );
}

function VisitInspector({
  visit,
  visitIndex,
  visitCount,
  conflicts,
  onClearSelection,
  apply,
  className,
}: {
  readonly visit: StudyScheduleVisit;
  readonly visitIndex: number;
  readonly visitCount: number;
  readonly conflicts: readonly { readonly message: string }[];
  readonly onClearSelection: () => void;
  readonly apply: StudyApplyFn;
  readonly className: string;
}) {
  const [name, setName] = useState(visit.name);
  const [targetDayText, setTargetDayText] = useState(
    visit.targetDay === null ? "" : String(visit.targetDay)
  );
  const [windowBeforeText, setWindowBeforeText] = useState(
    String(visit.windowBefore)
  );
  const [windowAfterText, setWindowAfterText] = useState(
    String(visit.windowAfter)
  );

  const nameId = useId();
  const dayId = useId();
  const beforeId = useId();
  const afterId = useId();

  const handleRename = (event: FormEvent) => {
    event.preventDefault();
    apply((w) => renameStudyEncounter(w, visit.id, name));
  };

  const handleSaveTiming = (event: FormEvent) => {
    event.preventDefault();
    const trimmedDay = targetDayText.trim();
    const parsedDay = trimmedDay === "" ? null : Number(trimmedDay);
    const parsedBefore =
      windowBeforeText.trim() === "" ? 0 : Number(windowBeforeText);
    const parsedAfter =
      windowAfterText.trim() === "" ? 0 : Number(windowAfterText);

    apply((w) =>
      updateStudyEncounterTiming(w, visit.id, {
        targetDay: parsedDay,
        windowBefore: parsedBefore,
        windowAfter: parsedAfter,
      })
    );
  };

  return (
    <section aria-label={`Edit visit ${visit.name}`} className={className}>
      <h3 className="break-words font-semibold">Visit: {visit.name}</h3>
      <p className={`${MONO} text-xs text-slate-400`}>
        Type:{" "}
        {visit.type ? `${visit.type.decode} (${visit.type.code})` : "None"}
        {visit.isAnchor ? " · Fixed Reference anchor" : ""}
      </p>

      {conflicts.length > 0 && (
        <ul className="space-y-1 rounded border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs text-amber-200">
          {conflicts.map((conflict, idx) => (
            <li key={idx}>{conflict.message}</li>
          ))}
        </ul>
      )}

      <form onSubmit={handleRename} className="flex flex-wrap items-end gap-2">
        <label
          htmlFor={nameId}
          className="flex min-w-0 flex-1 flex-col gap-1 text-sm"
        >
          Visit name
          <input
            id={nameId}
            className={FIELD}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <button type="submit" className={`${BUTTON} min-w-12`}>
          Rename visit
        </button>
      </form>

      <form
        onSubmit={handleSaveTiming}
        className="space-y-3 border-t border-white/[0.08] pt-3"
      >
        <label htmlFor={dayId} className="flex min-w-0 flex-col gap-1 text-sm">
          Planned study day (no Day 0)
          <input
            id={dayId}
            type="number"
            className={FIELD}
            placeholder="Untimed"
            value={targetDayText}
            onChange={(event) => setTargetDayText(event.target.value)}
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label
            htmlFor={beforeId}
            className="flex min-w-0 flex-col gap-1 text-sm"
          >
            Window before (days)
            <input
              id={beforeId}
              type="number"
              min={0}
              className={FIELD}
              value={windowBeforeText}
              onChange={(event) => setWindowBeforeText(event.target.value)}
            />
          </label>
          <label
            htmlFor={afterId}
            className="flex min-w-0 flex-col gap-1 text-sm"
          >
            Window after (days)
            <input
              id={afterId}
              type="number"
              min={0}
              className={FIELD}
              value={windowAfterText}
              onChange={(event) => setWindowAfterText(event.target.value)}
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="submit" className={`${BUTTON} min-w-12`}>
            Save timing
          </button>
          {visit.targetDay !== null && !visit.isAnchor && (
            <button
              type="button"
              className={BUTTON}
              onClick={() => {
                if (
                  apply((w) =>
                    updateStudyEncounterTiming(w, visit.id, { targetDay: null })
                  )
                ) {
                  setTargetDayText("");
                }
              }}
            >
              Clear timing
            </button>
          )}
        </div>
      </form>

      <div className="flex flex-wrap gap-2 border-t border-white/[0.08] pt-3">
        <button
          type="button"
          className={BUTTON}
          disabled={visitIndex === 0}
          onClick={() =>
            apply((w) => moveStudyEncounter(w, visit.id, visitIndex - 1))
          }
        >
          Move earlier
        </button>
        <button
          type="button"
          className={BUTTON}
          disabled={visitIndex === visitCount - 1}
          onClick={() =>
            apply((w) => moveStudyEncounter(w, visit.id, visitIndex + 1))
          }
        >
          Move later
        </button>
        <button
          type="button"
          className={BUTTON}
          onClick={() => {
            if (apply((w) => removeStudyEncounter(w, visit.id))) {
              onClearSelection();
            }
          }}
        >
          Remove visit
        </button>
      </div>
    </section>
  );
}

function ActivityInspector({
  activity,
  activityIndex,
  activityCount,
  onClearSelection,
  apply,
  className,
}: {
  readonly activity: StudyScheduleActivity;
  readonly activityIndex: number;
  readonly activityCount: number;
  readonly onClearSelection: () => void;
  readonly apply: StudyApplyFn;
  readonly className: string;
}) {
  const [name, setName] = useState(activity.name);
  const nameId = useId();

  const handleRename = (event: FormEvent) => {
    event.preventDefault();
    apply((w) => renameStudyActivity(w, activity.id, name));
  };

  return (
    <section
      aria-label={`Edit activity ${activity.name}`}
      className={className}
    >
      <h3 className="break-words font-semibold">Activity: {activity.name}</h3>
      {activity.sdtmDomain && (
        <p className={`${MONO} text-xs text-slate-400`}>
          SDTM domain: {activity.sdtmDomain}
        </p>
      )}
      <form onSubmit={handleRename} className="flex flex-wrap items-end gap-2">
        <label
          htmlFor={nameId}
          className="flex min-w-0 flex-1 flex-col gap-1 text-sm"
        >
          Activity name
          <input
            id={nameId}
            className={FIELD}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <button type="submit" className={`${BUTTON} min-w-12`}>
          Rename activity
        </button>
      </form>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={BUTTON}
          disabled={activityIndex === 0}
          onClick={() =>
            apply((w) => moveStudyActivity(w, activity.id, activityIndex - 1))
          }
        >
          Move up
        </button>
        <button
          type="button"
          className={BUTTON}
          disabled={activityIndex === activityCount - 1}
          onClick={() =>
            apply((w) => moveStudyActivity(w, activity.id, activityIndex + 1))
          }
        >
          Move down
        </button>
        <button
          type="button"
          className={BUTTON}
          onClick={() => {
            if (apply((w) => removeStudyActivity(w, activity.id))) {
              onClearSelection();
            }
          }}
        >
          Remove activity
        </button>
      </div>
    </section>
  );
}

function ScheduleAddForms({ apply }: { readonly apply: StudyApplyFn }) {
  const [visitName, setVisitName] = useState("");
  const [visitTypeCode, setVisitTypeCode] = useState(
    STUDY_ENCOUNTER_TYPES[0]?.code ?? "C25716"
  );
  const [visitDay, setVisitDay] = useState("");
  const [visitWindowBefore, setVisitWindowBefore] = useState("0");
  const [visitWindowAfter, setVisitWindowAfter] = useState("0");
  const [activityName, setActivityName] = useState("");

  const vNameId = useId();
  const vTypeId = useId();
  const vDayId = useId();
  const vBeforeId = useId();
  const vAfterId = useId();
  const aNameId = useId();

  const submitVisit = (event: FormEvent) => {
    event.preventDefault();
    const trimmedDay = visitDay.trim();
    const parsedDay = trimmedDay === "" ? null : Number(trimmedDay);
    const parsedBefore =
      visitWindowBefore.trim() === "" ? 0 : Number(visitWindowBefore);
    const parsedAfter =
      visitWindowAfter.trim() === "" ? 0 : Number(visitWindowAfter);

    if (
      apply((w) =>
        addStudyEncounter(w, {
          name: visitName,
          typeCode: visitTypeCode,
          targetDay: parsedDay,
          windowBefore: parsedBefore,
          windowAfter: parsedAfter,
        })
      )
    ) {
      setVisitName("");
      setVisitDay("");
      setVisitWindowBefore("0");
      setVisitWindowAfter("0");
    }
  };

  const submitActivity = (event: FormEvent) => {
    event.preventDefault();
    if (apply((w) => addStudyActivity(w, { name: activityName }))) {
      setActivityName("");
    }
  };

  return (
    <div className="grid gap-4 @2xl:grid-cols-2">
      <form
        onSubmit={submitVisit}
        className="min-w-0 rounded-lg border border-white/[0.08] bg-[#13151a] p-4"
      >
        <fieldset className="min-w-0 space-y-3">
          <legend className="mb-1 font-semibold">Add a visit</legend>
          <div className="grid gap-2 @lg:grid-cols-2">
            <label
              htmlFor={vNameId}
              className="flex min-w-0 flex-col gap-1 text-sm"
            >
              New visit name
              <input
                id={vNameId}
                className={FIELD}
                value={visitName}
                onChange={(event) => setVisitName(event.target.value)}
              />
            </label>
            <label
              htmlFor={vTypeId}
              className="flex min-w-0 flex-col gap-1 text-sm"
            >
              Encounter type
              <select
                id={vTypeId}
                className={FIELD}
                value={visitTypeCode}
                onChange={(event) => setVisitTypeCode(event.target.value)}
              >
                {STUDY_ENCOUNTER_TYPES.map((term) => (
                  <option key={term.code} value={term.code}>
                    {term.decode} ({term.code})
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid gap-2 @lg:grid-cols-3">
            <label
              htmlFor={vDayId}
              className="flex min-w-0 flex-col gap-1 text-sm"
            >
              Study day (optional)
              <input
                id={vDayId}
                type="number"
                placeholder="Day 1 = anchor"
                className={FIELD}
                value={visitDay}
                onChange={(event) => setVisitDay(event.target.value)}
              />
            </label>
            <label
              htmlFor={vBeforeId}
              className="flex min-w-0 flex-col gap-1 text-sm"
            >
              Window before
              <input
                id={vBeforeId}
                type="number"
                min={0}
                className={FIELD}
                value={visitWindowBefore}
                onChange={(event) => setVisitWindowBefore(event.target.value)}
              />
            </label>
            <label
              htmlFor={vAfterId}
              className="flex min-w-0 flex-col gap-1 text-sm"
            >
              Window after
              <input
                id={vAfterId}
                type="number"
                min={0}
                className={FIELD}
                value={visitWindowAfter}
                onChange={(event) => setVisitWindowAfter(event.target.value)}
              />
            </label>
          </div>
          <button type="submit" className={`${BUTTON} min-w-12`}>
            Add visit
          </button>
        </fieldset>
      </form>

      <form
        onSubmit={submitActivity}
        className="min-w-0 rounded-lg border border-white/[0.08] bg-[#13151a] p-4"
      >
        <fieldset className="flex min-w-0 flex-col gap-3">
          <legend className="mb-1 font-semibold">Add an activity</legend>
          <label
            htmlFor={aNameId}
            className="flex min-w-0 flex-col gap-1 text-sm"
          >
            New activity name
            <input
              id={aNameId}
              className={FIELD}
              value={activityName}
              onChange={(event) => setActivityName(event.target.value)}
            />
          </label>
          <div>
            <button type="submit" className={`${BUTTON} min-w-12`}>
              Add activity
            </button>
          </div>
        </fieldset>
      </form>
    </div>
  );
}
