"use client";

import { useEffect, useId, useState, useSyncExternalStore } from "react";
import {
  CLINICAL_STUDIES,
  DEMO_STUDY_ID,
  readSelectedStudy,
  subscribeSelectedStudy,
  writeSelectedStudy,
  type ClinicalStudyId,
} from "@/lib/clinical-study-context";
import type { StudyRepositoryRecord } from "@/lib/study-workspace";
import { StudyRepositoryBar } from "./StudyRepositoryBar";
import type { StudyRepositoryClient } from "./study-repository-client";
import { useStudyRepository } from "./useStudyRepository";

const plural = (n: number, word: string) =>
  `${n}\u00a0${word}${n === 1 ? "" : "s"}`;

const getServerSnapshot = (): ClinicalStudyId => DEMO_STUDY_ID;

/**
 * Picks the active study across the clinical tools (#3157, ADR 0074).
 * Before IndexedDB hydration finishes, renders the deterministic DEMO-301
 * snapshot; once hydrated, lists every seeded, imported, and authored study
 * in the shared browser repository and offers direct USDM / workspace
 * import and export.
 */
export function StudyPicker({
  className = "",
  repository: customRepository,
}: {
  readonly className?: string;
  readonly repository?: StudyRepositoryClient;
}) {
  const id = useId();
  const tabSelected = useSyncExternalStore(
    subscribeSelectedStudy,
    readSelectedStudy,
    getServerSnapshot
  );
  const { snapshot, repository } = useStudyRepository(customRepository);
  const [viewedBinding, setViewedBinding] = useState<{
    readonly studyId: string;
    readonly revisionId: string;
  } | null>(null);

  const selectedId =
    snapshot.isHydrated && snapshot.activeStudyId !== null
      ? snapshot.activeStudyId
      : tabSelected;

  useEffect(() => {
    let live = true;
    void repository
      .initialize()
      .then(() => repository.whenIdle())
      .then(() => {
        if (!live) return;
        const ready = repository.getSnapshot();
        const targetId = ready.activeStudyId ?? DEMO_STUDY_ID;
        const summary = ready.studies.find(
          (entry) => entry.studyId === targetId
        );
        if (summary) {
          setViewedBinding({
            studyId: targetId,
            revisionId: summary.revisionId,
          });
        }
      });
    return () => {
      live = false;
    };
  }, [repository, selectedId, snapshot.activeStudyId, snapshot.remoteEventSeq]);

  const activeRepoSummary = snapshot.isHydrated
    ? (snapshot.studies.find((entry) => entry.studyId === selectedId) ?? null)
    : null;

  const displayedRevisionId =
    viewedBinding?.studyId === selectedId
      ? viewedBinding.revisionId
      : activeRepoSummary?.revisionId;

  const demoFallback = CLINICAL_STUDIES[DEMO_STUDY_ID];
  const isUneditedDemo =
    selectedId === DEMO_STUDY_ID &&
    (!activeRepoSummary || activeRepoSummary.revisionId === "R1");

  const syncViewedRecord = (record: StudyRepositoryRecord) => {
    setViewedBinding({
      studyId: record.studyId,
      revisionId: record.workspace.revision.id,
    });
  };

  return (
    <section
      aria-label="Study picker"
      data-testid="study-picker"
      className={`min-w-0 max-w-4xl border border-white/[0.08] bg-[#13151a] p-4 sm:p-5 ${className}`}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <label
          htmlFor={id}
          className="font-mono text-xs uppercase tracking-[0.18em] text-slate-400"
        >
          Study
        </label>
        <select
          id={id}
          value={selectedId}
          onChange={(event) => {
            const next = event.target.value;
            if (next in CLINICAL_STUDIES) {
              writeSelectedStudy(next as ClinicalStudyId);
            }
            if (snapshot.isHydrated) {
              void repository.selectStudy(next).then((record) => {
                if (record) syncViewedRecord(record);
              });
            }
          }}
          className="min-h-12 min-w-0 max-w-full border border-white/[0.12] bg-[#0d0e11] px-3 py-2 font-mono text-sm text-[#f4f4f6] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
        >
          {!snapshot.isHydrated || snapshot.studies.length === 0
            ? Object.values(CLINICAL_STUDIES).map((option) => (
                <option key={option.id} value={option.id}>
                  {option.id}
                </option>
              ))
            : snapshot.studies.map((option) => (
                <option key={option.studyId} value={option.studyId}>
                  {option.studyId === DEMO_STUDY_ID
                    ? DEMO_STUDY_ID
                    : `${option.protocolCode} (${option.revisionId})`}
                </option>
              ))}
        </select>
        <span className="border border-amber-500/40 px-2 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-amber-300">
          Synthetic data
        </span>
      </div>
      <p
        data-testid="study-picker-summary"
        className="mt-3 min-w-0 break-words text-sm leading-relaxed text-slate-300"
      >
        {isUneditedDemo || !activeRepoSummary ? (
          <>
            <span className="text-[#f4f4f6]">{demoFallback.title}.</span>{" "}
            <span className="mt-1 block font-mono text-xs text-slate-400">
              {plural(demoFallback.forms, "form")} ·{" "}
              {plural(demoFallback.datasets, "dataset")} ·{" "}
              {plural(demoFallback.tlfs, "TLF")}
            </span>
          </>
        ) : (
          <>
            <span className="text-[#f4f4f6]">{activeRepoSummary.title}.</span>{" "}
            <span className="mt-1 block font-mono text-xs text-slate-400">
              {plural(activeRepoSummary.activityCount, "form")} ·{" "}
              {plural(activeRepoSummary.encounterCount, "visit")} ·{" "}
              {plural(activeRepoSummary.armCount, "arm")} · Revision{" "}
              {displayedRevisionId ?? activeRepoSummary.revisionId}
            </span>
          </>
        )}
      </p>
      {snapshot.isHydrated ? (
        <StudyRepositoryBar
          repository={repository}
          currentStudyId={selectedId}
          currentRevisionId={displayedRevisionId}
          onSelectStudy={syncViewedRecord}
          onReloadLatest={syncViewedRecord}
          showStudySelect={false}
          compact
          className="mt-4"
        />
      ) : null}
    </section>
  );
}
