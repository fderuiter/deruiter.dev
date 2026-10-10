"use client";

import React, { useMemo, useState } from "react";
import {
  IconGitCompare,
  IconX,
  IconPlus,
  IconMinus,
  IconPencil,
  IconArrowRight,
  IconCircleCheck,
  IconFileSpreadsheet,
  IconFileCode,
  IconFileText,
  IconCopy,
  IconCheck,
} from "@tabler/icons-react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { CopyButton } from "@/components/ui/CopyButton";
import { StudyProtocol, StudyBaseline } from "@/lib/crf/types";
import { listStudyBaselines } from "@/lib/crf/study-baselines";
import {
  MAX_FILE_SIZE_BYTES,
  detectAndParseStudyFile,
} from "@/lib/crf/file-ingestion";
import {
  compareStudyToBaseline,
  describeBaselineDiffCategory,
  describeBaselineDiffChangeType,
  type BaselineDiffEntry,
  type BaselineDiffCategory,
  type BaselineComparisonResult,
} from "@/lib/crf/study-baseline-diff";
import {
  exportBaselineDiffCsv,
  exportBaselineDiffJson,
  exportBaselineDiffText,
  serializeBaselineDiffToText,
} from "@/lib/crf/export-baseline-diff";

export interface BaselineCompareNavigationTarget {
  mode: "designer" | "rules" | "matrix";
  formId?: string;
  sectionId?: string;
  fieldId?: string;
  visitId?: string;
}

interface BaselineCompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  study: StudyProtocol;
  /** Baseline id preselected from a shared/reopened link (URL hash), if any. */
  initialBaselineId?: string | null;
  onSelectBaseline: (baselineId: string | null) => void;
  onNavigate: (target: BaselineCompareNavigationTarget) => void;
  storage?: Storage;
}

const CATEGORY_ORDER: BaselineDiffCategory[] = [
  "study_metadata",
  "form",
  "section",
  "field",
  "formula",
  "rule",
  "codelist",
  "schedule",
];

function changeTypeBadgeClasses(
  changeType: BaselineDiffEntry["changeType"]
): string {
  switch (changeType) {
    case "added":
      return "bg-emerald-950/60 text-emerald-300 border-emerald-800/50";
    case "removed":
      return "bg-rose-950/60 text-rose-300 border-rose-800/50";
    case "modified":
      return "bg-amber-950/60 text-amber-300 border-amber-800/50";
  }
}

function ChangeTypeBadge({
  changeType,
}: {
  changeType: BaselineDiffEntry["changeType"];
}) {
  const Icon =
    changeType === "added"
      ? IconPlus
      : changeType === "removed"
        ? IconMinus
        : IconPencil;
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border shrink-0 ${changeTypeBadgeClasses(
        changeType
      )}`}
    >
      <Icon className="w-3 h-3" aria-hidden="true" />
      {/* Text equivalent so the change type never relies on color alone. */}
      <span>{describeBaselineDiffChangeType(changeType)}</span>
    </span>
  );
}

function formatValue(value: unknown): string {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function DiffEntryRow({
  entry,
  onNavigate,
}: {
  entry: BaselineDiffEntry;
  onNavigate: (entry: BaselineDiffEntry) => void;
}) {
  return (
    <li className="p-3 rounded-xl bg-zinc-900/70 border border-zinc-800 hover:border-zinc-700 transition-all space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <ChangeTypeBadge changeType={entry.changeType} />
            <span className="text-xs font-bold text-white break-words">
              {entry.breadcrumb.join(" › ")}
            </span>
          </div>
          {entry.changedFields && entry.changedFields.length > 0 && (
            <p className="text-[11px] text-zinc-400 mt-1">
              Changed: {entry.changedFields.join(", ")}
            </p>
          )}
        </div>

        {entry.navigationMode && (
          <button
            type="button"
            onClick={() => onNavigate(entry)}
            className="shrink-0 flex items-center gap-1 px-2 py-1 bg-brand-cyan/15 hover:bg-brand-cyan/25 text-brand-cyan border border-brand-cyan/30 rounded-lg text-[11px] font-mono font-semibold transition-all"
          >
            <span>Jump to</span>
            <IconArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>

      {(entry.oldValue !== undefined || entry.newValue !== undefined) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono pt-1 border-t border-zinc-850/80">
          <div className="min-w-0">
            <span className="text-zinc-500">Old: </span>
            <span className="text-rose-300 break-words">
              {formatValue(entry.oldValue)}
            </span>
          </div>
          <div className="min-w-0">
            <span className="text-zinc-500">New: </span>
            <span className="text-emerald-300 break-words">
              {formatValue(entry.newValue)}
            </span>
          </div>
        </div>
      )}

      {entry.affectedUses && entry.affectedUses.length > 0 && (
        <p className="text-[11px] text-amber-300/90 pt-1 border-t border-zinc-850/80">
          Still referenced by: {entry.affectedUses.join("; ")}
        </p>
      )}
    </li>
  );
}

interface CompareTarget {
  study: StudyProtocol;
  meta: { id: string; versionTag: string; label: string };
}

const SOURCE_BUTTON =
  "min-h-[32px] rounded-md px-2.5 py-1 text-xs font-mono transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-brand-cyan";

export const BaselineCompareModal: React.FC<BaselineCompareModalProps> = ({
  isOpen,
  onClose,
  study,
  initialBaselineId,
  onSelectBaseline,
  onNavigate,
  storage,
}) => {
  const [baselines] = useState<StudyBaseline[]>(() =>
    listStudyBaselines(storage)
  );
  const [source, setSource] = useState<"baseline" | "file">("baseline");
  const [fileTarget, setFileTarget] = useState<{
    study: StudyProtocol;
    fileName: string;
    formatLabel: string;
  } | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [selectedBaselineId, setSelectedBaselineId] = useState<string | null>(
    initialBaselineId ?? baselines[0]?.id ?? null
  );
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<
    BaselineDiffCategory | "all"
  >("all");

  const containerRef = useFocusTrap<HTMLDivElement>(isOpen, {
    onEscape: onClose,
  });

  const selectedBaseline = useMemo(
    () => baselines.find((b) => b.id === selectedBaselineId) || null,
    [baselines, selectedBaselineId]
  );

  const target: CompareTarget | null = useMemo(() => {
    if (source === "file") {
      return fileTarget
        ? {
            study: fileTarget.study,
            meta: {
              id: "study-file",
              versionTag: fileTarget.formatLabel,
              label: fileTarget.fileName,
            },
          }
        : null;
    }
    return selectedBaseline
      ? {
          study: selectedBaseline.study,
          meta: {
            id: selectedBaseline.id,
            versionTag: selectedBaseline.versionTag,
            label: selectedBaseline.label,
          },
        }
      : null;
  }, [source, fileTarget, selectedBaseline]);

  const comparison: BaselineComparisonResult | null = useMemo(
    () =>
      target ? compareStudyToBaseline(study, target.study, target.meta) : null,
    [study, target]
  );

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setFileTarget(null);
      setFileError("That file is larger than the 50MB limit.");
      return;
    }
    file
      .text()
      .then((text) => {
        const parsed = detectAndParseStudyFile(text, file.name, file.size);
        setFileTarget({
          study: parsed.study,
          fileName: parsed.fileName,
          formatLabel: parsed.formatLabel,
        });
        setFileError(null);
      })
      .catch((err: unknown) => {
        setFileTarget(null);
        setFileError(
          err instanceof Error ? err.message : "Could not read that file."
        );
      });
  };

  const handleSelectBaseline = (id: string) => {
    setSelectedBaselineId(id || null);
    onSelectBaseline(id || null);
  };

  const handleNavigate = (entry: BaselineDiffEntry) => {
    if (!entry.navigationMode) return;
    onNavigate({
      mode: entry.navigationMode,
      formId: entry.formId,
      sectionId: entry.sectionId,
      fieldId: entry.category === "field" ? entry.id : undefined,
      visitId: entry.visitId,
    });
    onClose();
  };

  const hasChanges = Boolean(comparison?.summary.hasChanges);

  const handleExportCsv = () => {
    if (!comparison) return;
    exportBaselineDiffCsv(comparison);
  };

  const handleExportJson = () => {
    if (!comparison) return;
    exportBaselineDiffJson(comparison);
  };

  const handleExportText = () => {
    if (!comparison) return;
    exportBaselineDiffText(comparison);
  };

  if (!isOpen) return null;

  const visibleEntries =
    comparison?.entries.filter(
      (e) =>
        activeCategoryFilter === "all" || e.category === activeCategoryFilter
    ) || [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="baseline-compare-modal-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl bg-zinc-950 border border-zinc-750 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] border-brand-cyan/30 text-zinc-100"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-800 bg-zinc-900/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 rounded-lg bg-brand-cyan/10 text-brand-cyan">
              <IconGitCompare className="w-5 h-5" />
            </span>
            <div>
              <h2
                id="baseline-compare-modal-title"
                className="text-sm font-mono font-bold text-white uppercase tracking-wider"
              >
                Compare Against Baseline
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Review meaningful additions, deletions and modifications against
                a saved baseline snapshot.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close Baseline Comparison"
            className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <IconX className="w-5 h-5" />
          </button>
        </div>

        {/* Baseline picker & Export Toolbar */}
        <div className="px-4 sm:px-5 py-3 border-b border-zinc-850 bg-zinc-950 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex min-w-0 items-center gap-3 flex-wrap">
            <div
              role="group"
              aria-label="Compare against"
              className="flex gap-1 rounded-lg border border-zinc-800 bg-zinc-900 p-0.5"
            >
              {(
                [
                  ["baseline", "Saved baseline"],
                  ["file", "Study file"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={source === id}
                  onClick={() => setSource(id)}
                  className={`${SOURCE_BUTTON} ${
                    source === id
                      ? "bg-white/[0.1] font-bold text-white"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {source === "file" ? (
              <div className="flex min-w-0 items-center gap-2 flex-wrap">
                <label
                  htmlFor="baseline-compare-file"
                  className="text-xs font-mono font-semibold text-zinc-300 shrink-0"
                >
                  Study file (JSON, XML or CSV):
                </label>
                <input
                  id="baseline-compare-file"
                  type="file"
                  accept=".json,.xml,.csv"
                  onChange={handleFile}
                  className="min-w-0 max-w-full text-xs font-mono text-zinc-300 file:mr-2 file:rounded-md file:border file:border-zinc-700 file:bg-zinc-900 file:px-2 file:py-1 file:text-xs file:text-zinc-200"
                />
              </div>
            ) : (
              <>
                <label
                  htmlFor="baseline-compare-select"
                  className="text-xs font-mono font-semibold text-zinc-300 shrink-0"
                >
                  Compare current draft against:
                </label>
                {baselines.length === 0 ? (
                  <span className="text-xs text-zinc-500">
                    No saved baselines yet: create one from
                    &quot;Baselines&quot; first.
                  </span>
                ) : (
                  <select
                    id="baseline-compare-select"
                    value={selectedBaselineId || ""}
                    onChange={(e) => handleSelectBaseline(e.target.value)}
                    className="px-2.5 py-1.5 bg-zinc-900 border border-zinc-700/80 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan"
                  >
                    {baselines.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.versionTag}: {b.label}
                      </option>
                    ))}
                  </select>
                )}
              </>
            )}
          </div>

          {/* Export Toolbar */}
          <div
            className="flex items-center gap-2 flex-wrap"
            role="toolbar"
            aria-label="Export controls"
          >
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={!target || !hasChanges}
              aria-label="Export CSV"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed border border-zinc-750 rounded-lg text-xs font-mono font-semibold text-zinc-200 hover:text-white transition-all focus:outline-none focus:ring-1 focus:ring-brand-cyan"
            >
              <IconFileSpreadsheet
                className="w-3.5 h-3.5 text-emerald-400"
                aria-hidden="true"
              />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={handleExportJson}
              disabled={!target || !hasChanges}
              aria-label="Export JSON"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed border border-zinc-750 rounded-lg text-xs font-mono font-semibold text-zinc-200 hover:text-white transition-all focus:outline-none focus:ring-1 focus:ring-brand-cyan"
            >
              <IconFileCode
                className="w-3.5 h-3.5 text-sky-400"
                aria-hidden="true"
              />
              <span>Export JSON</span>
            </button>

            <button
              type="button"
              onClick={handleExportText}
              disabled={!target || !hasChanges}
              aria-label="Export Text"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed border border-zinc-750 rounded-lg text-xs font-mono font-semibold text-zinc-200 hover:text-white transition-all focus:outline-none focus:ring-1 focus:ring-brand-cyan"
            >
              <IconFileText
                className="w-3.5 h-3.5 text-amber-400"
                aria-hidden="true"
              />
              <span>Export Text</span>
            </button>

            <CopyButton
              text={() =>
                comparison ? serializeBaselineDiffToText(comparison) : ""
              }
              disabled={!target || !hasChanges}
              aria-label="Copy Summary"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed border border-zinc-750 rounded-lg text-xs font-mono font-semibold text-zinc-200 hover:text-white transition-all focus:outline-none focus:ring-1 focus:ring-brand-cyan"
              label="Copy Summary"
              copiedLabel="Copied!"
              icon={
                <IconCopy
                  className="w-3.5 h-3.5 text-zinc-300"
                  aria-hidden="true"
                />
              }
              copiedIcon={
                <IconCheck
                  className="w-3.5 h-3.5 text-emerald-400"
                  aria-hidden="true"
                />
              }
            />
          </div>
        </div>

        {/* Category filter tabs + summary */}
        {comparison && (
          <div className="px-4 sm:px-5 py-2.5 border-b border-zinc-850 bg-zinc-950 flex items-center gap-2 flex-wrap overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveCategoryFilter("all")}
              className={`px-2 py-1 rounded-lg text-[11px] font-mono font-semibold transition-colors shrink-0 ${
                activeCategoryFilter === "all"
                  ? "bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/40"
                  : "bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-zinc-200"
              }`}
            >
              All ({comparison.summary.totalChanges})
            </button>
            {CATEGORY_ORDER.map((category) => {
              const counts = comparison.summary.byCategory[category];
              const total = counts.added + counts.removed + counts.modified;
              if (total === 0) return null;
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => setActiveCategoryFilter(category)}
                  className={`px-2 py-1 rounded-lg text-[11px] font-mono font-semibold transition-colors shrink-0 ${
                    activeCategoryFilter === category
                      ? "bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/40"
                      : "bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-zinc-200"
                  }`}
                >
                  {describeBaselineDiffCategory(category)} ({total})
                </button>
              );
            })}
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {fileError && source === "file" && (
            <p role="alert" className="mb-3 text-xs font-mono text-rose-300">
              {fileError}
            </p>
          )}
          {!target ? (
            <div className="py-12 text-center text-zinc-500 text-xs font-mono">
              {source === "file"
                ? "Choose a study file above to compare it with the current draft."
                : "Select a baseline above to see what has changed."}
            </div>
          ) : !comparison?.summary.hasChanges ? (
            <div
              role="status"
              className="py-12 text-center flex flex-col items-center gap-2"
            >
              <IconCircleCheck className="w-8 h-8 text-emerald-400" />
              <h3 className="text-sm font-mono font-bold text-zinc-200">
                No differences detected
              </h3>
              <p className="text-xs text-zinc-500 max-w-sm">
                The current draft matches{" "}
                {source === "file" ? "file" : "baseline"}{" "}
                <strong>
                  {source === "file"
                    ? target.meta.label
                    : target.meta.versionTag}
                </strong>{" "}
                exactly.
              </p>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {visibleEntries.map((entry) => (
                <DiffEntryRow
                  key={`${entry.category}:${entry.changeType}:${entry.id}`}
                  entry={entry}
                  onNavigate={handleNavigate}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
