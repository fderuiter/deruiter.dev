"use client";

import { useRovingGrid } from "./useRovingGrid";
import { CELL, CELL_FOCUS, SELECTED, TABLE_SCROLL } from "./ui";

/** The parts of the study design the schedule view shows. */
export interface ScheduleDesign {
  readonly studyId: string;
  readonly title: string;
  readonly phase: string;
  readonly blinding: string;
  readonly arms: readonly { readonly id: string; readonly name: string }[];
  readonly visits: readonly {
    readonly id: string;
    readonly name: string;
    readonly visitNum: number;
    readonly targetDay: number;
    readonly windowBefore: number;
    readonly windowAfter: number;
  }[];
  readonly activities: readonly {
    readonly id: string;
    readonly name: string;
    readonly domain: string;
    readonly tests: readonly string[];
  }[];
  readonly schedule: readonly {
    readonly visitId: string;
    readonly activityId: string;
  }[];
}

interface ScheduleViewerProps {
  readonly design: ScheduleDesign;
  /** The activity and visit the lineage explorer is showing, if any. */
  readonly selected: { activityId: string; visitId?: string } | null;
  readonly onTrace: (activityId: string, visitId?: string) => void;
}

function windowText(before: number, after: number): string {
  if (before === 0 && after === 0) return "no window";
  if (before === after) return `±${before} d`;
  return `−${before}/+${after} d`;
}

/**
 * The schedule of activities read from the USDM study definition, as a
 * grid. A scheduled cell traces that activity at that visit forward to the
 * records and results it produced; an activity's row header traces it at
 * every visit.
 */
export function ScheduleViewer({
  design,
  selected,
  onTrace,
}: ScheduleViewerProps) {
  const { onKeyDown, cellProps } = useRovingGrid();
  const planned = new Set(
    design.schedule.map((cell) => `${cell.activityId}|${cell.visitId}`)
  );
  return (
    <div className="min-w-0 space-y-5">
      <dl className="grid min-w-0 gap-x-6 gap-y-2 text-xs sm:grid-cols-3">
        {[
          ["Study", `${design.studyId} (fictional)`],
          ["Design", `${design.phase} · ${design.blinding}`],
          ["Arms", design.arms.map((arm) => arm.name).join(" · ")],
        ].map(([term, value]) => (
          <div key={term} className="min-w-0">
            <dt className="text-slate-400">{term}</dt>
            <dd className="break-words text-slate-100">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="max-w-3xl text-sm leading-relaxed text-slate-300">
        Select a scheduled activity to follow it forward to the records and
        results it produced, or an activity&apos;s name to follow it at every
        visit.
      </p>
      <div className={TABLE_SCROLL}>
        <table
          role="grid"
          aria-label="Schedule of activities"
          className="w-full border-collapse"
          onKeyDown={onKeyDown}
        >
          <thead>
            <tr className="border-y border-white/[0.12]">
              <th
                scope="col"
                {...cellProps(0, 0)}
                className={`${CELL} font-sans text-slate-300 ${CELL_FOCUS}`}
              >
                Activity
              </th>
              {design.visits.map((visit, index) => (
                <th
                  key={visit.id}
                  scope="col"
                  {...cellProps(0, index + 1)}
                  className={`${CELL} text-center font-sans text-slate-200 ${CELL_FOCUS}`}
                >
                  {visit.name}
                  <span className="block font-mono text-[11px] font-normal text-slate-400">
                    Day {visit.targetDay} ·{" "}
                    {windowText(visit.windowBefore, visit.windowAfter)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {design.activities.map((activity, rowIndex) => {
              const rowSelected =
                selected?.activityId === activity.id &&
                selected.visitId === undefined;
              return (
                <tr key={activity.id} className="border-b border-white/[0.04]">
                  <th
                    scope="row"
                    {...cellProps(rowIndex + 1, 0)}
                    aria-selected={rowSelected}
                    onClick={() => onTrace(activity.id)}
                    className={`${CELL} cursor-pointer whitespace-normal font-sans font-normal hover:bg-white/[0.04] ${rowSelected ? SELECTED : "text-slate-100"} ${CELL_FOCUS}`}
                  >
                    <span className="block font-semibold">{activity.name}</span>
                    <span className="block font-mono text-[11px] text-slate-400">
                      {activity.domain}
                      {activity.tests.length > 0
                        ? ` · ${activity.tests.join(", ")}`
                        : ""}
                    </span>
                  </th>
                  {design.visits.map((visit, index) => {
                    const isPlanned = planned.has(`${activity.id}|${visit.id}`);
                    const isSelected =
                      selected?.activityId === activity.id &&
                      selected.visitId === visit.id;
                    return (
                      <td
                        key={visit.id}
                        role="gridcell"
                        {...cellProps(rowIndex + 1, index + 1)}
                        aria-selected={isPlanned ? isSelected : undefined}
                        aria-label={
                          isPlanned
                            ? `${activity.name} planned at ${visit.name}`
                            : `${activity.name} not planned at ${visit.name}`
                        }
                        onClick={
                          isPlanned
                            ? () => onTrace(activity.id, visit.id)
                            : undefined
                        }
                        className={`${CELL} text-center ${isPlanned ? "cursor-pointer hover:bg-white/[0.04]" : ""} ${isSelected ? SELECTED : isPlanned ? "text-amber-300" : "text-slate-400"} ${CELL_FOCUS}`}
                      >
                        <span aria-hidden="true">{isPlanned ? "●" : "·"}</span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
