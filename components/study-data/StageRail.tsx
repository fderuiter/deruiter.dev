"use client";

import { RAIL_STAGES, type RailStageId } from "./copy";
import type { StageCounts } from "./protocol";
import { FOCUS } from "./ui";

/** Counts known before any run: the study definition's own. */
export interface DefinitionCounts {
  readonly arms: number;
  readonly visits: number;
  readonly activities: number;
  readonly scheduled: number;
}

interface StageRailProps {
  readonly definition: DefinitionCounts;
  /** Counts of the current run; `null` until the first run finishes. */
  readonly counts: StageCounts | null;
  readonly onOpen: (stage: RailStageId) => void;
}

const number = (value: number) => value.toLocaleString("en-US");

function metrics(
  stage: RailStageId,
  definition: DefinitionCounts,
  counts: StageCounts | null
): { value: string; unit: string; detail: string } {
  if (stage === "usdm") {
    return {
      value: number(definition.scheduled),
      unit: "scheduled activities",
      detail: `${definition.visits} visits · ${definition.activities} activities · ${definition.arms} arms`,
    };
  }
  if (!counts) return { value: "—", unit: "waiting for the run", detail: "" };
  switch (stage) {
    case "collected":
      return {
        value: number(counts.collected.records),
        unit: "source records",
        detail: `${counts.collected.datasets} domains · ${number(counts.collected.subjects)} screened subjects`,
      };
    case "sdtm":
      return {
        value: number(counts.sdtm.records),
        unit: "records",
        detail: `${counts.sdtm.datasets} datasets`,
      };
    case "conformance":
      return {
        value: number(counts.conformance.checks),
        unit: "rule checks",
        detail: `${counts.conformance.pass} pass · ${counts.conformance.warning} warn · ${counts.conformance.error} error · ${number(counts.conformance.findings)} findings`,
      };
    case "adam":
      return {
        value: number(counts.adam.records),
        unit: "analysis rows",
        detail: `${counts.adam.datasets} datasets`,
      };
    case "define":
      return {
        value: number(counts.define.variables),
        unit: "variables described",
        detail: `${counts.define.datasets} datasets · ${counts.define.codelists} codelists · ${counts.define.methods} methods`,
      };
    case "tlf":
      return {
        value: number(counts.tlf.results),
        unit: "analysis results",
        detail: `${counts.tlf.tables} tables · ${counts.tlf.figures} figure${counts.tlf.figures === 1 ? "" : "s"}`,
      };
  }
}

/**
 * The seven stages of a run in order, each with its counts and the practice
 * it demonstrates. Selecting a stage opens its viewer.
 */
export function StageRail({ definition, counts, onOpen }: StageRailProps) {
  return (
    <ol
      className="grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7"
      aria-label="Pipeline stages"
    >
      {RAIL_STAGES.map((stage, index) => {
        const metric = metrics(stage.id, definition, counts);
        return (
          <li
            key={stage.id}
            className="section-isolate flex min-w-0 flex-col border border-white/[0.08] bg-[#13151a] p-4"
          >
            <span className="font-mono text-xs tabular-nums text-amber-400">
              {String(index + 1).padStart(2, "0")} / 07
            </span>
            <h3 className="mt-3 text-lg font-semibold tracking-[-0.035em]">
              <button
                type="button"
                onClick={() => onOpen(stage.id)}
                className={`min-h-12 w-full text-left underline decoration-transparent underline-offset-4 transition-colors hover:text-amber-200 hover:decoration-amber-400/60 ${FOCUS}`}
              >
                {stage.label}
                <span className="sr-only">: open its viewer</span>
              </button>
            </h3>
            <p className="mt-1 font-mono text-2xl tabular-nums text-white">
              {metric.value}
            </p>
            <p className="text-xs text-slate-300">{metric.unit}</p>
            <p className="mt-1 min-h-8 break-words font-mono text-[11px] xl:min-h-[3.875rem] leading-snug text-slate-400">
              {metric.detail}
            </p>
            <p className="mt-3 break-words border-t border-white/[0.08] pt-3 text-xs leading-relaxed text-slate-300">
              <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.14em] text-emerald-300">
                Best practice shown here
              </span>
              {stage.practice}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
