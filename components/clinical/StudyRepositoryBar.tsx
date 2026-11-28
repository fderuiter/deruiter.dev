"use client";

import {
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { IntentLink } from "@/components/ui/IntentLink";
import { ModalContainer } from "@/components/ui/ModalContainer";
import { CLINICAL_STANDARDS_PROFILE } from "@/lib/clinical-standards";
import { PIPELINE_SIMULATOR_PATH } from "@/lib/clinical-tools/pipeline-simulator";
import { downloadFile } from "@/lib/download";
import { DEMO_STUDY_ID } from "@/lib/clinical-study-context";
import {
  serializeStudyWorkspace,
  type StudyRepositoryRecord,
  type StudyRepositorySummary,
  type StudyVersionChoice,
  type StudyWorkspace,
  type StudyWorkspaceSelection,
} from "@/lib/study-workspace";
import {
  type PendingStudySelectionImport,
  type StudyRepositoryClient,
} from "./study-repository-client";
import { useStudyRepository } from "./useStudyRepository";

const BTN_BASE =
  "inline-flex items-center justify-center rounded border border-[var(--studio-border-default,rgba(255,255,255,0.12))] bg-[var(--studio-surface-card,#0d0e11)] px-3 text-xs font-medium text-[var(--studio-fg-primary,#f4f4f6)] transition-colors hover:border-[var(--studio-border-hover,#94a3b8)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-ring,#fbbf24)] disabled:cursor-not-allowed disabled:opacity-50";
const BTN_AMBER =
  "inline-flex items-center justify-center rounded border border-[var(--studio-accent-amber-border,rgba(251,191,36,0.6))] bg-[var(--studio-accent-amber-bg,rgba(251,191,36,0.15))] px-3 text-xs font-medium text-[var(--studio-accent-amber-fg,#fde68a)] transition-colors hover:bg-[var(--studio-accent-amber-bg-strong,rgba(251,191,36,0.25))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-ring,#fbbf24)] disabled:cursor-not-allowed disabled:opacity-50";
const SELECT_BASE =
  "min-w-0 rounded border border-[var(--studio-border-default,rgba(255,255,255,0.12))] bg-[var(--studio-surface-input,#0d0e11)] px-2.5 text-xs font-mono text-[var(--studio-fg-primary,#f4f4f6)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-ring,#fbbf24)]";

function formatBytesMiB(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

function kindBadgeLabel(kind: StudyRepositorySummary["kind"]): string {
  switch (kind) {
    case "reference":
      return "Reference";
    case "imported":
      return "Imported";
    case "authored":
      return "Authored";
    case "migrated":
      return "Migrated";
  }
}

export interface StudyConflictPromptState {
  readonly studyId: string;
  readonly expectedRevisionId: string;
  readonly currentRevisionId: string | null;
  readonly latestRecord: StudyRepositoryRecord | null;
  readonly localWorkspace?: StudyWorkspace;
}

const STUDIO_LINKS: readonly {
  readonly href: string;
  readonly label: string;
}[] = [
  { href: "/study-studio", label: "Study Studio" },
  { href: "/crf", label: "CRF Studio" },
  { href: PIPELINE_SIMULATOR_PATH, label: "Pipeline Simulator" },
  { href: "/study-data", label: "Study Data" },
  { href: "/clinical/ai-governance", label: "AI Governance" },
];

interface StudyConflictModalProps {
  readonly conflict: StudyConflictPromptState | null;
  readonly onLoadLatest: (latest: StudyRepositoryRecord | null) => void;
  readonly onForceKeepLocal: () => void;
  readonly onSaveAsBranch?: () => void;
  readonly onClose: () => void;
}

/**
 * Accessible modal shown when a concurrent edit in another tab advanced the
 * study revision (`StudyWorkspaceConflictError`), preventing silent overwrites.
 */
export function StudyConflictModal({
  conflict,
  onLoadLatest,
  onForceKeepLocal,
  onSaveAsBranch,
  onClose,
}: StudyConflictModalProps) {
  const titleId = useId();
  const descId = useId();

  const downloadLocal = () => {
    if (!conflict?.localWorkspace) return;
    downloadFile(
      serializeStudyWorkspace(conflict.localWorkspace),
      `${conflict.studyId}-local.study.json`,
      { mimeType: "application/json" }
    );
  };

  return (
    <ModalContainer
      isOpen={conflict !== null}
      onClose={onClose}
      titleId={titleId}
      ariaDescribedBy={descId}
      maxWidth="max-w-lg"
      className="border-[var(--studio-accent-amber-border,rgba(245,158,11,0.4))] bg-[var(--studio-surface-elevated,#13151a)] p-5 text-[var(--studio-fg-primary,#f4f4f6)]"
    >
      {conflict ? (
        <div className="min-w-0 space-y-4">
          <div className="space-y-1">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--studio-accent-amber-fg,#fcd34d)]">
              Concurrent revision conflict
            </p>
            <h3
              id={titleId}
              className="text-base font-semibold text-[var(--studio-fg-primary,#f4f4f6)]"
            >
              {conflict.currentRevisionId === null
                ? "Study removed from the shared repository"
                : "Newer study revision saved in another tab"}
            </h3>
          </div>
          <p
            id={descId}
            className="text-sm leading-relaxed text-[var(--studio-fg-secondary,#cbd5e1)]"
          >
            This tab edited revision{" "}
            <span className="font-mono text-[var(--studio-fg-primary,#f4f4f6)]">
              {conflict.expectedRevisionId}
            </span>
            {conflict.currentRevisionId === null ? (
              ". The repository no longer has this study. Recreate it with this tab’s edits or dismiss this prompt."
            ) : (
              <>
                , while the shared browser repository is already at{" "}
                <span className="font-mono text-[var(--studio-accent-amber-fg,#fcd34d)]">
                  {conflict.currentRevisionId}
                </span>
                . Save this tab&apos;s edits as a separate branch, load the
                newer revision, or overwrite it with this tab&apos;s edits.
              </>
            )}
          </p>
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            {conflict.localWorkspace ? (
              <button
                type="button"
                onClick={downloadLocal}
                className={`${BTN_BASE} min-h-11`}
              >
                Download local (.study.json)
              </button>
            ) : null}
            {conflict.localWorkspace && onSaveAsBranch ? (
              <button
                type="button"
                data-testid="study-conflict-branch-btn"
                onClick={onSaveAsBranch}
                className={`${BTN_AMBER} min-h-11`}
              >
                Save as branch
              </button>
            ) : null}
            <button
              type="button"
              onClick={onForceKeepLocal}
              className={`${BTN_BASE} min-h-11`}
            >
              {conflict.currentRevisionId === null
                ? "Recreate with this tab"
                : "Overwrite with this tab"}
            </button>
            <button
              type="button"
              onClick={() => onLoadLatest(conflict.latestRecord)}
              className={`${BTN_AMBER} min-h-11`}
            >
              {conflict.currentRevisionId === null
                ? "Dismiss"
                : `Load ${conflict.currentRevisionId}`}
            </button>
          </div>
        </div>
      ) : null}
    </ModalContainer>
  );
}

interface VersionDesignSelectionModalProps {
  readonly pending: PendingStudySelectionImport | null;
  readonly onConfirm: (selection: StudyWorkspaceSelection) => void;
  readonly onCancel: () => void;
}

function VersionDesignSelectionModal({
  pending,
  onConfirm,
  onCancel,
}: VersionDesignSelectionModalProps) {
  const titleId = useId();
  const descId = useId();
  const versionFieldId = useId();
  const designFieldId = useId();

  const choices: readonly StudyVersionChoice[] = pending?.choices ?? [];
  const [selectedVersionId, setSelectedVersionId] = useState<string>("");
  const [selectedDesignId, setSelectedDesignId] = useState<string>("");

  const activeChoice =
    choices.find((choice) => choice.studyVersionId === selectedVersionId) ??
    choices[0];
  const effectiveVersionId = activeChoice?.studyVersionId ?? "";
  const designs = activeChoice?.designs ?? [];
  const effectiveDesignId = designs.some((d) => d.id === selectedDesignId)
    ? selectedDesignId
    : (designs[0]?.id ?? "");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!effectiveVersionId || !effectiveDesignId) return;
    onConfirm({
      studyVersionId: effectiveVersionId,
      studyDesignId: effectiveDesignId,
    });
  };

  return (
    <ModalContainer
      isOpen={pending !== null}
      onClose={onCancel}
      titleId={titleId}
      ariaDescribedBy={descId}
      maxWidth="max-w-lg"
      className="border-[var(--studio-border-default,rgba(255,255,255,0.12))] bg-[var(--studio-surface-elevated,#13151a)] p-5 text-[var(--studio-fg-primary,#f4f4f6)]"
    >
      {pending ? (
        <form onSubmit={submit} className="min-w-0 space-y-4">
          <div className="space-y-1">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--studio-accent-sky-fg,#7dd3fc)]">
              USDM v4 selection
            </p>
            <h3
              id={titleId}
              className="text-base font-semibold text-[var(--studio-fg-primary,#f4f4f6)]"
            >
              Choose study version and design
            </h3>
          </div>
          <p
            id={descId}
            className="text-sm leading-relaxed text-[var(--studio-fg-secondary,#cbd5e1)]"
          >
            {pending.fileName ? (
              <>
                <span className="font-mono text-[var(--studio-fg-primary,#f4f4f6)]">
                  {pending.fileName}
                </span>{" "}
                contains multiple versions or study designs.{" "}
              </>
            ) : (
              "This USDM document contains multiple versions or study designs. "
            )}
            Pick which version and design to open; unselected versions and
            designs stay preserved in the workspace.
          </p>

          <div className="space-y-3">
            <label
              htmlFor={versionFieldId}
              className="flex min-w-0 flex-col gap-1 text-xs font-mono uppercase tracking-[0.12em] text-[var(--studio-fg-secondary,#cbd5e1)]"
            >
              Study version
              <select
                id={versionFieldId}
                value={effectiveVersionId}
                onChange={(event) => {
                  const nextVerId = event.target.value;
                  setSelectedVersionId(nextVerId);
                  const nextChoice = choices.find(
                    (c) => c.studyVersionId === nextVerId
                  );
                  setSelectedDesignId(nextChoice?.designs[0]?.id ?? "");
                }}
                className={`${SELECT_BASE} min-h-11 font-sans text-sm`}
              >
                {choices.map((choice) => (
                  <option
                    key={choice.studyVersionId}
                    value={choice.studyVersionId}
                  >
                    Version {choice.versionIdentifier} ({choice.studyVersionId})
                  </option>
                ))}
              </select>
            </label>

            <label
              htmlFor={designFieldId}
              className="flex min-w-0 flex-col gap-1 text-xs font-mono uppercase tracking-[0.12em] text-[var(--studio-fg-secondary,#cbd5e1)]"
            >
              Study design
              <select
                id={designFieldId}
                value={effectiveDesignId}
                onChange={(event) => setSelectedDesignId(event.target.value)}
                className={`${SELECT_BASE} min-h-11 font-sans text-sm`}
              >
                {designs.map((design) => (
                  <option key={design.id} value={design.id}>
                    {design.name} ({design.id})
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className={`${BTN_BASE} min-h-11`}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`${BTN_AMBER} min-h-11 min-w-11 px-3`}
            >
              Open selected design
            </button>
          </div>
        </form>
      ) : null}
    </ModalContainer>
  );
}

interface SchemaIssuesModalState {
  readonly studyId: string;
  readonly title: string;
  readonly issues: readonly string[];
}

function SchemaDiagnosticsModal({
  state,
  onExportWorkspace,
  onClose,
}: {
  readonly state: SchemaIssuesModalState | null;
  readonly onExportWorkspace: (studyId: string) => void;
  readonly onClose: () => void;
}) {
  const titleId = useId();
  const descId = useId();

  return (
    <ModalContainer
      isOpen={state !== null}
      onClose={onClose}
      titleId={titleId}
      ariaDescribedBy={descId}
      maxWidth="max-w-2xl"
      className="border-[var(--studio-accent-amber-border,rgba(245,158,11,0.4))] bg-[var(--studio-surface-elevated,#13151a)] p-5 text-[var(--studio-fg-primary,#f4f4f6)]"
    >
      {state ? (
        <div className="min-w-0 space-y-4">
          <div className="space-y-1">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--studio-accent-amber-fg,#fcd34d)]">
              USDM v{CLINICAL_STANDARDS_PROFILE.USDM} schema diagnostics
            </p>
            <h3
              id={titleId}
              className="text-base font-semibold text-[var(--studio-fg-primary,#f4f4f6)]"
            >
              Canonical USDM export blocked by {state.issues.length}{" "}
              {state.issues.length === 1 ? "issue" : "issues"}
            </h3>
          </div>
          <p
            id={descId}
            className="text-sm leading-relaxed text-[var(--studio-fg-secondary,#cbd5e1)]"
          >
            <span className="text-[var(--studio-fg-primary,#f4f4f6)]">
              {state.title}
            </span>{" "}
            has missing or incomplete USDM v4 fields. Resolve the schema paths
            below to export canonical{" "}
            <span className="font-mono">.usdm.json</span>, or export a{" "}
            <span className="font-mono">.study.json</span> workspace snapshot to
            preserve your work in progress.
          </p>
          <ul className="max-h-60 space-y-1.5 overflow-y-auto rounded border border-[var(--studio-border-subtle,rgba(255,255,255,0.08))] bg-[var(--studio-surface-subtle,#0d0e11)] p-3 font-mono text-xs text-[var(--studio-accent-amber-fg,#fde68a)]">
            {state.issues.slice(0, 25).map((issue, idx) => (
              <li key={`${idx}-${issue}`} className="min-w-0 break-words">
                {issue}
              </li>
            ))}
            {state.issues.length > 25 ? (
              <li className="text-[var(--studio-fg-muted,#94a3b8)]">
                …and {state.issues.length - 25} more schema issues.
              </li>
            ) : null}
          </ul>
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                onExportWorkspace(state.studyId);
                onClose();
              }}
              className={`${BTN_AMBER} min-h-11`}
            >
              Export workspace (.study.json)
            </button>
            <button
              type="button"
              onClick={onClose}
              className={`${BTN_BASE} min-h-11`}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </ModalContainer>
  );
}

interface StudyRepositoryBarProps {
  readonly repository?: StudyRepositoryClient;
  /** Study currently open in the host studio. */
  readonly currentStudyId?: string;
  /** Revision currently open in the host studio's editor buffer. */
  readonly currentRevisionId?: string;
  /** Fired when the user selects, imports, creates, or resets a study. */
  readonly onSelectStudy?: (record: StudyRepositoryRecord) => void;
  /** Fired when the user reloads a newer revision committed in another tab. */
  readonly onReloadLatest?: (record: StudyRepositoryRecord) => void;
  /** Whether to render the Active study combobox inline. Defaults to true. */
  readonly showStudySelect?: boolean;
  /** Whether to offer creating a blank USDM v4 study. Defaults to true. */
  readonly allowCreateBlank?: boolean;
  /** Compact density for studio toolbars such as CRF Studio. */
  readonly compact?: boolean;
  readonly className?: string;
}

/**
 * Shared browser study repository bar and drawer connecting `/study-studio`,
 * `/crf`, `/study-data`, and `/clinical` to IndexedDB + `BroadcastChannel`.
 */
export function StudyRepositoryBar({
  repository: customRepository,
  currentStudyId,
  currentRevisionId,
  onSelectStudy,
  onReloadLatest,
  showStudySelect = true,
  allowCreateBlank = true,
  compact = false,
  className = "",
}: StudyRepositoryBarProps) {
  const { snapshot, repository } = useStudyRepository(customRepository);
  const selectId = useId();
  const drawerTitleId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [pendingSelection, setPendingSelection] =
    useState<PendingStudySelectionImport | null>(null);
  const [schemaDiagnostics, setSchemaDiagnostics] =
    useState<SchemaIssuesModalState | null>(null);
  const [feedback, setFeedback] = useState<{
    readonly tone: "info" | "error";
    readonly text: string;
  } | null>(null);

  const effectiveStudyId =
    currentStudyId ?? snapshot.activeStudyId ?? DEMO_STUDY_ID;
  const activeSummary =
    snapshot.studies.find((entry) => entry.studyId === effectiveStudyId) ??
    null;

  // Detect whether another tab saved a newer revision of the study currently
  // open in this studio.
  const newerStoredRevision =
    currentRevisionId &&
    activeSummary &&
    activeSummary.revisionId !== currentRevisionId
      ? activeSummary
      : null;

  const minHeight = compact ? "min-h-11" : "min-h-12";

  const handleSwitchStudy = async (nextStudyId: string) => {
    setFeedback(null);
    const record = await repository.selectStudy(nextStudyId);
    if (record) {
      onSelectStudy?.(record);
    }
  };

  const handleCreateBlank = async () => {
    setFeedback(null);
    const created = await repository.createBlankStudy();
    onSelectStudy?.(created);
    setFeedback({
      tone: "info",
      text: `Created ${created.protocolCode} (${created.workspace.revision.id}).`,
    });
  };

  const applyImportOutcome = (
    outcome: Awaited<ReturnType<StudyRepositoryClient["importFile"]>>
  ) => {
    if (outcome.status === "needs-selection") {
      setPendingSelection(outcome.pending);
      return;
    }
    if (outcome.status === "too-large") {
      setFeedback({
        tone: "error",
        text: `Import refused: file is ${formatBytesMiB(outcome.actualBytes)}, exceeding the ${formatBytesMiB(outcome.maxBytes)} limit.`,
      });
      return;
    }
    if (outcome.status === "invalid-workspace") {
      setFeedback({
        tone: "error",
        text: `Workspace file could not be opened (${outcome.problem}).`,
      });
      return;
    }
    if (outcome.status === "rejected") {
      setFeedback({
        tone: "error",
        text:
          outcome.problems[0]?.message ??
          "The file could not be read as a USDM v4 study.",
      });
      return;
    }
    setPendingSelection(null);
    onSelectStudy?.(outcome.record);
    const issueNote =
      outcome.schemaIssues.length > 0
        ? ` (${outcome.schemaIssues.length} schema ${outcome.schemaIssues.length === 1 ? "issue" : "issues"} noted)`
        : "";
    setFeedback({
      tone: "info",
      text: `Imported ${outcome.record.protocolCode} at ${outcome.record.workspace.revision.id}${issueNote}.`,
    });
  };

  const handleFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setFeedback(null);
    const outcome = await repository.importFile({
      byteLength: file.size,
      fileName: file.name,
      readText: () => file.text(),
    });
    applyImportOutcome(outcome);
  };

  const handleConfirmSelection = async (selection: StudyWorkspaceSelection) => {
    if (!pendingSelection) return;
    const outcome = await repository.confirmImportSelection(
      pendingSelection,
      selection
    );
    applyImportOutcome(outcome);
  };

  const handleExportUsdm = async (studyId = effectiveStudyId) => {
    setFeedback(null);
    const result = await repository.exportCheckedUsdm(studyId);
    if (!result) return;
    if (result.status === "invalid") {
      setSchemaDiagnostics({
        studyId: result.studyId,
        title: result.title,
        issues: result.issues,
      });
      return;
    }
    downloadFile(`${result.json}\n`, result.fileName, {
      mimeType: "application/json",
    });
    setFeedback({
      tone: "info",
      text: `Exported ${result.fileName} (SHA-256 ${result.sha256.slice(0, 12)}…).`,
    });
  };

  const handleExportWorkspace = async (studyId = effectiveStudyId) => {
    setFeedback(null);
    const result = await repository.exportWorkspaceSnapshot(studyId);
    if (!result) return;
    downloadFile(result.json, result.fileName, {
      mimeType: "application/json",
    });
    setFeedback({
      tone: "info",
      text: `Exported workspace snapshot ${result.fileName}.`,
    });
  };

  const handleDeleteStudy = async (studyId: string) => {
    await repository.deleteStudy(studyId);
    const nextSnap = repository.getSnapshot();
    const nextTarget =
      nextSnap.activeStudyId ?? nextSnap.studies[0]?.studyId ?? DEMO_STUDY_ID;
    const nextRecord = await repository.getRecord(nextTarget);
    if (nextRecord && studyId === effectiveStudyId) {
      onSelectStudy?.(nextRecord);
    }
    setFeedback({
      tone: "info",
      text:
        studyId === DEMO_STUDY_ID ||
        studyId === "tavr-savr" ||
        studyId === "tavr-device"
          ? `Reset ${studyId} to reference revision R1.`
          : `Removed local workspace ${studyId}.`,
    });
  };

  const handleReloadLatest = async () => {
    const latest = await repository.getRecord(effectiveStudyId);
    if (!latest) return;
    if (onReloadLatest) {
      onReloadLatest(latest);
    } else {
      onSelectStudy?.(latest);
    }
    setFeedback({
      tone: "info",
      text: `Loaded latest revision ${latest.workspace.revision.id}.`,
    });
  };

  return (
    <div
      data-testid="study-repository-bar"
      className={`min-w-0 space-y-2 ${className}`}
    >
      <div
        className={`flex min-w-0 flex-wrap items-center gap-2 rounded border border-[var(--studio-border-subtle,rgba(255,255,255,0.08))] bg-[var(--studio-surface-subtle,#13151a)] ${compact ? "px-2.5 py-1.5" : "px-3 py-2.5"}`}
      >
        {showStudySelect ? (
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <label
              htmlFor={selectId}
              className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--studio-fg-muted,#94a3b8)]"
            >
              Active study
            </label>
            <select
              id={selectId}
              value={effectiveStudyId}
              onChange={(event) => void handleSwitchStudy(event.target.value)}
              className={`${SELECT_BASE} ${minHeight} max-w-full sm:max-w-[18rem]`}
            >
              {snapshot.studies.length === 0 ? (
                <option value={effectiveStudyId}>{effectiveStudyId}</option>
              ) : (
                snapshot.studies.map((item) => (
                  <option key={item.studyId} value={item.studyId}>
                    {item.protocolCode} · {item.revisionId}
                  </option>
                ))
              )}
            </select>
          </div>
        ) : null}

        {!showStudySelect ? (
          <span
            data-testid="study-repository-study-id"
            className="min-w-0 rounded border border-[var(--studio-border-default,rgba(255,255,255,0.12))] bg-[var(--studio-surface-card,#0d0e11)] px-2.5 py-1 font-mono text-[11px] font-semibold text-[var(--studio-fg-primary,#f4f4f6)]"
          >
            {activeSummary?.protocolCode ?? effectiveStudyId}
          </span>
        ) : null}

        <span
          data-testid="study-repository-revision"
          className="min-w-0 rounded border border-[var(--studio-accent-emerald-border,rgba(16,185,129,0.3))] bg-[var(--studio-accent-emerald-bg,rgba(16,185,129,0.1))] px-2 py-1 font-mono text-[11px] text-[var(--studio-accent-emerald-fg,#6ee7b7)]"
        >
          {activeSummary
            ? `${activeSummary.revisionId} · ${activeSummary.sha256.slice(0, 8)}`
            : (currentRevisionId ?? "R1")}
        </span>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.usdm.json,.study.json,application/json"
          onChange={(event) => void handleFileSelected(event)}
          data-testid="study-repository-file-input"
          aria-label="Import USDM or study workspace JSON"
          className="sr-only"
        />

        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={`${BTN_BASE} ${minHeight}`}
          >
            Import (.usdm / .study.json)
          </button>
          <button
            type="button"
            onClick={() => void handleExportUsdm()}
            disabled={!snapshot.isHydrated}
            className={`${BTN_BASE} ${minHeight}`}
          >
            Export USDM (.usdm.json)
          </button>
          <button
            type="button"
            onClick={() => void handleExportWorkspace()}
            disabled={!snapshot.isHydrated}
            className={`${BTN_BASE} ${minHeight}`}
          >
            Export workspace (.study.json)
          </button>
          {allowCreateBlank ? (
            <button
              type="button"
              onClick={() => void handleCreateBlank()}
              disabled={!snapshot.isHydrated}
              className={`${BTN_BASE} ${minHeight}`}
            >
              New blank study
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            disabled={!snapshot.isHydrated}
            className={`${BTN_BASE} ${minHeight}`}
          >
            Repository ({snapshot.studies.length || 3})
          </button>
        </div>

        <nav
          aria-label="Workspace studios"
          data-testid="study-repository-links"
          className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--studio-border-subtle,rgba(255,255,255,0.08))] pt-1.5 text-[11px] font-mono sm:ml-auto sm:border-t-0 sm:pt-0"
        >
          {STUDIO_LINKS.map((link) => (
            <IntentLink
              key={link.href}
              href={link.href}
              className="inline-flex min-h-9 items-center text-[var(--studio-fg-secondary,#cbd5e1)] underline decoration-zinc-600 underline-offset-4 hover:text-[var(--studio-fg-primary,#f4f4f6)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-ring,#fbbf24)]"
            >
              {link.label}
            </IntentLink>
          ))}
        </nav>
      </div>

      {snapshot.isHydrated && snapshot.persistence === "memory" ? (
        <div
          data-testid="study-repository-volatile-notice"
          className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded border border-[var(--studio-accent-amber-border,rgba(245,158,11,0.35))] bg-[var(--studio-accent-amber-bg,rgba(245,158,11,0.1))] px-3 py-2 text-xs text-[var(--studio-accent-amber-fg,#fde68a)]"
        >
          <span className="min-w-0">
            Browser IndexedDB storage is unavailable in this window, so studies
            stay in memory for this tab. Export{" "}
            <span className="font-mono">.study.json</span> or{" "}
            <span className="font-mono">.usdm.json</span> to keep a local file.
          </span>
        </div>
      ) : null}

      {newerStoredRevision ? (
        <div
          data-testid="study-repository-reload-banner"
          className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded border border-[var(--studio-accent-sky-border,rgba(56,189,248,0.4))] bg-[var(--studio-accent-sky-bg,rgba(14,165,233,0.1))] px-3 py-2 text-xs text-[var(--studio-accent-sky-fg,#e0f2fe)]"
        >
          <span className="min-w-0">
            Another tab saved{" "}
            <span className="font-mono font-semibold">
              {newerStoredRevision.protocolCode}
            </span>{" "}
            at revision{" "}
            <span className="font-mono font-semibold">
              {newerStoredRevision.revisionId}
            </span>{" "}
            (this view shows{" "}
            <span className="font-mono">{currentRevisionId}</span>).
          </span>
          <button
            type="button"
            onClick={() => void handleReloadLatest()}
            className={`${BTN_AMBER} min-h-11`}
          >
            Reload {newerStoredRevision.revisionId}
          </button>
        </div>
      ) : null}

      {feedback ? (
        <p
          data-testid="study-repository-feedback"
          className={`min-w-0 break-words rounded border px-3 py-2 text-xs ${
            feedback.tone === "error"
              ? "border-[var(--studio-accent-amber-border,rgba(245,158,11,0.4))] bg-[var(--studio-accent-amber-bg,rgba(245,158,11,0.1))] text-[var(--studio-accent-amber-fg,#fde68a)]"
              : "border-[var(--studio-border-subtle,rgba(255,255,255,0.08))] bg-[var(--studio-surface-card,#0d0e11)] text-[var(--studio-fg-secondary,#cbd5e1)]"
          }`}
        >
          {feedback.text}
        </p>
      ) : null}

      <VersionDesignSelectionModal
        pending={pendingSelection}
        onConfirm={(selection) => void handleConfirmSelection(selection)}
        onCancel={() => setPendingSelection(null)}
      />

      <SchemaDiagnosticsModal
        state={schemaDiagnostics}
        onExportWorkspace={(studyId) => void handleExportWorkspace(studyId)}
        onClose={() => setSchemaDiagnostics(null)}
      />

      <ModalContainer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        titleId={drawerTitleId}
        maxWidth="max-w-3xl"
        className="border-[var(--studio-border-default,rgba(255,255,255,0.12))] bg-[var(--studio-surface-elevated,#13151a)] p-5 text-[var(--studio-fg-primary,#f4f4f6)]"
      >
        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--studio-border-subtle,rgba(255,255,255,0.08))] pb-3">
            <div className="min-w-0 space-y-1">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--studio-fg-muted,#94a3b8)]">
                Shared browser study catalog ·{" "}
                {snapshot.persistence === "indexeddb"
                  ? "IndexedDB"
                  : "In-memory fallback"}
              </p>
              <h3
                id={drawerTitleId}
                className="text-base font-semibold text-[var(--studio-fg-primary,#f4f4f6)]"
              >
                Local USDM v4 studies
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setIsDrawerOpen(false)}
              className={`${BTN_BASE} min-h-11`}
            >
              Close
            </button>
          </div>

          <ul className="max-h-[60vh] space-y-2.5 overflow-y-auto pr-1">
            {snapshot.studies.map((item) => {
              const isCurrent = item.studyId === effectiveStudyId;
              const isRef = item.kind === "reference";
              return (
                <li
                  key={item.studyId}
                  className={`min-w-0 rounded border p-3 ${
                    isCurrent
                      ? "border-[var(--studio-accent-amber-border,rgba(251,191,36,0.5))] bg-[var(--studio-surface-subtle,#0d0e11)]"
                      : "border-[var(--studio-border-subtle,rgba(255,255,255,0.08))] bg-[var(--studio-surface-card,rgba(13,14,17,0.7))]"
                  }`}
                >
                  <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-[var(--studio-fg-primary,#f4f4f6)]">
                          {item.protocolCode}
                        </span>
                        <span className="rounded border border-[var(--studio-border-default,rgba(255,255,255,0.12))] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--studio-fg-secondary,#cbd5e1)]">
                          {kindBadgeLabel(item.kind)}
                        </span>
                        <span className="font-mono text-[11px] text-[var(--studio-accent-emerald-fg,#6ee7b7)]">
                          {item.revisionId} · {item.sha256.slice(0, 10)}
                        </span>
                        {isCurrent ? (
                          <span className="font-mono text-[11px] text-[var(--studio-accent-amber-fg,#fcd34d)]">
                            Active
                          </span>
                        ) : null}
                      </div>
                      <p className="min-w-0 break-words text-xs text-[var(--studio-fg-secondary,#cbd5e1)]">
                        {item.title}
                      </p>
                      <p className="font-mono text-[11px] text-[var(--studio-fg-muted,#94a3b8)]">
                        {item.armCount} arms · {item.epochCount} epochs ·{" "}
                        {item.encounterCount} visits · {item.activityCount}{" "}
                        activities
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {!isCurrent ? (
                        <button
                          type="button"
                          onClick={() => {
                            void handleSwitchStudy(item.studyId);
                            setIsDrawerOpen(false);
                          }}
                          className={`${BTN_AMBER} min-h-11`}
                        >
                          Switch to study
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void handleExportUsdm(item.studyId)}
                        className={`${BTN_BASE} min-h-11`}
                      >
                        .usdm.json
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleExportWorkspace(item.studyId)}
                        className={`${BTN_BASE} min-h-11`}
                      >
                        .study.json
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteStudy(item.studyId)}
                        disabled={isRef && item.revisionId === "R1"}
                        className={`${BTN_BASE} min-h-11`}
                      >
                        {isRef ? "Reset R1" : "Delete"}
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </ModalContainer>
    </div>
  );
}
