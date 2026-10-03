"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  IconAlertTriangle,
  IconArchive,
  IconCheck,
  IconCircle,
  IconDownload,
  IconLoader2,
  IconRefresh,
  IconX,
} from "@tabler/icons-react";
import { ModalContainer } from "@/components/ui/ModalContainer";
import { downloadFile } from "@/lib/download";
import type { RawStorage } from "@/lib/safe-storage";
import type { StudyBaseline, StudyProtocol } from "@/lib/crf/types";
import {
  listStudyBaselines,
  computeStudyChecksum,
} from "@/lib/crf/study-baselines";
import {
  buildReviewPackage,
  createReviewPackageSnapshot,
  previewReviewPackage,
  ReviewPackageBuildError,
  reviewPackageFilename,
  zipReviewPackage,
  type ReviewPackageArtifact,
  type ReviewPackageManifest,
  type ReviewPackageOptionalArtifactId,
  type ReviewPackageProgress,
  type ReviewPackageStalenessResolver,
} from "@/lib/crf/review-package";

interface ReviewPackageModalProps {
  study: StudyProtocol;
  onClose: () => void;
  /** Optional per-scenario staleness decision; defaults to the form fingerprint check. */
  isScenarioStale?: ReviewPackageStalenessResolver;
  /** Storage holding saved baselines. Defaults to the browser's localStorage. */
  storage?: RawStorage;
}

type Phase = "preview" | "building" | "done" | "error";

interface BuildFailure {
  message: string;
  stepLabel?: string;
  completed: ReviewPackageArtifact[];
}

interface BuildOutcome {
  manifest: ReviewPackageManifest;
  archive: Uint8Array;
  filename: string;
}

type StepStatus = ReviewPackageProgress["status"] | "pending";

const ZIP_STEP = "zip";

function saveArchive(archive: Uint8Array, filename: string) {
  downloadFile(
    new Blob([archive.slice()], { type: "application/zip" }),
    filename
  );
}

function StatusIcon({ status }: { status: StepStatus }) {
  if (status === "running") {
    return (
      <IconLoader2
        className="w-4 h-4 shrink-0 animate-spin text-amber-400"
        aria-hidden="true"
      />
    );
  }
  if (status === "done" || status === "reused") {
    return (
      <IconCheck
        className="w-4 h-4 shrink-0 text-emerald-400"
        aria-hidden="true"
      />
    );
  }
  return (
    <IconCircle className="w-4 h-4 shrink-0 text-zinc-600" aria-hidden="true" />
  );
}

const STATUS_TEXT: Record<StepStatus, string> = {
  pending: "waiting",
  running: "in progress",
  done: "done",
  reused: "kept from the earlier attempt",
};

/**
 * Previews, generates and downloads a review package built from one snapshot
 * of the study (#680). Generation runs in the browser; nothing is uploaded.
 */
export function ReviewPackageModal({
  study,
  onClose,
  isScenarioStale,
  storage,
}: ReviewPackageModalProps) {
  const [snapshot, setSnapshot] = useState(() =>
    createReviewPackageSnapshot(study)
  );
  const [baselines] = useState<StudyBaseline[]>(() =>
    listStudyBaselines(storage)
  );
  const [baselineId, setBaselineId] = useState<string>(
    () => baselines.find((b) => b.study.id === study.id)?.id ?? ""
  );
  const [excluded, setExcluded] = useState<ReviewPackageOptionalArtifactId[]>(
    []
  );
  const [phase, setPhase] = useState<Phase>("preview");
  const [progress, setProgress] = useState<Record<string, StepStatus>>({});
  const [failure, setFailure] = useState<BuildFailure | null>(null);
  const [outcome, setOutcome] = useState<BuildOutcome | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const baseline = baselines.find((b) => b.id === baselineId) ?? null;
  const options = useMemo(
    () => ({ baseline, exclude: excluded, isScenarioStale }),
    [baseline, excluded, isScenarioStale]
  );
  const preview = useMemo(
    () => previewReviewPackage(snapshot, options),
    [snapshot, options]
  );
  const studyChangedSinceSnapshot = useMemo(
    () => computeStudyChecksum(study) !== snapshot.revision.checksum,
    [study, snapshot]
  );

  const included = preview.entries.filter((entry) => entry.included);
  const steps = [
    ...included.map((entry) => ({
      id: entry.id as string,
      label: entry.title,
    })),
    { id: "verify_native_source", label: "Reopen native source" },
    { id: "manifest", label: "Write manifest" },
    { id: ZIP_STEP, label: "Compress archive" },
  ];
  const finishedSteps = steps.filter(
    (step) => progress[step.id] === "done" || progress[step.id] === "reused"
  ).length;
  const currentStep = steps.find((step) => progress[step.id] === "running");
  const { findings } = preview;

  const handleClose = () => {
    abortRef.current?.abort();
    onClose();
  };

  const toggleArtifact = (id: ReviewPackageOptionalArtifactId) => {
    setExcluded((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    );
  };

  const retakeSnapshot = () => {
    setSnapshot(createReviewPackageSnapshot(study));
  };

  const generate = async (reuse?: ReviewPackageArtifact[]) => {
    const controller = new AbortController();
    abortRef.current = controller;
    setPhase("building");
    setFailure(null);
    setProgress({});
    try {
      const built = await buildReviewPackage(snapshot, {
        ...options,
        reuse,
        signal: controller.signal,
        onProgress: (p) => {
          if (!controller.signal.aborted) {
            setProgress((current) => ({ ...current, [p.stepId]: p.status }));
          }
        },
      });
      if (controller.signal.aborted) return;
      setProgress((current) => ({ ...current, [ZIP_STEP]: "running" }));
      const archive = await zipReviewPackage(built);
      if (controller.signal.aborted) return;
      const filename = reviewPackageFilename(built.manifest.revision);
      saveArchive(archive, filename);
      setProgress((current) => ({ ...current, [ZIP_STEP]: "done" }));
      setOutcome({ manifest: built.manifest, archive, filename });
      setPhase("done");
    } catch (err) {
      if (controller.signal.aborted) return;
      if (err instanceof ReviewPackageBuildError) {
        setFailure({
          message: err.message,
          stepLabel: err.stepLabel,
          completed: err.completed,
        });
      } else {
        setFailure({
          message: `The archive could not be written: ${err instanceof Error ? err.message : String(err)}`,
          stepLabel: "Compress archive",
          completed: [],
        });
      }
      setPhase("error");
    }
  };

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    []
  );

  const isBusy = phase === "building";

  return (
    <ModalContainer
      isOpen={true}
      onClose={handleClose}
      titleId="review-package-title"
      ariaDescribedBy="review-package-description"
      maxWidth="max-w-3xl"
      closeOnBackdropClick={!isBusy}
      className="bg-zinc-900 border-zinc-800"
    >
      <div className="flex items-start justify-between gap-3 px-4 sm:px-6 py-4 border-b border-zinc-800 bg-zinc-950">
        <div className="flex items-start gap-3 min-w-0">
          <span className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-amber-400 shrink-0">
            <IconArchive className="w-5 h-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2
              id="review-package-title"
              className="text-base font-bold text-white font-mono tracking-tight"
            >
              Review package
            </h2>
            <p
              id="review-package-description"
              className="text-xs text-zinc-400 font-sans break-words"
            >
              One archive from one study revision: native source, forms,
              dictionary, schedule, checks and reports, described by a manifest.
              Built in your browser.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close review package"
          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors shrink-0"
        >
          <IconX className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 text-sm">
        <section
          aria-labelledby="review-package-revision"
          className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1 min-w-0"
        >
          <h3
            id="review-package-revision"
            className="text-xs font-bold uppercase tracking-wide text-zinc-400 font-mono"
          >
            Snapshot
          </h3>
          <p className="text-white font-mono break-words">
            {preview.revision.protocolNumber} · version{" "}
            {preview.revision.version || "unversioned"}
          </p>
          <p className="text-xs text-zinc-400 font-mono break-all">
            Checksum {preview.revision.checksum}
          </p>
          {studyChangedSinceSnapshot && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-amber-300">
              <IconAlertTriangle
                className="w-4 h-4 shrink-0"
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1">
                The study changed after this snapshot. The package describes the
                snapshot, not your latest edits.
              </span>
              <button
                type="button"
                onClick={retakeSnapshot}
                disabled={isBusy}
                className="px-2.5 py-1 rounded-lg border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 font-mono disabled:opacity-50"
              >
                Retake snapshot
              </button>
            </div>
          )}
        </section>

        {phase === "preview" && (
          <>
            <div className="space-y-1.5">
              <label
                htmlFor="review-package-baseline"
                className="block text-xs font-bold text-zinc-300 font-mono"
              >
                Compare against baseline
              </label>
              <select
                id="review-package-baseline"
                value={baselineId}
                onChange={(e) => setBaselineId(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-200"
              >
                <option value="">
                  No baseline: leave the change summary out
                </option>
                {baselines.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.versionTag} · {b.label}
                  </option>
                ))}
              </select>
            </div>

            <fieldset className="space-y-2 min-w-0">
              <legend className="text-xs font-bold text-zinc-300 font-mono mb-1">
                Contents
              </legend>
              <ul className="space-y-1.5">
                {preview.entries.map((entry) => {
                  const inputId = `review-package-entry-${entry.id}`;
                  const unavailable =
                    !entry.required &&
                    !entry.included &&
                    !excluded.includes(
                      entry.id as ReviewPackageOptionalArtifactId
                    );
                  return (
                    <li
                      key={entry.id}
                      className="flex items-start gap-2.5 p-2 rounded-lg border border-zinc-800 bg-zinc-950 min-w-0"
                    >
                      <input
                        id={inputId}
                        type="checkbox"
                        className="mt-1 shrink-0"
                        checked={entry.included}
                        disabled={entry.required || unavailable}
                        onChange={() =>
                          toggleArtifact(
                            entry.id as ReviewPackageOptionalArtifactId
                          )
                        }
                      />
                      <label htmlFor={inputId} className="min-w-0 flex-1">
                        <span className="block text-xs font-bold text-zinc-100">
                          {entry.title}
                          {entry.required && (
                            <span className="ml-2 font-normal text-zinc-400">
                              (always included)
                            </span>
                          )}
                        </span>
                        <span className="block text-[11px] font-mono text-zinc-400 break-all">
                          {entry.path}
                        </span>
                        <span className="block text-[11px] text-zinc-400 break-words">
                          {entry.excludedReason
                            ? `Not included: ${entry.excludedReason}`
                            : entry.description}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              <p className="text-[11px] text-zinc-400">
                Every package also contains MANIFEST.json and README.txt.
              </p>
            </fieldset>

            <section
              aria-labelledby="review-package-scope"
              className="space-y-1"
            >
              <h3
                id="review-package-scope"
                className="text-xs font-bold text-zinc-300 font-mono"
              >
                Scope
              </h3>
              <p className="text-xs text-zinc-400 font-mono break-words">
                {preview.scope.forms} forms · {preview.scope.fields} fields ·{" "}
                {preview.scope.visits} visits · {preview.scope.rules} checks ·{" "}
                {preview.scope.codelists} codelists ·{" "}
                {preview.scope.testScenarios} test scenarios ·{" "}
                {preview.scope.reviewThreads} review threads
              </p>
            </section>

            <section
              aria-labelledby="review-package-findings"
              className="space-y-1.5"
            >
              <h3
                id="review-package-findings"
                className="text-xs font-bold text-zinc-300 font-mono"
              >
                Unresolved findings carried into the manifest
              </h3>
              <ul className="text-xs text-zinc-300 space-y-1">
                <li>
                  {findings.openReviewThreads.length} open review thread(s)
                </li>
                <li>
                  {findings.staleTests.length} stale test(s)
                  {findings.staleTests.length > 0 &&
                    `: ${findings.staleTests.map((t) => t.name).join(", ")}`}
                </li>
                <li>
                  {findings.failingTests.length} failing,{" "}
                  {findings.neverRunTests.length} never run,{" "}
                  {findings.passingTestCount} passing
                </li>
                <li>
                  {findings.readiness.errors.length} readiness error(s),{" "}
                  {findings.readiness.warnings.length} warning(s)
                </li>
              </ul>
            </section>

            <details className="text-xs text-zinc-400">
              <summary className="cursor-pointer font-mono text-zinc-300">
                Export limitations ({preview.limitations.length})
              </summary>
              <ul className="mt-2 list-disc pl-5 space-y-1">
                {preview.limitations.map((limitation) => (
                  <li key={limitation} className="break-words">
                    {limitation}
                  </li>
                ))}
              </ul>
            </details>
          </>
        )}

        {(phase === "building" || phase === "error" || phase === "done") && (
          <section
            aria-labelledby="review-package-progress"
            className="space-y-2"
          >
            <h3
              id="review-package-progress"
              className="text-xs font-bold text-zinc-300 font-mono"
            >
              Progress
            </h3>
            <progress
              className="w-full h-2"
              max={steps.length}
              value={finishedSteps}
              aria-label="Review package progress"
            />
            <p
              role="status"
              aria-live="polite"
              className="text-xs text-zinc-400"
            >
              {phase === "building"
                ? currentStep
                  ? `Generating ${currentStep.label} (${finishedSteps + 1} of ${steps.length})`
                  : `Preparing (${finishedSteps} of ${steps.length})`
                : phase === "done" && outcome
                  ? `Package ready: ${outcome.filename}`
                  : ""}
            </p>
            <ol className="space-y-1">
              {steps.map((step) => {
                const status = progress[step.id] ?? "pending";
                return (
                  <li
                    key={step.id}
                    className="flex items-center gap-2 text-xs text-zinc-300 min-w-0"
                  >
                    <StatusIcon status={status} />
                    <span className="min-w-0 flex-1 break-words">
                      {step.label}
                    </span>
                    <span className="text-zinc-400 font-mono shrink-0">
                      {STATUS_TEXT[status]}
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        {phase === "error" && failure && (
          <div
            role="alert"
            className="p-3 rounded-xl border border-red-800/60 bg-red-950/40 text-red-200 text-xs space-y-1"
          >
            <p className="font-bold">
              {failure.stepLabel
                ? `${failure.stepLabel} failed.`
                : "Generation failed."}
            </p>
            <p className="break-words">{failure.message}</p>
            <p>
              {failure.completed.length > 0
                ? `Retry keeps the ${failure.completed.length} file(s) already generated from this snapshot.`
                : "Nothing was downloaded. Retry starts again from this snapshot."}
            </p>
          </div>
        )}

        {phase === "done" && outcome && (
          <div className="p-3 rounded-xl border border-emerald-800/60 bg-emerald-950/30 text-emerald-200 text-xs space-y-1">
            <p className="font-bold break-all">Downloaded {outcome.filename}</p>
            <p>
              {outcome.manifest.contents.length} files from revision{" "}
              {outcome.manifest.revision.checksum}.{" "}
              {outcome.manifest.nativeSource.reopens
                ? "The included native source was reopened and checked."
                : `The included native source does not reopen: ${outcome.manifest.nativeSource.error}`}
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 px-4 sm:px-6 py-3 border-t border-zinc-800 bg-zinc-950">
        {phase === "building" ? (
          <button
            type="button"
            onClick={handleClose}
            className="px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-mono"
          >
            Cancel
          </button>
        ) : phase === "error" ? (
          <>
            <button
              type="button"
              onClick={() => setPhase("preview")}
              className="px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-mono"
            >
              Back to preview
            </button>
            <button
              type="button"
              onClick={() => generate(failure?.completed)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-mono font-bold active:scale-[0.98]"
            >
              <IconRefresh className="w-4 h-4" aria-hidden="true" />
              Retry
            </button>
          </>
        ) : phase === "done" && outcome ? (
          <>
            <button
              type="button"
              onClick={() => saveArchive(outcome.archive, outcome.filename)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-mono"
            >
              <IconDownload className="w-4 h-4" aria-hidden="true" />
              Download again
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-white text-black text-xs font-mono font-bold"
            >
              Done
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={handleClose}
              className="px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-mono"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => generate()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-mono font-bold active:scale-[0.98]"
            >
              <IconArchive className="w-4 h-4" aria-hidden="true" />
              Generate package ({included.length + 2} files)
            </button>
          </>
        )}
      </div>
    </ModalContainer>
  );
}
