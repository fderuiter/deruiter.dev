"use client";

import { useMemo, useState } from "react";
import type { StudyRepositoryClient } from "@/components/clinical/study-repository-client";
import { useStudyRepository } from "@/components/clinical/useStudyRepository";
import {
  adaptUsdmScheduleToProtocolDrift,
  type ProtocolDriftScheduleSource,
} from "@/lib/protocol-drift";
import { DEMO_301_USDM } from "@/lib/study-data/presets";

export function ProtocolDriftWorkspaceBar({
  repository,
}: {
  readonly repository?: StudyRepositoryClient;
}) {
  const [source, setSource] =
    useState<ProtocolDriftScheduleSource>("workspace");
  const { snapshot } = useStudyRepository(repository);

  const activeUsdm = snapshot.activeRecord?.workspace.usdm ?? DEMO_301_USDM;
  const revision = snapshot.activeRecord?.workspace.revision ?? null;

  const workspaceSchedule = useMemo(
    () => adaptUsdmScheduleToProtocolDrift(activeUsdm, { source: "workspace" }),
    [activeUsdm]
  );
  const activeSchedule = useMemo(
    () =>
      source === "pd-101"
        ? adaptUsdmScheduleToProtocolDrift(null, { source: "pd-101" })
        : workspaceSchedule,
    [source, workspaceSchedule]
  );

  return (
    <section
      aria-label="Active USDM schedule adapter"
      className="min-w-0 rounded-lg border border-zinc-800 bg-[#13151a] p-3.5 text-xs text-[#f4f4f6]"
    >
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-wider text-slate-400">
            Submission Wave Schedule Source
          </p>
          <p className="mt-0.5 break-words font-medium text-[#f4f4f6]">
            {activeSchedule.studyId} — {activeSchedule.studyTitle}
            {source === "workspace" && revision ? (
              <span className="ml-2 font-mono text-[11px] text-slate-400">
                {revision.id} · {revision.sha256.slice(0, 8)}
              </span>
            ) : null}
          </p>
        </div>
        <div
          role="group"
          aria-label="Schedule source preset"
          className="inline-flex min-w-0 flex-wrap rounded-md border border-zinc-800 bg-[#0d0e11] p-1"
        >
          <button
            type="button"
            aria-pressed={source === "workspace"}
            onClick={() => setSource("workspace")}
            className={`min-h-11 rounded px-3 py-1.5 font-mono text-[11px] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 ${
              source === "workspace"
                ? "bg-emerald-500/20 text-emerald-300"
                : "text-slate-300 hover:text-[#f4f4f6]"
            }`}
          >
            Active USDM ({workspaceSchedule.studyId})
          </button>
          <button
            type="button"
            aria-pressed={source === "pd-101"}
            onClick={() => setSource("pd-101")}
            className={`min-h-11 rounded px-3 py-1.5 font-mono text-[11px] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 ${
              source === "pd-101"
                ? "bg-amber-500/20 text-amber-300"
                : "text-slate-300 hover:text-[#f4f4f6]"
            }`}
          >
            Classic PD-101 preset
          </button>
        </div>
      </div>

      <div className="mt-3 grid min-w-0 gap-2 sm:grid-cols-3">
        {activeSchedule.waves.map((wave) => (
          <div
            key={wave.wave}
            className="min-w-0 rounded border border-zinc-800 bg-[#0d0e11] p-2.5"
          >
            <div className="flex min-w-0 items-center justify-between gap-2 font-mono text-[11px]">
              <span className="font-semibold text-[#f4f4f6]">
                Wave {wave.wave}
              </span>
              <span className="text-slate-400">Day {wave.releaseDay}</span>
            </div>
            <p className="mt-1 truncate text-[11px] text-slate-300">
              {wave.encounterNames.join(" · ")}
            </p>
            <p className="mt-1 break-words font-mono text-[10px] text-slate-400">
              Sites: {wave.siteIds.join(", ")} · {wave.scheduledAssessmentCount}{" "}
              scheduled assessments
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
