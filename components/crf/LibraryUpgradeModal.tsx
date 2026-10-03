"use client";

import React, { useMemo, useState } from "react";
import {
  IconAlertTriangle,
  IconArrowBackUp,
  IconBooks,
  IconCheck,
  IconX,
} from "@tabler/icons-react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import type { StudyProtocol } from "@/lib/crf/types";
import { listLibraryEntries } from "@/lib/crf/personal-library";
import {
  applyLibraryUpgrade,
  detectLibraryUpgrades,
  previewLibraryUpgrade,
  type LibraryConflictChoice,
  type LibraryUpgradeChange,
  type LibraryUpgradeStatus,
} from "@/lib/crf/library-upgrade";
import type { RawStorage } from "@/lib/safe-storage";

interface LibraryUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  study: StudyProtocol;
  /** Commits the upgraded study as one undoable step. */
  onApplyUpgrade: (nextStudy: StudyProtocol) => void;
  /** Reverts the most recent step, which is the upgrade just applied. */
  onUndoUpgrade: () => void;
  storage?: RawStorage;
}

const STATUS_TEXT: Record<LibraryUpgradeStatus, string> = {
  available: "Update available",
  up_to_date: "Up to date",
  entry_missing: "Not in library",
  source_unavailable: "Cannot compare",
  target_missing: "Section removed",
};

const KIND_TEXT: Record<LibraryUpgradeChange["kind"], string> = {
  incoming: "Library change, will be applied",
  local: "Your customization, kept",
  converged: "Same change on both sides",
  conflict: "Conflict, choose a version",
};

const KIND_CLASS: Record<LibraryUpgradeChange["kind"], string> = {
  incoming: "border-sky-500/40 text-[var(--lu-info)]",
  local: "border-emerald-500/40 text-[var(--lu-ok)]",
  converged: "border-[var(--crf-border-subtle)] text-[var(--crf-text-muted)]",
  conflict: "border-amber-500/50 text-[var(--lu-warn)]",
};

function ValueCell({ heading, value }: { heading: string; value?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-wider text-[var(--crf-text-dim)]">
        {heading}
      </dt>
      <dd className="mt-0.5 font-mono text-[11px] break-all whitespace-pre-wrap text-[var(--crf-text)] max-h-24 overflow-y-auto">
        {value === undefined ? (
          <span className="italic text-[var(--crf-text-dim)]">absent</span>
        ) : value === "" ? (
          <span className="italic text-[var(--crf-text-dim)]">empty</span>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

function changeTitle(change: LibraryUpgradeChange): string {
  return change.property ? `${change.label}: ${change.property}` : change.label;
}

/**
 * Lets an author compare the library version a block was taken from, the
 * study's copy and the newest library version, resolve every conflict
 * explicitly, and apply the upgrade as one undoable step (#681).
 */
export const LibraryUpgradeModal: React.FC<LibraryUpgradeModalProps> = ({
  isOpen,
  onClose,
  study,
  onApplyUpgrade,
  onUndoUpgrade,
  storage,
}) => {
  const [selectedUseId, setSelectedUseId] = useState<string | null>(null);
  const [resolutions, setResolutions] = useState<
    Record<string, LibraryConflictChoice>
  >({});
  const [outcome, setOutcome] = useState<
    | {
        type: "applied";
        entryName: string;
        from: number;
        to: number;
        appliedStudy: StudyProtocol;
      }
    | { type: "undone"; entryName: string }
    | { type: "error"; message: string }
    | null
  >(null);
  const [libraryReadToken, setLibraryReadToken] = useState(0);

  const containerRef = useFocusTrap<HTMLDivElement>(isOpen, {
    onEscape: onClose,
  });

  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setSelectedUseId(null);
      setResolutions({});
      setOutcome(null);
      setLibraryReadToken((token) => token + 1);
    }
  }

  // The library is read only when the dialog opens; nothing here polls it or
  // pushes a newer version into the study.
  const entries = useMemo(
    () => (isOpen && libraryReadToken >= 0 ? listLibraryEntries(storage) : []),
    [isOpen, libraryReadToken, storage]
  );

  const availability = useMemo(
    () => (isOpen ? detectLibraryUpgrades(study, entries) : []),
    [isOpen, study, entries]
  );

  const previewResult = useMemo(
    () =>
      isOpen && selectedUseId
        ? previewLibraryUpgrade(study, selectedUseId, entries)
        : null,
    [isOpen, selectedUseId, study, entries]
  );
  const preview =
    previewResult && previewResult.status === "ready"
      ? previewResult.preview
      : null;

  if (!isOpen) return null;

  const resolvedCount = preview
    ? preview.conflicts.filter((conflict) => resolutions[conflict.id]).length
    : 0;
  const allResolved = !!preview && resolvedCount === preview.conflicts.length;

  const handleReview = (useId: string) => {
    setSelectedUseId(useId);
    setResolutions({});
    setOutcome(null);
  };

  const handleCancelPreview = () => {
    setSelectedUseId(null);
    setResolutions({});
  };

  const handleResolve = (changeId: string, choice: LibraryConflictChoice) => {
    setResolutions((previous) => ({ ...previous, [changeId]: choice }));
  };

  const handleApply = () => {
    if (!preview) return;
    const result = applyLibraryUpgrade(study, preview, entries, resolutions);
    if (result.status === "applied") {
      onApplyUpgrade(result.study);
      setOutcome({
        type: "applied",
        entryName: preview.entryName,
        from: preview.fromVersion,
        to: preview.toVersion,
        appliedStudy: result.study,
      });
      setSelectedUseId(null);
      setResolutions({});
      return;
    }
    setOutcome({
      type: "error",
      message:
        result.status === "unresolved"
          ? `${result.unresolvedChangeIds.length} conflict(s) still need a decision.`
          : result.message,
    });
  };

  const handleUndo = () => {
    // Only undo while the upgrade is still the latest step; otherwise the
    // shared undo would revert something else.
    if (outcome?.type !== "applied" || outcome.appliedStudy !== study) return;
    onUndoUpgrade();
    setOutcome({ type: "undone", entryName: outcome.entryName });
  };

  const conflicts = preview?.conflicts ?? [];
  const otherChanges =
    preview?.changes.filter((c) => c.kind !== "conflict") ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80"
      onClick={onClose}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="library-upgrade-title"
        aria-describedby="library-upgrade-description"
        data-library-upgrade=""
        onClick={(event) => event.stopPropagation()}
        className="@container w-full max-w-3xl min-w-0 bg-[var(--crf-bg,#0d0e11)] text-[var(--crf-text,#f4f4f6)] border border-[var(--crf-border,#27272a)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
      >
        <div className="p-4 sm:p-5 border-b border-[var(--crf-border,#27272a)] bg-[var(--crf-surface-1,#13151a)] flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <span className="p-1.5 rounded-lg bg-amber-500/10 text-[var(--lu-warn)] shrink-0">
              <IconBooks className="w-5 h-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2
                id="library-upgrade-title"
                className="text-sm font-mono font-bold uppercase tracking-wider"
              >
                Library Block Upgrades
              </h2>
              <p
                id="library-upgrade-description"
                className="text-xs text-[var(--crf-text-muted,#a1a1aa)] mt-0.5 break-words"
              >
                Compare the library version this study used, your copy and the
                newest library version. Nothing changes until you apply.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close library upgrades"
            className="p-1 rounded-lg text-[var(--crf-text-muted,#a1a1aa)] hover:text-[var(--crf-text,#f4f4f6)] hover:bg-[var(--crf-surface-2,#27272a)] shrink-0"
          >
            <IconX className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div role="status" aria-live="polite" className="empty:hidden">
          {outcome && (
            <div
              data-testid="library-upgrade-outcome"
              className={`px-4 py-2 text-xs font-mono flex flex-wrap items-center gap-2 border-b ${
                outcome.type === "error"
                  ? "border-rose-800/50 text-[var(--lu-error)]"
                  : "border-emerald-800/50 text-[var(--lu-ok)]"
              }`}
            >
              {outcome.type === "error" ? (
                <IconAlertTriangle
                  className="w-4 h-4 shrink-0"
                  aria-hidden="true"
                />
              ) : (
                <IconCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
              )}
              <span className="min-w-0 break-words flex-1">
                {outcome.type === "applied" &&
                  `Upgraded "${outcome.entryName}" from version ${outcome.from} to ${outcome.to} as one step.`}
                {outcome.type === "undone" &&
                  `Upgrade of "${outcome.entryName}" undone. The study is back to its previous state.`}
                {outcome.type === "error" && outcome.message}
              </span>
              {outcome.type === "applied" && outcome.appliedStudy === study && (
                <button
                  type="button"
                  onClick={handleUndo}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-emerald-700/60 hover:bg-emerald-900/30 active:scale-[0.98]"
                >
                  <IconArrowBackUp className="w-3.5 h-3.5" aria-hidden="true" />
                  Undo upgrade
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 min-w-0">
          {!selectedUseId && (
            <section aria-labelledby="library-uses-heading">
              <h3
                id="library-uses-heading"
                className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--crf-text-muted,#a1a1aa)] mb-2"
              >
                Library blocks in this study
              </h3>
              {availability.length === 0 ? (
                <p className="text-xs text-[var(--crf-text-muted,#a1a1aa)]">
                  This study has no blocks inserted from your personal library
                  with recorded lineage, so there is nothing to upgrade.
                </p>
              ) : (
                <ul className="space-y-2">
                  {availability.map((item) => (
                    <li
                      key={item.use.id}
                      className="flex flex-wrap items-center gap-2 p-3 rounded-xl border border-[var(--crf-border,#27272a)] bg-[var(--crf-surface-1,#13151a)]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold break-words">
                          {item.use.entryName}
                        </div>
                        <div className="text-[11px] text-[var(--crf-text-muted,#a1a1aa)] break-words">
                          {item.message}
                        </div>
                      </div>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                          item.status === "available"
                            ? "border-amber-500/50 text-[var(--lu-warn)]"
                            : "border-[var(--crf-border-subtle,#3f3f46)] text-[var(--crf-text-muted,#a1a1aa)]"
                        }`}
                      >
                        {STATUS_TEXT[item.status]}
                      </span>
                      {item.status === "available" && (
                        <button
                          type="button"
                          onClick={() => handleReview(item.use.id)}
                          aria-label={`Review upgrade of ${item.use.entryName} to version ${item.latestVersion}`}
                          className="px-3 py-1.5 text-xs font-mono font-bold rounded-lg bg-amber-500 text-zinc-950 hover:bg-amber-400 active:scale-[0.98]"
                        >
                          Review upgrade
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {selectedUseId && previewResult && !preview && (
            <p role="alert" className="text-xs text-[var(--lu-error)]">
              {"message" in previewResult
                ? previewResult.message
                : "This library block is no longer recorded in the study."}
            </p>
          )}

          {preview && (
            <>
              <section
                aria-labelledby="upgrade-summary-heading"
                className="space-y-1"
              >
                <h3
                  id="upgrade-summary-heading"
                  className="text-sm font-semibold break-words"
                >
                  {preview.entryName}: version {preview.fromVersion} to{" "}
                  {preview.toVersion}
                </h3>
                <p
                  data-testid="library-upgrade-counts"
                  className="text-xs font-mono text-[var(--crf-text-muted,#a1a1aa)]"
                >
                  {preview.counts.incoming} library change(s),{" "}
                  {preview.counts.local} customization(s) kept,{" "}
                  {preview.counts.converged} matching, {preview.counts.conflict}{" "}
                  conflict(s)
                </p>
              </section>

              {conflicts.length > 0 && (
                <section
                  aria-labelledby="upgrade-conflicts-heading"
                  className="space-y-2"
                >
                  <h3
                    id="upgrade-conflicts-heading"
                    className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--lu-warn)]"
                  >
                    Conflicts ({resolvedCount} of {conflicts.length} resolved)
                  </h3>
                  {conflicts.map((change) => (
                    <fieldset
                      key={change.id}
                      className="p-3 rounded-xl border border-amber-500/40 bg-[var(--crf-surface-1,#13151a)] min-w-0"
                    >
                      <legend className="px-1 text-xs font-semibold break-words">
                        {changeTitle(change)}
                      </legend>
                      <p className="text-[11px] text-[var(--crf-text-muted,#a1a1aa)] mb-2 break-words">
                        {change.summary}
                      </p>
                      <dl className="grid grid-cols-1 @md:grid-cols-3 gap-2 mb-2">
                        <ValueCell
                          heading={`Library v${preview.fromVersion} (used)`}
                          value={change.source}
                        />
                        <ValueCell
                          heading="This study"
                          value={change.current}
                        />
                        <ValueCell
                          heading={`Library v${preview.toVersion}`}
                          value={change.incoming}
                        />
                      </dl>
                      <div className="flex flex-wrap gap-3 text-xs">
                        <label className="inline-flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name={`resolve-${change.id}`}
                            checked={resolutions[change.id] === "current"}
                            onChange={() => handleResolve(change.id, "current")}
                          />
                          Keep my version
                        </label>
                        <label className="inline-flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name={`resolve-${change.id}`}
                            checked={resolutions[change.id] === "incoming"}
                            onChange={() =>
                              handleResolve(change.id, "incoming")
                            }
                          />
                          Take library version {preview.toVersion}
                        </label>
                      </div>
                    </fieldset>
                  ))}
                </section>
              )}

              <section
                aria-labelledby="upgrade-changes-heading"
                className="space-y-2"
              >
                <h3
                  id="upgrade-changes-heading"
                  className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--crf-text-muted,#a1a1aa)]"
                >
                  Other differences
                </h3>
                {otherChanges.length === 0 ? (
                  <p className="text-xs text-[var(--crf-text-muted,#a1a1aa)]">
                    None.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {otherChanges.map((change) => (
                      <li
                        key={change.id}
                        data-testid={`upgrade-change-${change.id}`}
                        className="p-3 rounded-xl border border-[var(--crf-border,#27272a)] bg-[var(--crf-surface-1,#13151a)] min-w-0"
                      >
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="text-xs font-semibold break-words min-w-0 flex-1">
                            {changeTitle(change)}
                          </span>
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${KIND_CLASS[change.kind]}`}
                          >
                            {KIND_TEXT[change.kind]}
                          </span>
                        </div>
                        <p className="text-[11px] text-[var(--crf-text-muted,#a1a1aa)] break-words">
                          {change.summary}
                        </p>
                        {change.property && (
                          <dl className="grid grid-cols-1 @md:grid-cols-3 gap-2 mt-2">
                            <ValueCell
                              heading={`Library v${preview.fromVersion} (used)`}
                              value={change.source}
                            />
                            <ValueCell
                              heading="This study"
                              value={change.current}
                            />
                            <ValueCell
                              heading={`Library v${preview.toVersion}`}
                              value={change.incoming}
                            />
                          </dl>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section
                aria-labelledby="upgrade-references-heading"
                className="space-y-2"
              >
                <h3
                  id="upgrade-references-heading"
                  className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--crf-text-muted,#a1a1aa)]"
                >
                  Affected references outside this block
                </h3>
                {preview.affectedReferences.length === 0 ? (
                  <p className="text-xs text-[var(--crf-text-muted,#a1a1aa)]">
                    No rules, calculations or codelist uses elsewhere in the
                    study are reached by this upgrade.
                  </p>
                ) : (
                  <ul className="space-y-1 text-xs">
                    {preview.affectedReferences.map((reference) => (
                      <li
                        key={`${reference.changeId}|${reference.elementId}`}
                        className="break-words"
                      >
                        <span className="font-mono text-[var(--crf-text-muted,#a1a1aa)]">
                          {reference.formName}:
                        </span>{" "}
                        {reference.detail}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>

        {preview && (
          <div className="p-4 border-t border-[var(--crf-border,#27272a)] bg-[var(--crf-surface-1,#13151a)] flex flex-wrap items-center justify-end gap-2">
            {!allResolved && (
              <p className="text-[11px] text-[var(--lu-warn)] mr-auto min-w-0 break-words">
                Choose a version for every conflict to apply.
              </p>
            )}
            <button
              type="button"
              onClick={handleCancelPreview}
              className="px-3 py-1.5 text-xs font-mono rounded-lg border border-[var(--crf-border-subtle,#3f3f46)] hover:bg-[var(--crf-surface-2,#27272a)] active:scale-[0.98]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={!allResolved}
              className="px-3 py-1.5 text-xs font-mono font-bold rounded-lg bg-amber-500 text-zinc-950 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
            >
              Apply upgrade
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
