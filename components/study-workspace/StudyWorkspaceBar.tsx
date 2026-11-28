"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { IntentLink } from "@/components/ui/IntentLink";
import { ModalContainer } from "@/components/ui/ModalContainer";
import {
  CLINICAL_STANDARDS_PROFILE,
  validateUsdmV4Document,
} from "@/lib/clinical-standards";
import { DEMO_STUDY_ID } from "@/lib/clinical-study-context";
import { downloadFile } from "@/lib/download";
import { RANDOMIZATION_RESOURCE_LIMITS } from "@/lib/randomization";
import {
  STUDY_PHASE_TERMS,
  describeStudyWorkspace,
  exportValidatedStudyUsdm,
  importUsdmStudy,
  openStudyWorkspace,
  projectStudyMetadata,
  serializeStudyWorkspace,
  updateStudyName,
  updateStudyPhase,
  updateStudyProtocolId,
  type PreservedItem,
  type StudyEdit,
  type StudyRepositoryRecord,
  type StudyRepositorySummary,
  type StudyVersionChoice,
  type StudyWorkspace,
  type StudyWorkspaceSelection,
} from "@/lib/study-workspace";
import type {
  PendingStudySelectionImport,
  StudyRepositoryClient,
} from "@/components/clinical/study-repository-client";
import { useStudyRepository } from "@/components/clinical/useStudyRepository";

const MAX_WORKSPACE_IMPORT_BYTES = RANDOMIZATION_RESOURCE_LIMITS.maxImportBytes;

const MONO = "font-[family-name:var(--font-geist-mono)]";

const BTN_BASE =
  "inline-flex min-h-12 min-w-12 items-center justify-center gap-1.5 rounded border border-white/[0.12] bg-[#0d0e11] px-3 py-1.5 text-xs font-medium text-[#f4f4f6] transition-colors hover:border-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]";

const BTN_AMBER =
  "inline-flex min-h-12 min-w-12 items-center justify-center gap-1.5 rounded border border-amber-400/60 bg-amber-500/15 px-3 py-1.5 text-xs font-medium text-amber-200 transition-colors hover:bg-amber-500/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]";

const FIELD_INPUT =
  "min-h-12 min-w-0 w-full rounded border border-white/[0.12] bg-[#0d0e11] px-2.5 py-1.5 text-sm text-[#f4f4f6] placeholder:text-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400";

function formatBytesMiB(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

function sanitizeDownloadSlug(raw: string): string {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "study";
}

function preservedReasonCopy(reason: PreservedItem["reason"]): string {
  switch (reason) {
    case "other-study-version":
      return "Unselected study version";
    case "other-study-design":
      return "Unselected study design";
    case "extension-attributes":
      return "Extension attributes";
  }
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

interface SelectOption {
  readonly id: string;
  readonly label: string;
}

interface StudyWorkspaceBarProps {
  readonly repository?: StudyRepositoryClient;
  readonly studyId: string;
  readonly source: string;
  readonly selectOptions: readonly SelectOption[];
  readonly workspace: StudyWorkspace;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly onOpenSource: (sourceId: string) => void;
  readonly onSelectStudy: (
    record: StudyRepositoryRecord,
    announceNote?: string
  ) => void;
  readonly onReloadLatest: (record: StudyRepositoryRecord) => void;
  readonly onApplyEdit: (
    make: (workspace: StudyWorkspace) => StudyEdit
  ) => boolean;
  readonly onUndo: () => void;
  readonly onRedo: () => void;
}

function MetadataCommitField({
  label,
  value,
  placeholder,
  mono = false,
  onCommit,
}: {
  readonly label: string;
  readonly value: string;
  readonly placeholder?: string;
  readonly mono?: boolean;
  readonly onCommit: (nextValue: string) => boolean;
}) {
  const fieldId = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? value;

  const commit = () => {
    if (draft === null) return;
    const next = draft;
    setDraft(null);
    if (next.trim() === value.trim()) return;
    onCommit(next);
  };

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label
        htmlFor={fieldId}
        className={`${MONO} text-[11px] uppercase tracking-[0.12em] text-slate-400`}
      >
        {label}
      </label>
      <input
        id={fieldId}
        type="text"
        value={shown}
        placeholder={placeholder}
        className={`${FIELD_INPUT} ${mono ? MONO : ""}`}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          } else if (event.key === "Escape") {
            setDraft(null);
          }
        }}
      />
    </div>
  );
}

function VersionDesignChooserModal({
  pending,
  onConfirm,
  onCancel,
}: {
  readonly pending: PendingStudySelectionImport | null;
  readonly onConfirm: (selection: StudyWorkspaceSelection) => void;
  readonly onCancel: () => void;
}) {
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
      className="border-white/[0.12] bg-[#13151a] p-5 text-[#f4f4f6]"
    >
      {pending ? (
        <form onSubmit={submit} className="min-w-0 space-y-4">
          <div className="space-y-1">
            <p
              className={`${MONO} text-[11px] uppercase tracking-[0.16em] text-sky-300`}
            >
              USDM selection
            </p>
            <h3 id={titleId} className="text-base font-semibold text-[#f4f4f6]">
              Choose study version and design
            </h3>
          </div>
          <p id={descId} className="text-sm leading-relaxed text-slate-300">
            {pending.fileName ? (
              <>
                <span className={`${MONO} text-[#f4f4f6]`}>
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
              className={`flex min-w-0 flex-col gap-1 ${MONO} text-xs uppercase tracking-[0.12em] text-slate-300`}
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
                className={`${FIELD_INPUT} font-sans`}
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
              className={`flex min-w-0 flex-col gap-1 ${MONO} text-xs uppercase tracking-[0.12em] text-slate-300`}
            >
              Study design
              <select
                id={designFieldId}
                value={effectiveDesignId}
                onChange={(event) => setSelectedDesignId(event.target.value)}
                className={`${FIELD_INPUT} font-sans`}
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
              className={`${BTN_BASE} min-h-12 min-w-12`}
            >
              Cancel
            </button>
            <button type="submit" className={`${BTN_AMBER} min-h-12 min-w-12`}>
              Open selected design
            </button>
          </div>
        </form>
      ) : null}
    </ModalContainer>
  );
}

/**
 * Two-tier resilient governance bar for `/study-studio` (CONTEXT.md section 2,
 * ADR 0074). Tier 1 handles study selection, revision/USDM/preserved provenance
 * inspection, and `.usdm.json` / `.study.json` file I/O with an 8 MiB ceiling
 * and SHA-256 checks. Tier 2 provides inline reversible study metadata inputs
 * (`Protocol ID`, `Study name`, `Phase`) alongside `Undo` and `Redo`.
 */
export function StudyWorkspaceBar({
  repository: customRepository,
  studyId,
  source,
  selectOptions,
  workspace,
  canUndo,
  canRedo,
  onOpenSource,
  onSelectStudy,
  onReloadLatest,
  onApplyEdit,
  onUndo,
  onRedo,
}: StudyWorkspaceBarProps) {
  const { snapshot, repository } = useStudyRepository(customRepository);
  const studySelectId = useId();
  const phaseSelectId = useId();
  const governanceTitleId = useId();
  const governanceDescId = useId();
  const diagnosticsTitleId = useId();
  const diagnosticsDescId = useId();
  const catalogTitleId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isGovernanceOpen, setIsGovernanceOpen] = useState(false);
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [pendingSelection, setPendingSelection] =
    useState<PendingStudySelectionImport | null>(null);
  const [exportBlockingIssues, setExportBlockingIssues] = useState<
    readonly string[] | null
  >(null);
  const [liveSchemaIssues, setLiveSchemaIssues] = useState<readonly string[]>(
    []
  );
  const [feedback, setFeedback] = useState<{
    readonly tone: "info" | "error";
    readonly text: string;
  } | null>(null);

  // Re-evaluate USDM v4 schema issues asynchronously whenever the working USDM changes.
  useEffect(() => {
    let active = true;
    void validateUsdmV4Document(workspace.usdm).then((issues) => {
      if (active) setLiveSchemaIssues(issues);
    });
    return () => {
      active = false;
    };
  }, [workspace.usdm]);

  // Global Undo/Redo keyboard shortcuts when focus is outside editable text controls.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
      if (event.key.toLowerCase() !== "z") return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (event.shiftKey) {
        if (canRedo) {
          event.preventDefault();
          onRedo();
        }
      } else if (canUndo) {
        event.preventDefault();
        onUndo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canRedo, canUndo, onRedo, onUndo]);

  const meta = projectStudyMetadata(workspace);
  const summary = describeStudyWorkspace(workspace);
  const activeSummary =
    snapshot.studies.find((entry) => entry.studyId === studyId) ?? null;

  const newerStoredRevision =
    activeSummary && activeSummary.revisionId !== workspace.revision.id
      ? activeSummary
      : null;

  const customPhaseNotListed =
    meta.phase !== null &&
    !STUDY_PHASE_TERMS.some((term) => term.code === meta.phase?.code);

  const handleSaveWorkspaceJson = () => {
    setFeedback(null);
    const json = serializeStudyWorkspace(workspace);
    const slug = sanitizeDownloadSlug(
      meta.protocolId || meta.studyName || studyId
    );
    const fileName = `${slug}.study.json`;
    downloadFile(json, fileName, { mimeType: "application/json" });
    setFeedback({
      tone: "info",
      text: `Saved workspace snapshot ${fileName} (${workspace.revision.id}).`,
    });
  };

  const handleExportValidatedUsdm = async () => {
    setFeedback(null);
    const exported = await exportValidatedStudyUsdm(workspace);
    if (exported.status === "invalid") {
      setExportBlockingIssues(exported.issues);
      return;
    }
    const slug = sanitizeDownloadSlug(
      meta.protocolId || meta.studyName || studyId
    );
    const fileName = `${slug}.usdm.json`;
    downloadFile(`${exported.json}\n`, fileName, {
      mimeType: "application/json",
    });
    setFeedback({
      tone: "info",
      text: `Exported validated USDM ${fileName} (SHA-256 ${exported.sha256.slice(0, 12)}…, ${workspace.preserved.length} preserved ${workspace.preserved.length === 1 ? "item" : "items"}).`,
    });
  };

  const applyRepositoryOutcome = (
    outcome: Awaited<ReturnType<StudyRepositoryClient["importFile"]>>
  ) => {
    if (outcome.status === "needs-selection") {
      setPendingSelection(outcome.pending);
      return;
    }
    if (outcome.status === "too-large") {
      setFeedback({
        tone: "error",
        text: `Import refused: file is ${formatBytesMiB(outcome.actualBytes)}, exceeding the ${formatBytesMiB(MAX_WORKSPACE_IMPORT_BYTES)} limit.`,
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
    setLiveSchemaIssues(outcome.schemaIssues);
    const issueSuffix =
      outcome.schemaIssues.length > 0
        ? ` (${outcome.schemaIssues.length} schema ${outcome.schemaIssues.length === 1 ? "issue" : "issues"} noted)`
        : "";
    const message = `Imported ${outcome.record.protocolCode} at ${outcome.record.workspace.revision.id}${issueSuffix}.`;
    onSelectStudy(outcome.record, message);
    setFeedback({
      tone: "info",
      text: message,
    });
  };

  const handleFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setFeedback(null);

    if (file.size > MAX_WORKSPACE_IMPORT_BYTES) {
      setFeedback({
        tone: "error",
        text: `Import refused: ${file.name} is ${formatBytesMiB(file.size)}, exceeding the ${formatBytesMiB(MAX_WORKSPACE_IMPORT_BYTES)} (8 MiB) limit.`,
      });
      return;
    }

    let text: string;
    try {
      text = await file.text();
    } catch {
      setFeedback({
        tone: "error",
        text: `Import refused: ${file.name} could not be read.`,
      });
      return;
    }

    const utf8Bytes = new TextEncoder().encode(text).byteLength;
    if (utf8Bytes > MAX_WORKSPACE_IMPORT_BYTES) {
      setFeedback({
        tone: "error",
        text: `Import refused: ${file.name} is ${formatBytesMiB(utf8Bytes)}, exceeding the ${formatBytesMiB(MAX_WORKSPACE_IMPORT_BYTES)} (8 MiB) limit.`,
      });
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (caught) {
      setFeedback({
        tone: "error",
        text:
          caught instanceof Error
            ? caught.message
            : "The file is not valid JSON.",
      });
      return;
    }

    const looksLikeWorkspace =
      (isRecord(parsed) && "workspaceVersion" in parsed) ||
      /\.study\.json$/i.test(file.name.trim());

    if (looksLikeWorkspace && !(isRecord(parsed) && "usdmVersion" in parsed)) {
      const opened = openStudyWorkspace(text);
      if (opened.status === "invalid") {
        setFeedback({
          tone: "error",
          text:
            opened.problem === "revision-hash-mismatch"
              ? "Workspace file could not be opened: SHA-256 revision integrity mismatch (revision-hash-mismatch)."
              : `Workspace file could not be opened (${opened.problem}).`,
        });
        return;
      }
    } else {
      const precheck = await importUsdmStudy(
        { document: parsed },
        { fileName: file.name }
      );
      if (precheck.status === "rejected") {
        setFeedback({
          tone: "error",
          text:
            precheck.problems[0]?.message ??
            "The file could not be imported as a USDM study.",
        });
        return;
      }
    }

    const outcome = await repository.importFile({
      byteLength: utf8Bytes,
      fileName: file.name,
      readText: async () => text,
    });
    applyRepositoryOutcome(outcome);
  };

  const handleConfirmSelection = async (selection: StudyWorkspaceSelection) => {
    if (!pendingSelection) return;
    const outcome = await repository.confirmImportSelection(
      pendingSelection,
      selection
    );
    applyRepositoryOutcome(outcome);
  };

  const handleReloadLatest = async () => {
    const latest = await repository.getRecord(studyId);
    if (!latest) return;
    onReloadLatest(latest);
    setFeedback({
      tone: "info",
      text: `Loaded latest revision ${latest.workspace.revision.id}.`,
    });
  };

  const handleDeleteFromCatalog = async (targetStudyId: string) => {
    await repository.deleteStudy(targetStudyId);
    const nextSnap = repository.getSnapshot();
    const nextTarget =
      nextSnap.activeStudyId ?? nextSnap.studies[0]?.studyId ?? DEMO_STUDY_ID;
    const nextRecord = await repository.getRecord(nextTarget);
    if (nextRecord && targetStudyId === studyId) {
      onSelectStudy(nextRecord);
    }
    setFeedback({
      tone: "info",
      text:
        targetStudyId === DEMO_STUDY_ID ||
        targetStudyId === "tavr-savr" ||
        targetStudyId === "tavr-device"
          ? `Reset ${targetStudyId} to reference revision R1.`
          : `Removed local workspace ${targetStudyId}.`,
    });
  };

  return (
    <section
      aria-label="Study workspace governance"
      data-testid="study-workspace-bar"
      className="min-w-0 space-y-2"
    >
      <div className="min-w-0 divide-y divide-white/[0.08] rounded-lg border border-white/[0.08] bg-[#13151a]">
        {/* Tier 1: Governance, Provenance & File I/O */}
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 px-3.5 py-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2.5">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <label
                htmlFor={studySelectId}
                className={`${MONO} text-[11px] uppercase tracking-[0.14em] text-slate-400`}
              >
                Study
              </label>
              <select
                id={studySelectId}
                value={source}
                onChange={(event) => {
                  setFeedback(null);
                  onOpenSource(event.target.value);
                }}
                className={`${FIELD_INPUT} w-auto max-w-full sm:max-w-[19rem]`}
              >
                {selectOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div
              data-testid="study-repository-revision"
              className={`flex min-w-0 flex-wrap items-center gap-1.5 rounded border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 ${MONO} text-xs text-emerald-300`}
            >
              <span>Revision {workspace.revision.id}</span>
              <span aria-hidden="true" className="text-emerald-400/60">
                ·
              </span>
              <span>USDM {workspace.locks.USDM}</span>
            </div>

            <button
              type="button"
              onClick={() => setIsGovernanceOpen(true)}
              data-testid="study-governance-inspector-trigger"
              className={
                liveSchemaIssues.length > 0
                  ? `${BTN_AMBER} ${MONO}`
                  : `${BTN_BASE} ${MONO}`
              }
            >
              <span>
                {workspace.preserved.length} preserved{" "}
                {workspace.preserved.length === 1 ? "item" : "items"}
              </span>
              <span aria-hidden="true" className="text-slate-500">
                ·
              </span>
              <span>
                {liveSchemaIssues.length}{" "}
                {liveSchemaIssues.length === 1
                  ? "schema issue"
                  : "schema issues"}
              </span>
            </button>
          </div>

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
              className={BTN_BASE}
            >
              Import (.usdm / .study.json)
            </button>
            <button
              type="button"
              onClick={() => void handleExportValidatedUsdm()}
              className={BTN_BASE}
            >
              Export USDM (.usdm.json)
            </button>
            <button
              type="button"
              onClick={handleSaveWorkspaceJson}
              className={BTN_AMBER}
            >
              Export workspace (.study.json)
            </button>
            <button
              type="button"
              onClick={() => setIsCatalogOpen(true)}
              disabled={!snapshot.isHydrated}
              className={BTN_BASE}
            >
              Repository ({snapshot.studies.length || 3})
            </button>
            <nav
              aria-label="Workspace studios"
              data-testid="study-repository-links"
              className={`flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 pl-1 ${MONO} text-[11px]`}
            >
              <IntentLink
                href="/crf"
                className="inline-flex min-h-12 items-center text-slate-300 underline decoration-slate-600 underline-offset-4 hover:text-[#f4f4f6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
              >
                CRF Studio
              </IntentLink>
              <IntentLink
                href="/study-data"
                className="inline-flex min-h-12 items-center text-slate-300 underline decoration-slate-600 underline-offset-4 hover:text-[#f4f4f6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
              >
                Study Data
              </IntentLink>
            </nav>
          </div>
        </div>

        {/* Tier 2: Inline Operational Study Metadata & Undo/Redo */}
        <div className="flex min-w-0 flex-wrap items-end justify-between gap-3 px-3.5 py-3">
          <div className="grid min-w-0 flex-1 basis-full gap-2.5 sm:grid-cols-3 lg:basis-auto">
            <MetadataCommitField
              key={`protocol:${studyId}:${workspace.revision.id}`}
              label="Protocol ID"
              placeholder="e.g. DEV-2026-001"
              mono
              value={meta.protocolId}
              onCommit={(nextValue) =>
                onApplyEdit((w) => updateStudyProtocolId(w, nextValue))
              }
            />
            <MetadataCommitField
              key={`name:${studyId}:${workspace.revision.id}`}
              label="Study name"
              placeholder="Enter study name"
              value={meta.studyName}
              onCommit={(nextValue) =>
                onApplyEdit((w) => updateStudyName(w, nextValue))
              }
            />
            <div className="flex min-w-0 flex-col gap-1">
              <label
                htmlFor={phaseSelectId}
                className={`${MONO} text-[11px] uppercase tracking-[0.12em] text-slate-400`}
              >
                Phase
              </label>
              <select
                id={phaseSelectId}
                value={meta.phase?.code ?? ""}
                onChange={(event) => {
                  const nextCode = event.target.value || null;
                  onApplyEdit((w) => updateStudyPhase(w, nextCode));
                }}
                className={FIELD_INPUT}
              >
                <option value="">Unspecified</option>
                {customPhaseNotListed && meta.phase ? (
                  <option value={meta.phase.code}>
                    {meta.phase.decode} ({meta.phase.code})
                  </option>
                ) : null}
                {STUDY_PHASE_TERMS.map((term) => (
                  <option key={term.code} value={term.code}>
                    {term.decode}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onUndo}
              disabled={!canUndo}
              className={BTN_BASE}
            >
              <span>Undo</span>
              <kbd
                aria-hidden="true"
                className={`rounded border border-white/[0.1] bg-[#13151a] px-1.5 py-0.5 ${MONO} text-[10px] text-slate-400`}
              >
                ⌘Z
              </kbd>
            </button>
            <button
              type="button"
              onClick={onRedo}
              disabled={!canRedo}
              className={BTN_BASE}
            >
              <span>Redo</span>
              <kbd
                aria-hidden="true"
                className={`rounded border border-white/[0.1] bg-[#13151a] px-1.5 py-0.5 ${MONO} text-[10px] text-slate-400`}
              >
                ⇧⌘Z
              </kbd>
            </button>
          </div>
        </div>
      </div>

      {snapshot.isHydrated && snapshot.persistence === "memory" ? (
        <div
          data-testid="study-repository-volatile-notice"
          className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-200"
        >
          <span className="min-w-0">
            Browser IndexedDB storage is unavailable in this window, so studies
            stay in memory for this tab. Export{" "}
            <span className={MONO}>.study.json</span> or{" "}
            <span className={MONO}>.usdm.json</span> to keep a local file.
          </span>
        </div>
      ) : null}

      {newerStoredRevision ? (
        <div
          data-testid="study-repository-reload-banner"
          className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded border border-sky-400/40 bg-sky-500/10 px-3 py-2 text-xs text-sky-100"
        >
          <span className="min-w-0">
            Another tab saved{" "}
            <span className={`${MONO} font-semibold`}>
              {newerStoredRevision.protocolCode}
            </span>{" "}
            at revision{" "}
            <span className={`${MONO} font-semibold`}>
              {newerStoredRevision.revisionId}
            </span>{" "}
            (this view shows{" "}
            <span className={MONO}>{workspace.revision.id}</span>).
          </span>
          <button
            type="button"
            onClick={() => void handleReloadLatest()}
            className={BTN_AMBER}
          >
            Reload {newerStoredRevision.revisionId}
          </button>
        </div>
      ) : null}

      {feedback ? (
        <p
          role={feedback.tone === "error" ? "alert" : "status"}
          data-testid="study-repository-feedback"
          className={`min-w-0 break-words rounded border px-3 py-2 text-xs ${
            feedback.tone === "error"
              ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
              : "border-white/[0.08] bg-[#0d0e11] text-slate-300"
          }`}
        >
          {feedback.text}
        </p>
      ) : null}

      {/* Multi-version / multi-design USDM import chooser */}
      <VersionDesignChooserModal
        pending={pendingSelection}
        onConfirm={(selection) => void handleConfirmSelection(selection)}
        onCancel={() => setPendingSelection(null)}
      />

      {/* Governance & Provenance Inspector Drawer (preserved items + schemaIssues) */}
      <ModalContainer
        isOpen={isGovernanceOpen}
        onClose={() => setIsGovernanceOpen(false)}
        titleId={governanceTitleId}
        ariaDescribedBy={governanceDescId}
        maxWidth="max-w-3xl"
        className="border-white/[0.12] bg-[#13151a] p-5 text-[#f4f4f6]"
      >
        <div className="min-w-0 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.08] pb-3">
            <div className="min-w-0 space-y-1">
              <p
                className={`${MONO} text-[11px] uppercase tracking-[0.16em] text-amber-300`}
              >
                Workspace provenance & schema inspector
              </p>
              <h3
                id={governanceTitleId}
                className="text-base font-semibold text-[#f4f4f6]"
              >
                {summary.title}
              </h3>
              <p id={governanceDescId} className="text-xs text-slate-400">
                Revision {workspace.revision.id} · USDM {workspace.locks.USDM} ·
                CDISC CT {workspace.locks.ctPackageDate}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsGovernanceOpen(false)}
              className={BTN_BASE}
            >
              Close
            </button>
          </div>

          <dl className="grid min-w-0 gap-3 rounded border border-white/[0.08] bg-[#0d0e11] p-3 text-xs sm:grid-cols-2">
            <div className="min-w-0">
              <dt className="text-slate-400">Selected version & design</dt>
              <dd className={`${MONO} mt-0.5 break-all text-slate-200`}>
                {workspace.selection.studyVersionId} /{" "}
                {workspace.selection.studyDesignId}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-slate-400">Source file</dt>
              <dd className={`${MONO} mt-0.5 break-all text-slate-200`}>
                {workspace.source.fileName ?? "(in-memory document)"}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-slate-400">Working USDM SHA-256</dt>
              <dd className={`${MONO} mt-0.5 break-all text-emerald-300`}>
                {workspace.revision.sha256}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-slate-400">Original import SHA-256</dt>
              <dd className={`${MONO} mt-0.5 break-all text-slate-300`}>
                {workspace.source.sha256}
              </dd>
            </div>
          </dl>

          <div className="min-w-0 space-y-2">
            <h4 className="text-sm font-semibold text-[#f4f4f6]">
              Preserved items ({workspace.preserved.length})
            </h4>
            <p className="text-xs text-slate-400">
              Unselected study versions, unselected designs, and non-studio
              extension attributes are preserved intact and written back
              unchanged on USDM export.
            </p>
            {workspace.preserved.length === 0 ? (
              <p className="rounded border border-white/[0.08] bg-[#0d0e11] px-3 py-2 text-xs text-slate-400">
                No preserved out-of-scope items in this study.
              </p>
            ) : (
              <ul
                data-testid="study-governance-preserved-list"
                className="max-h-48 space-y-1.5 overflow-y-auto rounded border border-white/[0.08] bg-[#0d0e11] p-3 text-xs"
              >
                {workspace.preserved.map((item, idx) => (
                  <li
                    key={`${item.path}-${idx}`}
                    className="flex min-w-0 flex-wrap items-baseline justify-between gap-2 border-b border-white/[0.05] pb-1.5 last:border-b-0 last:pb-0"
                  >
                    <span
                      className={`${MONO} min-w-0 break-all text-slate-200`}
                    >
                      {item.path}
                    </span>
                    <span className="rounded border border-white/[0.12] px-1.5 py-0.5 text-[11px] text-slate-300">
                      {preservedReasonCopy(item.reason)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="min-w-0 space-y-2">
            <h4 className="text-sm font-semibold text-[#f4f4f6]">
              USDM {CLINICAL_STANDARDS_PROFILE.USDM} schema issues (
              {liveSchemaIssues.length})
            </h4>
            {liveSchemaIssues.length === 0 ? (
              <p className="rounded border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
                Working USDM document passes full Wrapper schema validation.
              </p>
            ) : (
              <ul
                data-testid="study-governance-schema-issues"
                className={`max-h-48 space-y-1.5 overflow-y-auto rounded border border-amber-500/35 bg-[#0d0e11] p-3 ${MONO} text-xs text-amber-200`}
              >
                {liveSchemaIssues.map((issue, idx) => (
                  <li key={`${idx}-${issue}`} className="min-w-0 break-words">
                    {issue}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </ModalContainer>

      {/* Blocking Schema Diagnostics Modal on Export USDM */}
      <ModalContainer
        isOpen={exportBlockingIssues !== null}
        onClose={() => setExportBlockingIssues(null)}
        titleId={diagnosticsTitleId}
        ariaDescribedBy={diagnosticsDescId}
        maxWidth="max-w-2xl"
        className="border-amber-500/40 bg-[#13151a] p-5 text-[#f4f4f6]"
      >
        {exportBlockingIssues ? (
          <div className="min-w-0 space-y-4">
            <div className="space-y-1">
              <p
                className={`${MONO} text-[11px] uppercase tracking-[0.16em] text-amber-300`}
              >
                USDM {CLINICAL_STANDARDS_PROFILE.USDM} schema diagnostics
              </p>
              <h3
                id={diagnosticsTitleId}
                className="text-base font-semibold text-[#f4f4f6]"
              >
                Canonical USDM export blocked by {exportBlockingIssues.length}{" "}
                {exportBlockingIssues.length === 1 ? "issue" : "issues"}
              </h3>
            </div>
            <p
              id={diagnosticsDescId}
              className="text-sm leading-relaxed text-slate-300"
            >
              Resolve the schema paths below to export canonical{" "}
              <span className={MONO}>.usdm.json</span>, or export a{" "}
              <span className={MONO}>.study.json</span> workspace snapshot to
              preserve your work in progress.
            </p>
            <ul
              className={`max-h-60 space-y-1.5 overflow-y-auto rounded border border-white/[0.08] bg-[#0d0e11] p-3 ${MONO} text-xs text-amber-200`}
            >
              {exportBlockingIssues.slice(0, 25).map((issue, idx) => (
                <li key={`${idx}-${issue}`} className="min-w-0 break-words">
                  {issue}
                </li>
              ))}
              {exportBlockingIssues.length > 25 ? (
                <li className="text-slate-400">
                  …and {exportBlockingIssues.length - 25} more schema issues.
                </li>
              ) : null}
            </ul>
            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  handleSaveWorkspaceJson();
                  setExportBlockingIssues(null);
                }}
                className={BTN_AMBER}
              >
                Export workspace (.study.json)
              </button>
              <button
                type="button"
                onClick={() => setExportBlockingIssues(null)}
                className={BTN_BASE}
              >
                Close
              </button>
            </div>
          </div>
        ) : null}
      </ModalContainer>

      {/* Local USDM Repository Catalog Modal */}
      <ModalContainer
        isOpen={isCatalogOpen}
        onClose={() => setIsCatalogOpen(false)}
        titleId={catalogTitleId}
        maxWidth="max-w-3xl"
        className="border-white/[0.12] bg-[#13151a] p-5 text-[#f4f4f6]"
      >
        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.08] pb-3">
            <div className="min-w-0 space-y-1">
              <p
                className={`${MONO} text-[11px] uppercase tracking-[0.16em] text-slate-400`}
              >
                Shared browser study catalog ·{" "}
                {snapshot.persistence === "indexeddb"
                  ? "IndexedDB"
                  : "In-memory fallback"}
              </p>
              <h3
                id={catalogTitleId}
                className="text-base font-semibold text-[#f4f4f6]"
              >
                Local USDM v4 studies
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setIsCatalogOpen(false)}
              className={BTN_BASE}
            >
              Close
            </button>
          </div>

          <ul className="max-h-[60vh] space-y-2.5 overflow-y-auto pr-1">
            {snapshot.studies.map((item) => {
              const isCurrent = item.studyId === studyId;
              const isRef = item.kind === "reference";
              return (
                <li
                  key={item.studyId}
                  className={`min-w-0 rounded border p-3 ${
                    isCurrent
                      ? "border-amber-400/50 bg-[#0d0e11]"
                      : "border-white/[0.08] bg-[#0d0e11]/70"
                  }`}
                >
                  <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`${MONO} text-xs font-semibold text-[#f4f4f6]`}
                        >
                          {item.protocolCode}
                        </span>
                        <span
                          className={`rounded border border-white/[0.12] px-1.5 py-0.5 ${MONO} text-[10px] uppercase tracking-[0.12em] text-slate-300`}
                        >
                          {kindBadgeLabel(item.kind)}
                        </span>
                        <span
                          className={`${MONO} text-[11px] text-emerald-300`}
                        >
                          {item.revisionId} · {item.sha256.slice(0, 10)}
                        </span>
                        {isCurrent ? (
                          <span
                            className={`${MONO} text-[11px] text-amber-300`}
                          >
                            Active
                          </span>
                        ) : null}
                      </div>
                      <p className="min-w-0 break-words text-xs text-slate-300">
                        {item.title}
                      </p>
                      <p className={`${MONO} text-[11px] text-slate-400`}>
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
                            onOpenSource(item.studyId);
                            setIsCatalogOpen(false);
                          }}
                          className={BTN_AMBER}
                        >
                          Switch to study
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() =>
                          void handleDeleteFromCatalog(item.studyId)
                        }
                        disabled={isRef && item.revisionId === "R1"}
                        className={BTN_BASE}
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
    </section>
  );
}
