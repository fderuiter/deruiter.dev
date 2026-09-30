"use client";

import React, { useState, useMemo } from "react";
import {
  IconBookmark,
  IconPlus,
  IconHistory,
  IconX,
  IconCheck,
  IconAlertTriangle,
  IconDownload,
  IconTrash,
  IconShieldLock,
  IconArrowBackUp,
  IconUpload,
} from "@tabler/icons-react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StudyProtocol, StudyBaseline } from "@/lib/crf/types";
import {
  saveStudyBaseline,
  listStudyBaselines,
  restoreBaselineAsDraft,
  deleteStudyBaseline,
  exportBaselinesBundle,
  importBaselinesBundle,
} from "@/lib/crf/study-baselines";

interface BaselineManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  study: StudyProtocol;
  onRestoreBaselineAsDraft: (
    restoredStudy: StudyProtocol,
    baseline: StudyBaseline
  ) => void;
  storage?: Storage;
}

export const BaselineManagerModal: React.FC<BaselineManagerModalProps> = ({
  isOpen,
  onClose,
  study,
  onRestoreBaselineAsDraft,
  storage,
}) => {
  const [activeTab, setActiveTab] = useState<"list" | "create">("list");
  const [baselines, setBaselines] = useState<StudyBaseline[]>(() =>
    listStudyBaselines(storage)
  );
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Form State for creating a new baseline
  const [versionTag, setVersionTag] = useState(
    () => `v${study.version || "1.0"}`
  );
  const [label, setLabel] = useState(
    () => `Baseline Snapshot: ${study.protocolNumber || "Study"}`
  );
  const [description, setDescription] = useState("");
  const [actorName, setActorName] = useState("Clinical Data Manager");
  const [actorRole, setActorRole] = useState("Lead Data Manager");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Restoration Confirmation State
  const [baselinePendingRestore, setBaselinePendingRestore] =
    useState<StudyBaseline | null>(null);
  const [incrementOnRestore, setIncrementOnRestore] = useState(true);

  // Focus trap for accessibility
  const containerRef = useFocusTrap<HTMLDivElement>(isOpen, {
    onEscape: onClose,
  });

  // Refresh baselines list from storage
  const reloadBaselines = () => {
    const list = listStudyBaselines(storage);
    setBaselines(list);
  };

  // Adjust state during render without cascading useEffect
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen && !prevIsOpen) {
    setPrevIsOpen(isOpen);
    setFeedback(null);
    setBaselinePendingRestore(null);
    setActiveTab("list");
    const currentVer = study.version || "1.0";
    setVersionTag(`v${currentVer}`);
    setLabel(`Baseline Snapshot: ${study.protocolNumber || "Study"}`);
    setBaselines(listStudyBaselines(storage));
  } else if (!isOpen && prevIsOpen) {
    setPrevIsOpen(isOpen);
  }

  // Derived counts for current study
  const studyStats = useMemo(() => {
    const formsCount = study.forms.length;
    const visitsCount = study.visits.length;
    const fieldsCount = study.forms.reduce(
      (acc, f) =>
        acc +
        f.sections.reduce((sAcc, sec) => sAcc + (sec.fields?.length || 0), 0),
      0
    );
    const rulesCount =
      (study.rules?.length || 0) +
      study.forms.reduce((acc, f) => acc + (f.rules?.length || 0), 0);
    return { formsCount, visitsCount, fieldsCount, rulesCount };
  }, [study]);

  const handleCreateBaseline = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFeedback(null);

    const result = saveStudyBaseline(
      study,
      {
        versionTag: versionTag.trim(),
        label: label.trim(),
        description: description.trim() || undefined,
        actor: {
          name: actorName.trim(),
          role: actorRole.trim(),
        },
      },
      storage
    );

    setIsSubmitting(false);

    if (result.status === "saved") {
      setFeedback({
        type: "success",
        message: `Immutable baseline '${result.baseline.versionTag}' created successfully.`,
      });
      reloadBaselines();
      setActiveTab("list");
    } else {
      setFeedback({
        type: "error",
        message:
          result.status === "unavailable"
            ? "Local storage is unavailable in this environment."
            : result.message,
      });
    }
  };

  const handleConfirmRestore = () => {
    if (!baselinePendingRestore) return;

    const result = restoreBaselineAsDraft(
      baselinePendingRestore,
      {
        actorName,
        incrementVersion: incrementOnRestore,
      },
      storage
    );

    if (result.status === "restored") {
      onRestoreBaselineAsDraft(result.study, result.baseline);
      setBaselinePendingRestore(null);
      onClose();
    } else {
      setFeedback({
        type: "error",
        message: result.message,
      });
    }
  };

  const handleDeleteBaseline = (id: string, tag: string) => {
    if (
      window.confirm(
        `Are you sure you want to delete immutable baseline '${tag}'? This cannot be undone.`
      )
    ) {
      deleteStudyBaseline(id, storage);
      reloadBaselines();
      setFeedback({
        type: "success",
        message: `Baseline '${tag}' removed from local storage.`,
      });
    }
  };

  const handleDownloadSingle = (baseline: StudyBaseline) => {
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(baseline.study, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute(
      "download",
      `${study.protocolNumber || "study"}_${baseline.versionTag}.crf.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleExportAll = () => {
    const bundleStr = exportBaselinesBundle(storage);
    const dataStr =
      "data:text/json;charset=utf-8," + encodeURIComponent(bundleStr);
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute(
      "download",
      `${study.protocolNumber || "study"}_baselines_bundle.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportBundle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const { imported, skipped } = importBaselinesBundle(content, storage);
        reloadBaselines();
        setFeedback({
          type: "success",
          message: `Import complete: ${imported} baseline(s) imported, ${skipped} duplicate(s) skipped.`,
        });
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="baseline-modal-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-zinc-950 border border-zinc-750 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] border-brand-cyan/30 text-zinc-100"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-800 bg-zinc-900/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 rounded-lg bg-brand-cyan/10 text-brand-cyan">
              <IconShieldLock className="w-5 h-5" />
            </span>
            <div>
              <h2
                id="baseline-modal-title"
                className="text-sm font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2"
              >
                Study Baselines &amp; Version History
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Save immutable snapshots and restore into new drafts without
                rewriting history.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close Baselines Dialog"
            className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <IconX className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <Tabs
          value={activeTab}
          onValueChange={(val) => {
            setActiveTab(val as "list" | "create");
            setFeedback(null);
          }}
          className="flex flex-col flex-1 min-h-0 overflow-hidden"
        >
          <TabsList
            aria-label="Baseline manager tabs"
            className="flex items-center gap-1 px-4 pt-3 border-b border-zinc-850 bg-zinc-950"
          >
            <TabsTrigger
              value="list"
              className={`flex items-center gap-2 px-3 py-2 text-xs font-mono font-semibold rounded-t-lg transition-all border-b-2 cursor-pointer ${
                activeTab === "list"
                  ? "border-brand-cyan text-brand-cyan bg-zinc-900/50"
                  : "border-transparent text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <IconHistory className="w-3.5 h-3.5" />
              <span>Saved Baselines</span>
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-zinc-800 text-zinc-300">
                {baselines.length}
              </span>
            </TabsTrigger>

            <TabsTrigger
              value="create"
              className={`flex items-center gap-2 px-3 py-2 text-xs font-mono font-semibold rounded-t-lg transition-all border-b-2 cursor-pointer ${
                activeTab === "create"
                  ? "border-brand-cyan text-brand-cyan bg-zinc-900/50"
                  : "border-transparent text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <IconPlus className="w-3.5 h-3.5" />
              <span>Save New Baseline</span>
            </TabsTrigger>
          </TabsList>

          {/* Feedback Alert */}
          {feedback && (
            <div
              role="status"
              className={`px-4 py-2 text-xs font-mono flex items-center gap-2 border-b ${
                feedback.type === "success"
                  ? "bg-emerald-950/60 text-emerald-300 border-emerald-800/50"
                  : "bg-rose-950/60 text-rose-300 border-rose-800/50"
              }`}
            >
              {feedback.type === "success" ? (
                <IconCheck className="w-4 h-4 shrink-0 text-emerald-400" />
              ) : (
                <IconAlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          {/* Content Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5">
            <TabsContent value="list">
              <div className="space-y-4">
                {/* Summary toolbar */}
                <div className="flex items-center justify-between text-xs font-mono text-zinc-400 pb-2 border-b border-zinc-850">
                  <span>
                    {baselines.length === 0
                      ? "No saved baselines in local storage."
                      : `${baselines.length} baseline snapshot(s) archived.`}
                  </span>
                  <div className="flex items-center gap-2">
                    {baselines.length > 0 && (
                      <button
                        type="button"
                        onClick={handleExportAll}
                        className="flex items-center gap-1 px-2 py-1 bg-zinc-850 hover:bg-zinc-800 text-zinc-200 rounded text-[11px] transition-colors"
                        title="Export all baselines as JSON bundle"
                      >
                        <IconDownload className="w-3 h-3 text-brand-cyan" />
                        <span>Export All</span>
                      </button>
                    )}
                    <label className="flex items-center gap-1 px-2 py-1 bg-zinc-850 hover:bg-zinc-800 text-zinc-200 rounded text-[11px] cursor-pointer transition-colors">
                      <IconUpload className="w-3 h-3 text-brand-cyan" />
                      <span>Import</span>
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleImportBundle}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {/* Baseline List */}
                {baselines.length === 0 ? (
                  <div className="py-12 text-center">
                    <div className="inline-flex p-3 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-500 mb-3">
                      <IconBookmark className="w-8 h-8" />
                    </div>
                    <h3 className="text-sm font-mono font-bold text-zinc-300">
                      No Baselines Recorded
                    </h3>
                    <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
                      Create an immutable baseline snapshot to lock protocol
                      amendments, interim reviews, or regulatory submission
                      milestones.
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveTab("create")}
                      className="mt-4 px-3.5 py-1.5 rounded-xl bg-brand-cyan text-black font-mono text-xs font-bold hover:bg-brand-cyan/90 transition-all shadow-sm"
                    >
                      + Save Current Study as Baseline
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {baselines.map((base) => (
                      <div
                        key={base.id}
                        className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800 hover:border-zinc-700 transition-all space-y-2.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/30">
                                {base.versionTag}
                              </span>
                              <span className="text-xs font-bold text-white">
                                {base.label}
                              </span>
                            </div>
                            {base.description && (
                              <p className="text-xs text-zinc-400 mt-1 font-sans line-clamp-2">
                                {base.description}
                              </p>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => setBaselinePendingRestore(base)}
                              className="px-2.5 py-1 bg-brand-cyan/15 hover:bg-brand-cyan/25 text-brand-cyan border border-brand-cyan/30 rounded-lg text-xs font-mono font-semibold transition-all flex items-center gap-1"
                              title="Restore baseline into a new draft"
                            >
                              <IconArrowBackUp className="w-3.5 h-3.5" />
                              <span>Restore Draft</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDownloadSingle(base)}
                              className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
                              title="Download study JSON"
                              aria-label={`Download ${base.versionTag} JSON`}
                            >
                              <IconDownload className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                handleDeleteBaseline(base.id, base.versionTag)
                              }
                              className="p-1 text-zinc-400 hover:text-rose-400 rounded-lg hover:bg-zinc-800 transition-colors"
                              title="Delete baseline"
                              aria-label={`Delete ${base.versionTag}`}
                            >
                              <IconTrash className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Metadata row */}
                        <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500 pt-2 border-t border-zinc-850/80 flex-wrap gap-2">
                          <div className="flex items-center gap-3">
                            <span>
                              Created:{" "}
                              {new Date(base.createdAt).toLocaleString(
                                undefined,
                                {
                                  dateStyle: "short",
                                  timeStyle: "short",
                                }
                              )}
                            </span>
                            <span>•</span>
                            <span>
                              Actor:{" "}
                              <span className="text-zinc-300">
                                {base.actor.name}
                              </span>
                              {base.actor.role ? ` (${base.actor.role})` : ""}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 rounded bg-zinc-850 text-zinc-400">
                              {base.provenance?.totalForms ??
                                base.study.forms.length}{" "}
                              forms
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-zinc-850 text-zinc-400">
                              {base.provenance?.totalVisits ??
                                base.study.visits.length}{" "}
                              visits
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-zinc-850 text-zinc-400">
                              {base.provenance?.totalFields ?? "—"} fields
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="create">
              {/* Create New Baseline Form */}
              <form onSubmit={handleCreateBaseline} className="space-y-4">
                {/* Snapshot Scope Summary */}
                <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-mono font-bold text-white">
                    <span>Current Study Snapshot Scope</span>
                    <span className="text-brand-cyan">
                      {study.protocolNumber || "UNASSIGNED"}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-400">
                    {study.studyName || "Untitled Study Protocol"}
                  </div>
                  <div className="flex items-center gap-2 pt-1 flex-wrap text-[11px] font-mono text-zinc-400">
                    <span className="px-1.5 py-0.5 rounded bg-zinc-850">
                      {studyStats.formsCount} Forms
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-zinc-850">
                      {studyStats.visitsCount} Visits
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-zinc-850">
                      {studyStats.fieldsCount} Fields
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-zinc-850">
                      {studyStats.rulesCount} Rules
                    </span>
                  </div>
                </div>

                {/* Version Tag & Label */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label
                      htmlFor="baseline-version-tag"
                      className="block text-xs font-mono font-semibold text-zinc-300 mb-1"
                    >
                      Version Tag *
                    </label>
                    <input
                      id="baseline-version-tag"
                      type="text"
                      required
                      value={versionTag}
                      onChange={(e) => setVersionTag(e.target.value)}
                      placeholder="e.g. v1.0.0"
                      className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700/80 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label
                      htmlFor="baseline-label"
                      className="block text-xs font-mono font-semibold text-zinc-300 mb-1"
                    >
                      Baseline Label / Title *
                    </label>
                    <input
                      id="baseline-label"
                      type="text"
                      required
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                      placeholder="e.g. Protocol Amendment 1 Interim Lock"
                      className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700/80 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan"
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label
                    htmlFor="baseline-description"
                    className="block text-xs font-mono font-semibold text-zinc-300 mb-1"
                  >
                    Clinical Context &amp; Amendment Notes
                  </label>
                  <textarea
                    id="baseline-description"
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Formal protocol amendment freeze prior to Cohort 2 expansion."
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700/80 rounded-xl text-xs font-sans text-white focus:outline-none focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan"
                  />
                </div>

                {/* Actor Information */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="baseline-actor-name"
                      className="block text-xs font-mono font-semibold text-zinc-300 mb-1"
                    >
                      Author / Actor Name *
                    </label>
                    <input
                      id="baseline-actor-name"
                      type="text"
                      required
                      value={actorName}
                      onChange={(e) => setActorName(e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700/80 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="baseline-actor-role"
                      className="block text-xs font-mono font-semibold text-zinc-300 mb-1"
                    >
                      Role / Title
                    </label>
                    <input
                      id="baseline-actor-role"
                      type="text"
                      value={actorRole}
                      onChange={(e) => setActorRole(e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700/80 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan"
                    />
                  </div>
                </div>

                <div className="pt-3 flex items-center justify-end gap-2 border-t border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setActiveTab("list")}
                    className="px-3.5 py-1.5 rounded-xl bg-zinc-850 hover:bg-zinc-800 text-zinc-300 font-mono text-xs transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-1.5 rounded-xl bg-brand-cyan text-black font-mono text-xs font-bold hover:bg-brand-cyan/90 transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <IconShieldLock className="w-4 h-4" />
                    <span>
                      {isSubmitting
                        ? "Locking Baseline..."
                        : "Create Immutable Baseline"}
                    </span>
                  </button>
                </div>
              </form>
            </TabsContent>
          </div>
        </Tabs>

        {/* Confirmation Modal for Restoring Baseline into Draft */}
        {baselinePendingRestore && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="restore-confirm-title"
            className="p-4 sm:p-5 border-t border-brand-cyan/40 bg-zinc-900 space-y-3 animate-in slide-in-from-bottom-2 duration-150"
          >
            <div className="flex items-start gap-3">
              <span className="p-2 rounded-xl bg-brand-cyan/10 text-brand-cyan shrink-0 mt-0.5">
                <IconArrowBackUp className="w-5 h-5" />
              </span>
              <div className="space-y-1">
                <h4
                  id="restore-confirm-title"
                  className="text-xs font-mono font-bold text-white uppercase tracking-wider"
                >
                  Restore Baseline &apos;{baselinePendingRestore.versionTag}
                  &apos; as New Draft?
                </h4>
                <p className="text-xs text-zinc-300">
                  This creates a brand new working draft derived from baseline{" "}
                  <strong>&quot;{baselinePendingRestore.label}&quot;</strong>{" "}
                  with fresh provenance metadata. The original baseline remains
                  100% immutable and untouched in history.
                </p>
                <label className="flex items-center gap-2 pt-1.5 cursor-pointer text-xs font-mono text-zinc-300">
                  <input
                    type="checkbox"
                    checked={incrementOnRestore}
                    onChange={(e) => setIncrementOnRestore(e.target.checked)}
                    className="rounded border-zinc-700 bg-zinc-800 text-brand-cyan focus:ring-brand-cyan"
                  />
                  <span>
                    Increment version to next draft iteration (e.g.{" "}
                    {incrementOnRestore
                      ? baselinePendingRestore.versionTag + " -> new draft"
                      : "keep version"}
                    )
                  </span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setBaselinePendingRestore(null)}
                className="px-3.5 py-1.5 rounded-xl bg-zinc-850 hover:bg-zinc-800 text-zinc-300 font-mono text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRestore}
                className="px-4 py-1.5 rounded-xl bg-brand-cyan text-black font-mono text-xs font-bold hover:bg-brand-cyan/90 transition-all shadow-sm"
              >
                Confirm &amp; Begin New Draft
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
