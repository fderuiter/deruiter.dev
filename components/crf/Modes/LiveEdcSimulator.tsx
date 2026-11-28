"use client";

import React, { useMemo, useState } from "react";
import {
  CRFField,
  EDCQuery,
  EdcSimulationActionInput,
  EdcSimulationState,
  EdcUserRole,
  StudyProtocol,
} from "@/lib/crf/types";
import {
  CDISC_NULL_FLAVORS,
  DEFAULT_EDC_SUBJECTS,
  StudyProtocolEngine,
  buildSubjectFieldValues,
  describeFieldConditionalState,
  evaluateDerivedFormValues,
  formatPrecisionDate,
  getEdcRoleActorLabel,
  getEdcRolePermissions,
  getFormSignatureStatus,
  getScheduledFormsForVisit,
  getSubjectFormStatus,
  isCdiscNullFlavor,
  parsePrecisionDate,
  resolveFormConditionalState,
  seedEdcSimulationState,
  validateEdcFormSubmission,
} from "@/lib/crf";
import { NoPhiNotice } from "../NoPhiNotice";
import { EdcClinicalDataExchangePanel } from "./EdcClinicalDataExchangePanel";
import { EdcManualQueryModal } from "./EdcManualQueryModal";
import { EdcUnlockRevocationModal } from "./EdcUnlockRevocationModal";
import { useAnnouncer } from "@/components/providers/A11yProvider";
import {
  IconAlertTriangle,
  IconCheck,
  IconDeviceFloppy,
  IconEyeOff,
  IconFileText,
  IconHistory,
  IconInfoCircle,
  IconLock,
  IconLockOpen,
  IconMessageCircleQuestion,
  IconPlus,
  IconShieldCheck,
  IconTable,
} from "@tabler/icons-react";
import { TooltipButton } from "@/components/ui/Tooltip";

interface LiveEdcSimulatorProps {
  study: StudyProtocol;
  simulationState?: EdcSimulationState;
  onDispatchSimulationAction?: (action: EdcSimulationActionInput) => void;
  onUpdateSimulationState?: (nextState: EdcSimulationState) => void;
}

type EdcSubView = "form_entry" | "subject_matrix" | "audit_trail" | "queries";

export const LiveEdcSimulator: React.FC<LiveEdcSimulatorProps> = ({
  study,
  simulationState,
  onDispatchSimulationAction,
  onUpdateSimulationState,
}) => {
  const { announce } = useAnnouncer();
  const [subView, setSubView] = useState<EdcSubView>("form_entry");
  const [subjectId, setSubjectId] = useState("001-101");
  const [newSubjectInput, setNewSubjectInput] = useState("");
  const [isAddingSubject, setIsAddingSubject] = useState(false);
  const [activeVisitId, setActiveVisitId] = useState<string>(
    study.visits[0]?.id || ""
  );
  const [activeFormId, setActiveFormId] = useState<string>(
    study.forms[0]?.id || ""
  );
  const [currentRole, setCurrentRole] =
    useState<EdcUserRole>("Site Coordinator");

  // Uncontrolled fallback state used only when mounted standalone without a parent reducer dispatcher
  const [uncontrolledEntry, setUncontrolledEntry] = useState<{
    study: StudyProtocol;
    state: EdcSimulationState;
  } | null>(null);

  const activeUncontrolledState =
    !onDispatchSimulationAction &&
    simulationState === undefined &&
    study.simulationState === undefined &&
    uncontrolledEntry?.study === study
      ? uncontrolledEntry.state
      : undefined;

  const rawSimState =
    simulationState ?? study.simulationState ?? activeUncontrolledState;

  const resolvedSimState = useMemo(
    () => seedEdcSimulationState(study, rawSimState),
    [study, rawSimState]
  );

  const dispatchAction = (action: EdcSimulationActionInput) => {
    if (onDispatchSimulationAction) {
      onDispatchSimulationAction(action);
      return;
    }
    const nextStudy = StudyProtocolEngine.dispatchSimulationAction(
      { ...study, simulationState: rawSimState },
      action
    );
    const nextState =
      nextStudy.simulationState ?? seedEdcSimulationState(study, rawSimState);
    setUncontrolledEntry({ study, state: nextState });
    onUpdateSimulationState?.(nextState);
  };

  const availableSubjects = useMemo(
    () => resolvedSimState.availableSubjects || [...DEFAULT_EDC_SUBJECTS],
    [resolvedSimState.availableSubjects]
  );

  const effectiveSubjectId = availableSubjects.includes(subjectId)
    ? subjectId
    : availableSubjects[0] || "001-101";

  const effectiveVisit = useMemo(
    () => study.visits.find((v) => v.id === activeVisitId) || study.visits[0],
    [study.visits, activeVisitId]
  );
  const effectiveVisitId = effectiveVisit?.id || "";

  const scheduledForms = useMemo(
    () => getScheduledFormsForVisit(study, effectiveVisitId),
    [study, effectiveVisitId]
  );

  const activeForm = useMemo(
    () =>
      scheduledForms.find((f) => f.id === activeFormId) || scheduledForms[0],
    [scheduledForms, activeFormId]
  );
  const effectiveFormId = activeForm?.id || "";

  const effectiveFormValues = useMemo(
    () =>
      evaluateDerivedFormValues(
        activeForm,
        effectiveSubjectId,
        effectiveVisitId,
        resolvedSimState.formValues || {}
      ),
    [
      activeForm,
      effectiveSubjectId,
      effectiveVisitId,
      resolvedSimState.formValues,
    ]
  );

  const sdvMap = useMemo(
    () => resolvedSimState.sdvMap || {},
    [resolvedSimState.sdvMap]
  );
  const queries = useMemo(
    () => resolvedSimState.queries || [],
    [resolvedSimState.queries]
  );
  const auditLog = useMemo(
    () => resolvedSimState.auditLog || [],
    [resolvedSimState.auditLog]
  );

  const signatureStatus = useMemo(
    () =>
      getFormSignatureStatus(
        resolvedSimState,
        effectiveSubjectId,
        effectiveVisitId,
        effectiveFormId
      ),
    [resolvedSimState, effectiveSubjectId, effectiveVisitId, effectiveFormId]
  );

  const rolePermissions = useMemo(
    () =>
      getEdcRolePermissions(currentRole, {
        isLocked: signatureStatus.isLocked,
      }),
    [currentRole, signatureStatus.isLocked]
  );

  const currentSimSnapshot = useMemo<EdcSimulationState>(
    () => ({
      ...resolvedSimState,
      availableSubjects,
      formValues: effectiveFormValues,
    }),
    [resolvedSimState, availableSubjects, effectiveFormValues]
  );

  // Reason For Change Modal State
  const [pendingChange, setPendingChange] = useState<{
    field: CRFField;
    oldVal: string | number | boolean | null;
    newVal: string | number | boolean | null;
  } | null>(null);
  const [changeReasonInput, setChangeReasonInput] = useState(
    "Transcription correction against source chart"
  );

  // PI Unlock & Signature Revocation Modal State
  const [isUnlockModalOpen, setIsUnlockModalOpen] = useState(false);

  // Query Response Modal State
  const [activeQueryToAnswer, setActiveQueryToAnswer] =
    useState<EDCQuery | null>(null);
  const [queryResponseText, setQueryResponseText] = useState("");
  const [queryResolutionNotes, setQueryResolutionNotes] = useState<
    Record<string, string>
  >({});

  // Manual Query Modal State
  const [isManualQueryModalOpen, setIsManualQueryModalOpen] = useState(false);

  // 3-Tier Missing Data & Validation State
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});
  const [saveStatus, setSaveStatus] = useState<{
    type: "success" | "error";
    message: string;
    hardStops?: string[];
    autoQueries?: string[];
  } | null>(null);

  const clearTransientValidation = () => {
    setValidationErrors({});
    setSaveStatus(null);
  };

  const openManualQueryModal = () => {
    setIsManualQueryModalOpen(true);
  };

  const handleRaiseManualQuery = (submission: {
    subjectId: string;
    visitId: string;
    formId: string;
    fieldId: string;
    fieldName: string;
    severity: EDCQuery["severity"];
    message: string;
  }) => {
    dispatchAction({
      type: "RAISE_QUERY",
      input: {
        subjectId: submission.subjectId,
        visitId: submission.visitId,
        formId: submission.formId,
        fieldId: submission.fieldId,
        fieldName: submission.fieldName,
        severity: submission.severity,
        message: submission.message,
        actor: getEdcRoleActorLabel(currentRole),
        userRole: currentRole,
      },
    });
    setIsManualQueryModalOpen(false);
    setSubView("queries");
    announce("Manual discrepancy query raised.", "polite");
  };

  const handleSubmitQueryAnswer = () => {
    if (!activeQueryToAnswer || !queryResponseText.trim()) return;
    dispatchAction({
      type: "ANSWER_QUERY",
      input: {
        queryId: activeQueryToAnswer.id,
        response: queryResponseText,
        actor: getEdcRoleActorLabel(currentRole),
        userRole: currentRole,
      },
    });
    setActiveQueryToAnswer(null);
    setQueryResponseText("");
    announce("Discrepancy query response recorded.", "polite");
  };

  const handleCloseQuery = (queryId: string) => {
    const note = queryResolutionNotes[queryId];
    dispatchAction({
      type: "CLOSE_QUERY",
      input: {
        queryId,
        actor: getEdcRoleActorLabel(currentRole),
        userRole: currentRole,
        resolutionReason: note,
      },
    });
    setQueryResolutionNotes((prev) => {
      const copy = { ...prev };
      delete copy[queryId];
      return copy;
    });
    announce("Discrepancy query closed.", "polite");
  };

  const handleCancelQuery = (queryId: string) => {
    const note = queryResolutionNotes[queryId];
    dispatchAction({
      type: "CANCEL_QUERY",
      input: {
        queryId,
        actor: getEdcRoleActorLabel(currentRole),
        userRole: currentRole,
        resolutionReason: note,
      },
    });
    setQueryResolutionNotes((prev) => {
      const copy = { ...prev };
      delete copy[queryId];
      return copy;
    });
    announce("Discrepancy query cancelled.", "polite");
  };

  const handleReopenQuery = (queryId: string) => {
    const note = queryResolutionNotes[queryId];
    dispatchAction({
      type: "REOPEN_QUERY",
      input: {
        queryId,
        actor: getEdcRoleActorLabel(currentRole),
        userRole: currentRole,
        reason: note,
      },
    });
    setQueryResolutionNotes((prev) => {
      const copy = { ...prev };
      delete copy[queryId];
      return copy;
    });
    announce("Discrepancy query reopened.", "polite");
  };

  const handleApplyImportedSimulationState = (
    importedSim: EdcSimulationState,
    source: "odm" | "csv"
  ) => {
    const mergedState: EdcSimulationState = {
      availableSubjects:
        importedSim.availableSubjects ?? resolvedSimState.availableSubjects,
      formValues: importedSim.formValues ?? resolvedSimState.formValues,
      sdvMap: importedSim.sdvMap ?? resolvedSimState.sdvMap,
      lockedForms: importedSim.lockedForms ?? resolvedSimState.lockedForms,
      queries: importedSim.queries ?? resolvedSimState.queries,
      auditLog: importedSim.auditLog ?? resolvedSimState.auditLog,
      signatures: importedSim.signatures ?? resolvedSimState.signatures,
    };

    dispatchAction({
      type: "REPLACE_SIMULATION_STATE",
      simulationState: mergedState,
    });

    if (
      source === "odm" &&
      importedSim.availableSubjects &&
      importedSim.availableSubjects.length > 0 &&
      !importedSim.availableSubjects.includes(effectiveSubjectId)
    ) {
      setSubjectId(importedSim.availableSubjects[0]);
    }
  };

  // Values for the active subject, keyed by both field id and variable name,
  // plus cross-visit keys. Shared by formula evaluation, edit checks and the
  // conditional visibility runtime so all three see identical inputs.
  const subjectVals = useMemo(
    () =>
      buildSubjectFieldValues(
        activeForm,
        effectiveSubjectId,
        effectiveVisitId,
        effectiveFormValues
      ),
    [activeForm, effectiveSubjectId, effectiveVisitId, effectiveFormValues]
  );

  /**
   * Conditional show/hide/require state (#670). One resolution per render
   * feeds both the rendered controls and the save-time validator, so the two
   * can never disagree about whether a field is on screen or mandatory.
   */
  const conditionalState = useMemo(() => {
    if (!activeForm) return null;
    return resolveFormConditionalState(
      activeForm.sections.flatMap((s) => s.fields),
      activeForm.rules || [],
      subjectVals,
      effectiveVisitId
    );
  }, [activeForm, subjectVals, effectiveVisitId]);

  const applyValueChange = (
    field: CRFField,
    _oldVal: string | number | boolean | null,
    newVal: string | number | boolean | null,
    reason: string
  ) => {
    if (!activeForm || !rolePermissions.canEditActiveForm) return;
    dispatchAction({
      type: "UPDATE_FIELD_VALUE",
      subjectId: effectiveSubjectId,
      visitId: effectiveVisitId,
      formId: activeForm.id,
      fieldId: field.id,
      value: newVal,
      role: currentRole,
      reasonForChange: reason,
    });
    setPendingChange(null);
  };

  const handleFieldChange = (
    field: CRFField,
    rawValue: string | number | boolean | null
  ) => {
    if (!rolePermissions.canEditActiveForm) {
      return;
    }

    const key = `${effectiveSubjectId}_${effectiveVisitId}_${field.id}`;
    const previousVal = effectiveFormValues[key] ?? null;
    if (previousVal === rawValue) return;

    // Prompt for 21 CFR Part 11 Reason for Change if modifying existing non-empty value
    if (previousVal !== null && previousVal !== "") {
      setPendingChange({
        field,
        oldVal: previousVal,
        newVal: rawValue,
      });
      return;
    }

    applyValueChange(field, previousVal, rawValue, "Initial Entry");
  };

  const handleToggleSdv = (fieldId: string, fieldName: string) => {
    if (!activeForm || !rolePermissions.canToggleSdv) return;
    dispatchAction({
      type: "TOGGLE_SDV",
      subjectId: effectiveSubjectId,
      visitId: effectiveVisitId,
      formId: activeForm.id,
      fieldId,
      fieldName,
      role: currentRole,
    });
  };

  const handleLockForm = () => {
    if (!activeForm || !rolePermissions.canLockAndSign) return;
    dispatchAction({
      type: "LOCK_FORM",
      subjectId: effectiveSubjectId,
      visitId: effectiveVisitId,
      formId: activeForm.id,
      role: currentRole,
    });
    announce("Form locked and signed by Principal Investigator.", "polite");
  };

  const handleConfirmUnlockForm = (reasonForChange: string) => {
    if (!activeForm || !rolePermissions.canUnlockForm) return;
    dispatchAction({
      type: "UNLOCK_FORM",
      subjectId: effectiveSubjectId,
      visitId: effectiveVisitId,
      formId: activeForm.id,
      role: currentRole,
      reasonForChange,
    });
    setIsUnlockModalOpen(false);
    announce("Data Lock signature revoked and form unlocked.", "polite");
  };

  // 3-Tier Missing Data & Date Validation Engine (Save / Complete Form)
  const handleSaveForm = () => {
    if (!activeForm) return;

    const saveTimestamp = new Date().toISOString();
    const validation = validateEdcFormSubmission(
      study,
      activeForm,
      effectiveSubjectId,
      effectiveVisitId,
      effectiveFormValues,
      saveTimestamp
    );

    setValidationErrors(validation.errors);

    dispatchAction({
      type: "SAVE_FORM",
      subjectId: effectiveSubjectId,
      visitId: effectiveVisitId,
      formId: activeForm.id,
      role: currentRole,
      timestamp: saveTimestamp,
    });

    if (!validation.isValid) {
      const errMsg = `Form submission blocked! ${validation.hardStops.length} field(s) failed hard-stop validation.`;
      setSaveStatus({
        type: "error",
        message: errMsg,
        hardStops: validation.hardStops,
      });
      announce(errMsg, "assertive");
      return;
    }

    const visitDisplayName = effectiveVisit?.name || effectiveVisitId;
    const successMsg = `Form saved successfully for Subject ${effectiveSubjectId} at ${visitDisplayName}.${
      validation.autoQueries.length > 0
        ? ` Registered ${validation.autoQueries.length} auto-query ticket(s).`
        : ""
    }`;
    setSaveStatus({
      type: "success",
      message: successMsg,
      autoQueries: validation.autoQueries,
    });
    announce(successMsg, "polite");
  };

  const activeFormQueries = queries.filter(
    (q) =>
      q.subjectId === effectiveSubjectId &&
      q.formId === effectiveFormId &&
      q.visitId === effectiveVisitId
  );

  const activeSignature =
    signatureStatus.activeDataLockSignature || signatureStatus.signatures[0];
  const visitDisplayLabel = effectiveVisit
    ? effectiveVisit.name.includes("(Day")
      ? effectiveVisit.name
      : `${effectiveVisit.name} (Day ${effectiveVisit.targetDay})`
    : effectiveVisitId;

  return (
    <div className="flex-1 flex flex-col h-full studio-surface-subtle p-4 sm:p-6 overflow-y-auto space-y-6">
      {/* Top Banner & Multi-Role Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 sm:pb-6 border-b studio-border-default">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg studio-accent-emerald border shrink-0">
              <IconShieldCheck className="w-5 h-5" />
            </span>
            <h2 className="text-base sm:text-lg font-bold studio-fg-primary font-mono truncate">
              Live EDC data entry
            </h2>
          </div>
          <p className="text-xs studio-fg-muted font-sans mt-1">
            Try a Part 11-style workflow: subject data entry, CRA source data
            verification (SDV), investigator locking and the longitudinal visit
            matrix.
          </p>
          <NoPhiNotice className="mt-2" />
        </div>

        {/* User Role Switcher */}
        <div className="flex items-center gap-1.5 studio-surface-card border studio-border-default p-1 rounded-xl shadow-inner max-w-full overflow-x-auto scrollbar-none">
          <span className="text-[10px] font-mono studio-fg-muted uppercase px-1.5 hidden sm:inline">
            Active Role:
          </span>
          {(
            [
              "Site Coordinator",
              "Principal Investigator",
              "CRA Monitor",
              "Data Manager",
            ] as EdcUserRole[]
          ).map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => setCurrentRole(role)}
              className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-mono whitespace-nowrap transition-all ${
                currentRole === role
                  ? "studio-btn-cyan font-bold shadow-sm"
                  : "studio-fg-muted studio-hover-fg-primary"
              }`}
            >
              {role}
            </button>
          ))}
        </div>
      </div>

      {/* Sub-View Navigation Tabs */}
      <div className="flex flex-wrap shrink-0 items-center justify-between gap-2 border-b studio-border-default pb-2">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setSubView("form_entry")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono whitespace-nowrap transition-all ${
              subView === "form_entry"
                ? "studio-btn-cyan font-bold"
                : "studio-surface-card studio-fg-muted studio-hover-fg-primary"
            }`}
          >
            <IconFileText className="w-4 h-4" />
            <span>Patient Form Entry</span>
          </button>
          <button
            type="button"
            onClick={() => setSubView("subject_matrix")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono whitespace-nowrap transition-all ${
              subView === "subject_matrix"
                ? "studio-btn-cyan font-bold"
                : "studio-surface-card studio-fg-muted studio-hover-fg-primary"
            }`}
          >
            <IconTable className="w-4 h-4" />
            <span>Subject Status Matrix</span>
          </button>
          <button
            type="button"
            onClick={() => setSubView("queries")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono whitespace-nowrap transition-all ${
              subView === "queries"
                ? "studio-btn-cyan font-bold"
                : "studio-surface-card studio-fg-muted studio-hover-fg-primary"
            }`}
          >
            <IconMessageCircleQuestion className="w-4 h-4" />
            <span>
              Discrepancy Queries (
              {queries.filter((q) => q.status === "Open").length})
            </span>
          </button>
          <button
            type="button"
            onClick={() => setSubView("audit_trail")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono whitespace-nowrap transition-all ${
              subView === "audit_trail"
                ? "studio-btn-cyan font-bold"
                : "studio-surface-card studio-fg-muted studio-hover-fg-primary"
            }`}
          >
            <IconHistory className="w-4 h-4" />
            <span>Part 11 Audit Trail ({auditLog.length})</span>
          </button>
        </div>

        {rolePermissions.canManageQueries && (
          <button
            type="button"
            onClick={openManualQueryModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold studio-accent-cyan border studio-hover-cyan transition-all shrink-0"
          >
            <IconPlus className="w-3.5 h-3.5" />
            <span>Raise Manual Query</span>
          </button>
        )}
      </div>

      {/* Main Two-Column EDC Workspace + Clinical Data Exchange */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-8 min-w-0 space-y-6">
          {/* VIEW 1: PATIENT FORM ENTRY */}
          {subView === "form_entry" && activeForm && (
            <div className="space-y-6">
              {/* Protocol Navigation Context: Subject, Visit, Form */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl studio-surface-subtle border studio-border-default">
                {/* Subject ID Selector */}
                <div>
                  <label
                    htmlFor="edc-active-subject-select"
                    className="block text-[10px] font-mono studio-fg-muted mb-1"
                  >
                    Active Subject / Patient ID
                  </label>
                  {isAddingSubject ? (
                    <div className="flex gap-2">
                      <input
                        id="edc-active-subject-select"
                        type="text"
                        value={newSubjectInput}
                        onChange={(e) => setNewSubjectInput(e.target.value)}
                        placeholder="e.g. 001-104"
                        className="w-full px-2.5 py-1 studio-surface-subtle border studio-border-strong rounded-lg text-xs studio-fg-primary font-mono"
                      />
                      <button
                        type="button"
                        aria-label="Confirm new subject"
                        onClick={() => {
                          const trimmed = newSubjectInput.trim();
                          if (trimmed) {
                            dispatchAction({
                              type: "ENROLL_SUBJECT",
                              subjectId: trimmed,
                            });
                            setSubjectId(trimmed);
                            setIsAddingSubject(false);
                            setNewSubjectInput("");
                            clearTransientValidation();
                          }
                        }}
                        className="p-1 rounded studio-btn-cyan"
                      >
                        <IconCheck className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <select
                        id="edc-active-subject-select"
                        value={effectiveSubjectId}
                        onChange={(e) => {
                          setSubjectId(e.target.value);
                          clearTransientValidation();
                        }}
                        className="flex-1 px-3 py-1.5 studio-surface-subtle border studio-border-strong rounded-xl text-xs studio-fg-primary font-mono studio-focus-input focus:outline-none"
                      >
                        {availableSubjects.map((s) => (
                          <option key={s} value={s}>
                            Subject: {s}
                          </option>
                        ))}
                      </select>
                      <TooltipButton
                        onClick={() => setIsAddingSubject(true)}
                        className="px-2.5 py-1 rounded-xl studio-surface-muted studio-hover-active studio-fg-primary text-xs font-mono"
                        tooltip="Enroll New Simulated Subject"
                        aria-label="Enroll New Simulated Subject"
                      >
                        <IconPlus className="w-3.5 h-3.5" />
                      </TooltipButton>
                    </div>
                  )}
                </div>

                {/* Visit Selector */}
                <div>
                  <label
                    htmlFor="edc-protocol-visit-select"
                    className="block text-[10px] font-mono studio-fg-muted mb-1"
                  >
                    Protocol Visit
                  </label>
                  <select
                    id="edc-protocol-visit-select"
                    value={effectiveVisitId}
                    onChange={(e) => {
                      setActiveVisitId(e.target.value);
                      clearTransientValidation();
                    }}
                    className="w-full px-3 py-1.5 studio-surface-subtle border studio-border-strong rounded-xl text-xs studio-fg-primary font-mono studio-focus-input focus:outline-none"
                  >
                    {study.visits.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} (Day {v.targetDay})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Form Selector (Scheduled forms + continuous AE / CM log forms) */}
                <div>
                  <label
                    htmlFor="edc-crf-form-select"
                    className="block text-[10px] font-mono studio-fg-muted mb-1"
                  >
                    CRF Form
                  </label>
                  <select
                    id="edc-crf-form-select"
                    value={effectiveFormId}
                    onChange={(e) => {
                      setActiveFormId(e.target.value);
                      clearTransientValidation();
                    }}
                    className="w-full px-3 py-1.5 studio-surface-subtle border studio-border-strong rounded-xl text-xs studio-fg-primary font-mono studio-focus-input focus:outline-none"
                  >
                    {scheduledForms.map((f) => (
                      <option key={f.id} value={f.id}>
                        [{f.domain}] {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Form Header Card with PI Lock, Unlock Revocation, and Inline Role/Signature Banner */}
              <div className="p-5 rounded-2xl studio-surface-subtle border studio-border-default space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b studio-border-default pb-4">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-xs font-mono font-bold studio-accent-cyan-strong border">
                        {activeForm.domain}
                      </span>
                      <h2 className="text-base font-bold studio-fg-primary font-mono">
                        {activeForm.name}
                      </h2>
                      {signatureStatus.isLocked && (
                        <span className="inline-flex items-center gap-1 font-mono text-[10px] studio-accent-sky px-2 py-0.5 rounded border">
                          <IconLock className="w-3 h-3" />
                          <span>Locked (PI)</span>
                        </span>
                      )}
                    </div>
                    <p className="text-xs studio-fg-muted font-sans">
                      {activeForm.description}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <TooltipButton
                      onClick={handleSaveForm}
                      disabled={signatureStatus.isLocked}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-xs font-bold studio-btn-cyan transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      tooltip="Save Form Data and run 3-Tier Missing Data Engine"
                    >
                      <IconDeviceFloppy className="w-4 h-4" />
                      <span>Save Form</span>
                    </TooltipButton>

                    {currentRole === "Principal Investigator" &&
                      (signatureStatus.isLocked ? (
                        <button
                          type="button"
                          onClick={() => setIsUnlockModalOpen(true)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition-all shadow-sm studio-surface-muted studio-hover-active studio-fg-primary border studio-border-strong"
                        >
                          <IconLockOpen className="w-4 h-4" />
                          <span>Unlock Form</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleLockForm}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition-all shadow-sm studio-btn-sky"
                        >
                          <IconLock className="w-4 h-4" />
                          <span>Lock &amp; Sign (PI)</span>
                        </button>
                      ))}

                    {signatureStatus.isSigned && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl studio-accent-emerald border font-mono text-xs">
                        <IconShieldCheck className="w-4 h-4" />
                        <span>Signed</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Inline Role Permission & Electronic Signature Status Banner */}
                {(rolePermissions.readOnlyBanner ||
                  signatureStatus.isSigned) && (
                  <div
                    data-testid="edc-role-signature-banner"
                    className={`p-3 rounded-xl border flex flex-col gap-2 text-xs ${
                      signatureStatus.isLocked
                        ? "studio-accent-sky"
                        : signatureStatus.isSigned
                          ? "studio-accent-emerald"
                          : "studio-surface-card studio-border-default"
                    }`}
                  >
                    {activeSignature && (
                      <div className="flex flex-wrap items-center justify-between gap-2 font-mono">
                        <div className="flex items-center gap-2 min-w-0">
                          <IconShieldCheck className="w-4 h-4 studio-fg-emerald shrink-0" />
                          <span className="font-bold studio-fg-primary">
                            Electronic Signature ({activeSignature.meaning}):
                          </span>
                          <span className="studio-fg-secondary truncate">
                            {activeSignature.signedBy}
                          </span>
                        </div>
                        <span className="text-[11px] studio-fg-muted">
                          Token:{" "}
                          <strong className="studio-fg-cyan">
                            {activeSignature.digest}
                          </strong>
                        </span>
                      </div>
                    )}
                    {rolePermissions.readOnlyBanner && (
                      <div className="flex items-start gap-2 font-sans studio-fg-secondary">
                        <IconInfoCircle className="w-4 h-4 studio-fg-cyan shrink-0 mt-0.5" />
                        <span>{rolePermissions.readOnlyBanner}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Save Status Notification Banner */}
                {saveStatus && (
                  <div
                    className={`p-3 rounded-xl border flex items-start gap-2.5 font-mono text-xs ${
                      saveStatus.type === "error"
                        ? "studio-accent-red"
                        : "studio-accent-emerald"
                    }`}
                  >
                    {saveStatus.type === "error" ? (
                      <IconAlertTriangle className="w-4 h-4 studio-fg-red shrink-0 mt-0.5" />
                    ) : (
                      <IconCheck className="w-4 h-4 studio-fg-emerald shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 space-y-1">
                      <div className="font-bold">{saveStatus.message}</div>
                      {saveStatus.hardStops &&
                        saveStatus.hardStops.length > 0 && (
                          <div className="text-[11px] studio-fg-red font-sans">
                            Hard-stop blocked fields:{" "}
                            {saveStatus.hardStops.join(", ")}
                          </div>
                        )}
                      {saveStatus.autoQueries &&
                        saveStatus.autoQueries.length > 0 && (
                          <div className="text-[11px] studio-fg-amber font-sans">
                            Auto-generated open queries raised for:{" "}
                            {saveStatus.autoQueries.join(", ")}
                          </div>
                        )}
                    </div>
                  </div>
                )}

                {/* Form Fields Rendering */}
                {activeForm.sections.map((section) => (
                  <div key={section.id} className="space-y-3">
                    <h3 className="text-xs font-bold studio-fg-secondary font-mono border-b studio-border-subtle pb-1.5">
                      {section.title}
                    </h3>

                    <div className="grid grid-cols-12 gap-3 sm:gap-4">
                      {section.fields.map((field) => {
                        // Conditional visibility (#670): a hidden field is not
                        // rendered at all, so it is absent from the accessibility
                        // tree and the tab order rather than merely dimmed.
                        const fieldState = conditionalState?.fields[field.id];
                        if (fieldState && !fieldState.visible) return null;

                        const isFieldRequired =
                          fieldState?.required ?? field.required;
                        const conditionalExplanation = fieldState
                          ? describeFieldConditionalState(fieldState)
                          : null;

                        const key = `${effectiveSubjectId}_${effectiveVisitId}_${field.id}`;
                        const currentVal = effectiveFormValues[key];
                        const isSdv = sdvMap[key]?.verified || false;
                        const fieldQueries = activeFormQueries.filter(
                          (q) => q.fieldId === field.id && q.status === "Open"
                        );
                        const fieldError = validationErrors[field.id];
                        const allowsNullFlavor = Boolean(field.allowNullFlavor);
                        const hasNullFlavor = isCdiscNullFlavor(currentVal);
                        const isFieldReadOnly =
                          !rolePermissions.canEditActiveForm;
                        const isBlindedForUser =
                          field.isBlinded &&
                          currentRole !== "Principal Investigator";

                        const parsedPrecision =
                          field.dataType === "precision_date"
                            ? parsePrecisionDate(String(currentVal || ""))
                            : null;

                        const formDomain = activeForm.domain || activeForm.id;
                        const fieldKey = field.variableName || field.id;
                        const inputId = `ecrf-input-${formDomain.toLowerCase()}-${fieldKey.toLowerCase()}`;
                        const errorId = `ecrf-error-${formDomain.toLowerCase()}-${fieldKey.toLowerCase()}`;

                        return (
                          <div
                            key={field.id}
                            className={`p-3 rounded-xl border transition-all ${
                              fieldError
                                ? "studio-bg-red studio-border-red ring-1 ring-red-500/30"
                                : fieldQueries.length > 0
                                  ? "studio-bg-amber studio-border-amber ring-1 ring-amber-500/20"
                                  : "studio-surface-subtle studio-border-default"
                            }`}
                            style={{ gridColumn: `span ${field.columnSpan}` }}
                          >
                            {/* Field Header */}
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div>
                                <label
                                  htmlFor={inputId}
                                  className="block text-xs font-semibold studio-fg-primary cursor-pointer"
                                >
                                  {field.label}
                                  {isFieldRequired && (
                                    <span
                                      className="studio-fg-red ml-0.5"
                                      title={
                                        fieldState?.requirednessSource
                                          ? `Required by rule: ${fieldState.requirednessSource.ruleName}`
                                          : undefined
                                      }
                                    >
                                      *
                                    </span>
                                  )}
                                </label>
                                {conditionalExplanation && (
                                  <span className="sr-only">
                                    {conditionalExplanation}
                                  </span>
                                )}
                                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                  <span className="text-[10px] font-mono studio-fg-muted">
                                    {field.variableName}
                                  </span>

                                  {/* Requirement Tier Badge */}
                                  <span
                                    className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold border ${
                                      field.requirementTier === "auto_query"
                                        ? "studio-accent-amber"
                                        : field.requirementTier ===
                                              "hard_stop" ||
                                            (!field.requirementTier &&
                                              isFieldRequired)
                                          ? "studio-accent-red"
                                          : "studio-surface-card studio-fg-muted studio-border-default"
                                    }`}
                                  >
                                    {field.requirementTier === "auto_query"
                                      ? "? Auto-Query"
                                      : field.requirementTier === "hard_stop" ||
                                          (!field.requirementTier &&
                                            isFieldRequired)
                                        ? "* Hard Stop"
                                        : "Opt"}
                                  </span>

                                  {field.requiresSdv && (
                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-mono studio-accent-emerald border">
                                      <IconShieldCheck className="w-3 h-3" />
                                      <span>SDV</span>
                                    </span>
                                  )}

                                  {field.isBlinded && (
                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-mono studio-accent-indigo border">
                                      <span>Blinded</span>
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                {/* CRA SDV Toggle */}
                                {currentRole === "CRA Monitor" && (
                                  <TooltipButton
                                    disabled={!rolePermissions.canToggleSdv}
                                    onClick={() =>
                                      handleToggleSdv(
                                        field.id,
                                        field.variableName
                                      )
                                    }
                                    className={`px-1.5 py-0.5 rounded text-[9px] font-mono transition-colors border disabled:opacity-50 ${
                                      isSdv
                                        ? "studio-accent-emerald-strong"
                                        : "studio-surface-card studio-fg-muted studio-border-default studio-hover-fg-primary"
                                    }`}
                                    tooltip="Source Data Verification"
                                  >
                                    {isSdv ? "✓ SDV Done" : "SDV Verify"}
                                  </TooltipButton>
                                )}

                                {/* CDISC Null Flavor Toggle Pills (only when field.allowNullFlavor === true) */}
                                {allowsNullFlavor &&
                                  field.dataType !== "calculated" && (
                                    <div className="flex items-center gap-0.5 studio-surface-card p-0.5 rounded-lg border studio-border-default">
                                      {(["ND", "NA", "UNK"] as const).map(
                                        (nf) => {
                                          const isSelectedNf =
                                            currentVal === nf;
                                          return (
                                            <TooltipButton
                                              key={nf}
                                              type="button"
                                              onClick={() => {
                                                if (isSelectedNf) {
                                                  handleFieldChange(
                                                    field,
                                                    null
                                                  );
                                                } else {
                                                  handleFieldChange(field, nf);
                                                }
                                              }}
                                              disabled={isFieldReadOnly}
                                              className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold transition-all border disabled:opacity-50 ${
                                                isSelectedNf
                                                  ? "studio-btn-cyan font-extrabold"
                                                  : "studio-surface-subtle studio-fg-muted studio-border-default studio-hover-fg-primary"
                                              }`}
                                              tooltip={`Set Null Flavor: ${CDISC_NULL_FLAVORS[nf]} (${nf})`}
                                            >
                                              {nf}
                                            </TooltipButton>
                                          );
                                        }
                                      )}
                                    </div>
                                  )}
                              </div>
                            </div>

                            {/* Field Input Area */}
                            {isBlindedForUser ? (
                              <div className="p-2.5 studio-surface-card border studio-border-default rounded-lg studio-fg-muted font-mono text-xs flex items-center gap-2">
                                <IconEyeOff className="w-4 h-4 studio-fg-indigo shrink-0" />
                                <span>
                                  [MASKED PROTOCOL DATA: BLINDED TO SPONSOR]
                                </span>
                              </div>
                            ) : allowsNullFlavor && hasNullFlavor ? (
                              <div className="p-2 studio-surface-card border studio-border-cyan rounded-lg studio-fg-cyan font-mono text-xs flex items-center justify-between">
                                <span className="font-bold">
                                  Null Flavor: {currentVal} (
                                  {
                                    CDISC_NULL_FLAVORS[
                                      currentVal as keyof typeof CDISC_NULL_FLAVORS
                                    ]
                                  }
                                  )
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleFieldChange(field, null)}
                                  disabled={isFieldReadOnly}
                                  className="text-[10px] studio-fg-muted studio-hover-fg-primary underline font-mono disabled:opacity-50"
                                >
                                  Clear Null Flavor
                                </button>
                              </div>
                            ) : (
                              <>
                                {/* Precision Date Input */}
                                {field.dataType === "precision_date" && (
                                  <div className="space-y-1.5">
                                    <div className="grid grid-cols-3 gap-2">
                                      {/* Day Selector */}
                                      <div>
                                        <label
                                          htmlFor={`${inputId}-day`}
                                          className="block text-[9px] font-mono studio-fg-muted mb-0.5"
                                        >
                                          Day
                                        </label>
                                        <select
                                          id={`${inputId}-day`}
                                          aria-invalid={
                                            fieldError ? "true" : undefined
                                          }
                                          aria-describedby={
                                            fieldError ? errorId : undefined
                                          }
                                          value={
                                            parsedPrecision?.day !== null &&
                                            parsedPrecision?.day !== undefined
                                              ? String(
                                                  parsedPrecision.day
                                                ).padStart(2, "0")
                                              : parsedPrecision?.isPartial &&
                                                  parsedPrecision?.day === null
                                                ? "UNK"
                                                : ""
                                          }
                                          onChange={(e) => {
                                            const dVal = e.target.value;
                                            const yVal =
                                              parsedPrecision?.year || 2026;
                                            const mVal =
                                              parsedPrecision?.month !== null &&
                                              parsedPrecision?.month !==
                                                undefined
                                                ? parsedPrecision.month
                                                : field.allowPartial
                                                  ? "UNK"
                                                  : 1;
                                            const newIso = formatPrecisionDate(
                                              yVal,
                                              mVal,
                                              dVal || null
                                            );
                                            handleFieldChange(field, newIso);
                                          }}
                                          disabled={isFieldReadOnly}
                                          className="w-full px-2 py-1 text-xs studio-surface-card border studio-border-strong rounded studio-fg-primary font-mono studio-focus-input focus:outline-none disabled:opacity-50"
                                        >
                                          <option value="">-- Day --</option>
                                          {field.allowPartial && (
                                            <option value="UNK">
                                              UNK (Unknown)
                                            </option>
                                          )}
                                          {Array.from({ length: 31 }, (_, i) =>
                                            String(i + 1).padStart(2, "0")
                                          ).map((d) => (
                                            <option key={d} value={d}>
                                              {d}
                                            </option>
                                          ))}
                                        </select>
                                      </div>

                                      {/* Month Selector */}
                                      <div>
                                        <label
                                          htmlFor={`${inputId}-month`}
                                          className="block text-[9px] font-mono studio-fg-muted mb-0.5"
                                        >
                                          Month
                                        </label>
                                        <select
                                          id={`${inputId}-month`}
                                          aria-invalid={
                                            fieldError ? "true" : undefined
                                          }
                                          aria-describedby={
                                            fieldError ? errorId : undefined
                                          }
                                          value={
                                            parsedPrecision?.month !== null &&
                                            parsedPrecision?.month !== undefined
                                              ? String(
                                                  parsedPrecision.month
                                                ).padStart(2, "0")
                                              : parsedPrecision?.isPartial &&
                                                  parsedPrecision?.month ===
                                                    null
                                                ? "UNK"
                                                : ""
                                          }
                                          onChange={(e) => {
                                            const mVal = e.target.value;
                                            const yVal =
                                              parsedPrecision?.year || 2026;
                                            const dVal =
                                              parsedPrecision?.day !== null &&
                                              parsedPrecision?.day !== undefined
                                                ? parsedPrecision.day
                                                : field.allowPartial
                                                  ? "UNK"
                                                  : null;
                                            const newIso = formatPrecisionDate(
                                              yVal,
                                              mVal || null,
                                              dVal
                                            );
                                            handleFieldChange(field, newIso);
                                          }}
                                          disabled={isFieldReadOnly}
                                          className="w-full px-2 py-1 text-xs studio-surface-card border studio-border-strong rounded studio-fg-primary font-mono studio-focus-input focus:outline-none disabled:opacity-50"
                                        >
                                          <option value="">-- Month --</option>
                                          {field.allowPartial && (
                                            <option value="UNK">
                                              UNK (Unknown)
                                            </option>
                                          )}
                                          {[
                                            "01 (Jan)",
                                            "02 (Feb)",
                                            "03 (Mar)",
                                            "04 (Apr)",
                                            "05 (May)",
                                            "06 (Jun)",
                                            "07 (Jul)",
                                            "08 (Aug)",
                                            "09 (Sep)",
                                            "10 (Oct)",
                                            "11 (Nov)",
                                            "12 (Dec)",
                                          ].map((m, idx) => (
                                            <option
                                              key={m}
                                              value={String(idx + 1).padStart(
                                                2,
                                                "0"
                                              )}
                                            >
                                              {m}
                                            </option>
                                          ))}
                                        </select>
                                      </div>

                                      {/* Year Input */}
                                      <div>
                                        <label
                                          htmlFor={inputId}
                                          className="block text-[9px] font-mono studio-fg-muted mb-0.5"
                                        >
                                          Year
                                        </label>
                                        <input
                                          id={inputId}
                                          type="number"
                                          min={1900}
                                          max={2100}
                                          aria-invalid={
                                            fieldError ? "true" : undefined
                                          }
                                          aria-describedby={
                                            fieldError ? errorId : undefined
                                          }
                                          value={
                                            parsedPrecision?.year !== null &&
                                            parsedPrecision?.year !== undefined
                                              ? parsedPrecision.year
                                              : ""
                                          }
                                          placeholder="YYYY"
                                          onChange={(e) => {
                                            const yVal = e.target.value;
                                            const mVal =
                                              parsedPrecision?.month !== null &&
                                              parsedPrecision?.month !==
                                                undefined
                                                ? parsedPrecision.month
                                                : field.allowPartial
                                                  ? "UNK"
                                                  : null;
                                            const dVal =
                                              parsedPrecision?.day !== null &&
                                              parsedPrecision?.day !== undefined
                                                ? parsedPrecision.day
                                                : field.allowPartial
                                                  ? "UNK"
                                                  : null;
                                            const newIso = formatPrecisionDate(
                                              yVal,
                                              mVal,
                                              dVal
                                            );
                                            handleFieldChange(field, newIso);
                                          }}
                                          disabled={isFieldReadOnly}
                                          className="w-full px-2 py-1 text-xs studio-surface-card border studio-border-strong rounded studio-fg-primary font-mono studio-focus-input focus:outline-none disabled:opacity-50"
                                        />
                                      </div>
                                    </div>

                                    <div className="flex items-center justify-between text-[10px] font-mono studio-fg-muted pt-0.5">
                                      <span>
                                        ISO:{" "}
                                        <strong className="studio-fg-cyan">
                                          {String(currentVal || "—")}
                                        </strong>
                                      </span>
                                      {field.preventFutureDate && (
                                        <span className="studio-fg-amber">
                                          ≤ Current UTC
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Standard Text Input */}
                                {field.dataType === "text" && (
                                  <input
                                    id={inputId}
                                    type="text"
                                    aria-invalid={
                                      fieldError ? "true" : undefined
                                    }
                                    aria-describedby={
                                      fieldError ? errorId : undefined
                                    }
                                    value={String(currentVal || "")}
                                    onChange={(e) =>
                                      handleFieldChange(field, e.target.value)
                                    }
                                    disabled={isFieldReadOnly}
                                    className="w-full px-2.5 py-1.5 text-xs studio-surface-card border studio-border-strong rounded-lg studio-fg-primary font-sans studio-focus-input focus:outline-none disabled:opacity-50"
                                    placeholder={
                                      field.placeholder || "Enter value..."
                                    }
                                  />
                                )}

                                {field.dataType === "textarea" && (
                                  <textarea
                                    id={inputId}
                                    rows={2}
                                    aria-invalid={
                                      fieldError ? "true" : undefined
                                    }
                                    aria-describedby={
                                      fieldError ? errorId : undefined
                                    }
                                    value={String(currentVal || "")}
                                    onChange={(e) =>
                                      handleFieldChange(field, e.target.value)
                                    }
                                    disabled={isFieldReadOnly}
                                    className="w-full px-2.5 py-1.5 text-xs studio-surface-card border studio-border-strong rounded-lg studio-fg-primary font-sans studio-focus-input focus:outline-none resize-none disabled:opacity-50"
                                    placeholder={
                                      field.placeholder || "Enter narrative..."
                                    }
                                  />
                                )}

                                {(field.dataType === "number" ||
                                  field.dataType === "integer") && (
                                  <div className="relative">
                                    <input
                                      id={inputId}
                                      type="number"
                                      min={field.minValue}
                                      max={field.maxValue}
                                      step={
                                        field.dataType === "integer" ? 1 : "any"
                                      }
                                      aria-invalid={
                                        fieldError ? "true" : undefined
                                      }
                                      aria-describedby={
                                        fieldError ? errorId : undefined
                                      }
                                      value={
                                        currentVal !== undefined &&
                                        currentVal !== null &&
                                        !hasNullFlavor
                                          ? Number(currentVal)
                                          : ""
                                      }
                                      onChange={(e) =>
                                        handleFieldChange(
                                          field,
                                          e.target.value === ""
                                            ? null
                                            : parseFloat(e.target.value)
                                        )
                                      }
                                      disabled={isFieldReadOnly}
                                      className="w-full px-2.5 py-1.5 text-xs studio-surface-card border studio-border-strong rounded-lg studio-fg-primary font-mono studio-focus-input focus:outline-none disabled:opacity-50"
                                      placeholder={field.placeholder || "0"}
                                    />
                                    {field.unit && (
                                      <span className="absolute right-2.5 top-1.5 text-[11px] font-mono studio-fg-muted">
                                        {field.unit}
                                      </span>
                                    )}
                                  </div>
                                )}

                                {(field.dataType === "date" ||
                                  field.dataType === "partial_date" ||
                                  field.dataType === "datetime") && (
                                  <input
                                    id={inputId}
                                    type="text"
                                    aria-invalid={
                                      fieldError ? "true" : undefined
                                    }
                                    aria-describedby={
                                      fieldError ? errorId : undefined
                                    }
                                    value={String(currentVal || "")}
                                    onChange={(e) =>
                                      handleFieldChange(field, e.target.value)
                                    }
                                    disabled={isFieldReadOnly}
                                    placeholder={
                                      field.placeholder ||
                                      (field.dataType === "partial_date"
                                        ? "YYYY-MM-DD (e.g. 2026-08-UNK)"
                                        : "YYYY-MM-DD")
                                    }
                                    className="w-full px-2.5 py-1.5 text-xs studio-surface-card border studio-border-strong rounded-lg studio-fg-primary font-mono studio-focus-input focus:outline-none disabled:opacity-50"
                                  />
                                )}

                                {field.dataType === "radio" && (
                                  <div
                                    id={inputId}
                                    role="radiogroup"
                                    aria-labelledby={inputId}
                                    aria-invalid={
                                      fieldError ? "true" : undefined
                                    }
                                    aria-describedby={
                                      fieldError ? errorId : undefined
                                    }
                                    className="space-y-1.5 pt-0.5"
                                  >
                                    {(
                                      field.customOptions ||
                                      study.codelists.find(
                                        (cl) => cl.id === field.codelistId
                                      )?.options || [
                                        { code: "Y", label: "Yes", order: 1 },
                                        { code: "N", label: "No", order: 2 },
                                      ]
                                    ).map((opt) => (
                                      <label
                                        key={opt.code}
                                        className="flex items-center gap-2 text-xs studio-fg-secondary cursor-pointer"
                                      >
                                        <input
                                          type="radio"
                                          name={key}
                                          value={opt.code}
                                          checked={currentVal === opt.code}
                                          onChange={(e) =>
                                            handleFieldChange(
                                              field,
                                              e.target.value
                                            )
                                          }
                                          disabled={isFieldReadOnly}
                                          className="studio-fg-cyan focus:ring-0"
                                        />
                                        <span>{opt.label}</span>
                                      </label>
                                    ))}
                                  </div>
                                )}

                                {field.dataType === "single_select" && (
                                  <select
                                    id={inputId}
                                    aria-invalid={
                                      fieldError ? "true" : undefined
                                    }
                                    aria-describedby={
                                      fieldError ? errorId : undefined
                                    }
                                    value={String(currentVal || "")}
                                    onChange={(e) =>
                                      handleFieldChange(field, e.target.value)
                                    }
                                    disabled={isFieldReadOnly}
                                    className="w-full px-2.5 py-1.5 text-xs studio-surface-card border studio-border-strong rounded-lg studio-fg-primary font-sans studio-focus-input focus:outline-none disabled:opacity-50"
                                  >
                                    <option value="">
                                      -- Select Option --
                                    </option>
                                    {(
                                      field.customOptions ||
                                      study.codelists.find(
                                        (cl) => cl.id === field.codelistId
                                      )?.options ||
                                      []
                                    ).map((opt) => (
                                      <option key={opt.code} value={opt.code}>
                                        {opt.label} ({opt.code})
                                      </option>
                                    ))}
                                  </select>
                                )}

                                {field.dataType === "multi_select" && (
                                  <div
                                    id={inputId}
                                    role="group"
                                    aria-labelledby={inputId}
                                    aria-describedby={
                                      fieldError ? errorId : undefined
                                    }
                                    className="space-y-1.5 pt-0.5"
                                  >
                                    {(
                                      field.customOptions ||
                                      study.codelists.find(
                                        (cl) => cl.id === field.codelistId
                                      )?.options ||
                                      []
                                    ).map((opt) => {
                                      const selectedArray: string[] =
                                        Array.isArray(currentVal)
                                          ? currentVal
                                          : typeof currentVal === "string" &&
                                              currentVal
                                            ? currentVal.split(",")
                                            : [];
                                      const isChecked = selectedArray.includes(
                                        opt.code
                                      );

                                      return (
                                        <label
                                          key={opt.code}
                                          className="flex items-center gap-2 text-xs studio-fg-secondary cursor-pointer"
                                        >
                                          <input
                                            type="checkbox"
                                            checked={isChecked}
                                            aria-invalid={
                                              fieldError ? "true" : undefined
                                            }
                                            aria-describedby={
                                              fieldError ? errorId : undefined
                                            }
                                            onChange={(e) => {
                                              const updated = e.target.checked
                                                ? [...selectedArray, opt.code]
                                                : selectedArray.filter(
                                                    (c) => c !== opt.code
                                                  );
                                              handleFieldChange(
                                                field,
                                                updated.join(",")
                                              );
                                            }}
                                            disabled={isFieldReadOnly}
                                            className="studio-fg-cyan rounded studio-border-strong studio-surface-card focus:ring-0"
                                          />
                                          <span>{opt.label}</span>
                                        </label>
                                      );
                                    })}
                                  </div>
                                )}

                                {field.dataType === "calculated" && (
                                  <div
                                    id={inputId}
                                    aria-invalid={
                                      fieldError ? "true" : undefined
                                    }
                                    aria-describedby={
                                      fieldError ? errorId : undefined
                                    }
                                    className="p-2 rounded-lg studio-bg-cyan border studio-border-cyan flex items-center justify-between font-mono min-h-[34px]"
                                  >
                                    <span className="text-xs studio-fg-cyan font-bold">
                                      {currentVal !== undefined &&
                                      currentVal !== null
                                        ? String(currentVal)
                                        : ""}
                                    </span>
                                    {field.unit && (
                                      <span className="text-[10px] studio-fg-muted">
                                        {field.unit}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </>
                            )}

                            {/* Validation Error Feedback */}
                            {fieldError && (
                              <p
                                id={errorId}
                                role="alert"
                                aria-live="polite"
                                className="text-[10px] studio-fg-red font-mono mt-1.5 flex items-center gap-1"
                              >
                                <IconAlertTriangle className="w-3 h-3 studio-fg-red shrink-0" />
                                <span>{fieldError}</span>
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* Bottom Save Action */}
                <div className="pt-4 border-t studio-border-default flex items-center justify-between">
                  <div className="text-xs studio-fg-muted font-mono">
                    Active Form: <strong>{activeForm.name}</strong> (
                    {activeForm.domain})
                  </div>
                  <button
                    type="button"
                    disabled={signatureStatus.isLocked}
                    onClick={handleSaveForm}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-mono text-xs font-bold studio-btn-cyan transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <IconDeviceFloppy className="w-4 h-4" />
                    <span>Save &amp; Validate Form Data</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* VIEW 2: SUBJECT STATUS MATRIX (Rave / Veeva CDMS Style) */}
          {subView === "subject_matrix" && (
            <div className="p-5 rounded-2xl studio-surface-subtle border studio-border-default space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold studio-fg-primary font-mono">
                    Longitudinal Subject vs. Visit Progression Matrix
                  </h2>
                  <p className="text-xs studio-fg-muted font-sans mt-0.5">
                    Click any cell to jump into patient form data entry.
                  </p>
                </div>
                <div className="flex items-center gap-3 text-[10px] font-mono">
                  <span className="flex items-center gap-1 studio-fg-emerald">
                    <span className="w-2 h-2 rounded-full studio-dot-emerald" />{" "}
                    Complete
                  </span>
                  <span className="flex items-center gap-1 studio-fg-amber">
                    <span className="w-2 h-2 rounded-full studio-dot-amber" />{" "}
                    Incomplete
                  </span>
                  <span className="flex items-center gap-1 studio-fg-sky">
                    <span className="w-2 h-2 rounded-full studio-dot-sky" />{" "}
                    Locked
                  </span>
                  <span className="flex items-center gap-1 studio-fg-red">
                    <span className="w-2 h-2 rounded-full studio-dot-red" />{" "}
                    Query
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table
                  className="w-full text-left font-mono text-xs border-collapse"
                  role="grid"
                  aria-label="Subject Status Progression Matrix"
                >
                  <caption className="sr-only">
                    Subject Status Progression Matrix
                  </caption>
                  <thead>
                    <tr
                      className="border-b studio-border-default studio-surface-subtle studio-fg-muted"
                      role="row"
                    >
                      <th scope="col" role="columnheader" className="p-3">
                        Subject ID
                      </th>
                      {study.visits.map((v) => (
                        <th
                          key={v.id}
                          scope="col"
                          role="columnheader"
                          className="p-3 text-center"
                        >
                          <div>{v.name}</div>
                          <div className="text-[10px] studio-fg-muted">
                            Day {v.targetDay}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y studio-divide-default">
                    {availableSubjects.map((subj) => (
                      <tr
                        key={subj}
                        role="row"
                        className="studio-hover-surface transition-colors"
                      >
                        <th
                          scope="row"
                          role="rowheader"
                          className="p-3 font-bold studio-fg-cyan text-left font-normal"
                        >
                          {subj}
                        </th>
                        {study.visits.map((v) => {
                          const formsForVisit = getScheduledFormsForVisit(
                            study,
                            v.id
                          );

                          return (
                            <td
                              key={v.id}
                              role="gridcell"
                              className="p-3 text-center align-top"
                            >
                              <div className="flex flex-wrap justify-center gap-1.5">
                                {formsForVisit.map((form) => {
                                  const status = getSubjectFormStatus(
                                    study,
                                    resolvedSimState,
                                    subj,
                                    v.id,
                                    form.id
                                  );

                                  return (
                                    <TooltipButton
                                      key={form.id}
                                      onClick={() => {
                                        setSubjectId(subj);
                                        setActiveVisitId(v.id);
                                        setActiveFormId(form.id);
                                        clearTransientValidation();
                                        setSubView("form_entry");
                                      }}
                                      className={`px-2 py-1 rounded text-[10px] font-mono font-bold transition-all border ${
                                        status.openQueriesCount > 0
                                          ? "studio-accent-red-strong motion-safe:animate-pulse"
                                          : status.isLocked
                                            ? "studio-accent-sky-strong"
                                            : status.isComplete
                                              ? "studio-accent-emerald-strong"
                                              : "studio-surface-muted studio-fg-muted studio-border-strong studio-hover-fg-primary"
                                      }`}
                                      tooltip={`Open ${form.name} for ${subj}`}
                                    >
                                      <span>{form.domain}</span>
                                      {status.openQueriesCount > 0 && (
                                        <span> !</span>
                                      )}
                                      {status.isLocked && <span> 🔒</span>}
                                    </TooltipButton>
                                  );
                                })}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VIEW 3: QUERIES & DISCREPANCIES */}
          {subView === "queries" && (
            <div className="p-5 rounded-2xl studio-surface-subtle border studio-border-default space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <h2 className="text-sm font-bold studio-fg-primary font-mono">
                    Clinical Discrepancy &amp; Query Management Ledger
                  </h2>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
                    <span className="px-2 py-0.5 rounded studio-accent-red-strong border">
                      {queries.filter((q) => q.status === "Open").length} Open
                    </span>
                    <span className="px-2 py-0.5 rounded studio-accent-amber-strong border">
                      {queries.filter((q) => q.status === "Answered").length}{" "}
                      Answered
                    </span>
                    <span className="px-2 py-0.5 rounded studio-accent-emerald-strong border">
                      {queries.filter((q) => q.status === "Closed").length}{" "}
                      Closed
                    </span>
                    <span className="px-2 py-0.5 rounded studio-surface-card studio-fg-muted border studio-border-default">
                      {queries.filter((q) => q.status === "Cancelled").length}{" "}
                      Cancelled
                    </span>
                  </div>
                </div>

                {rolePermissions.canManageQueries && (
                  <button
                    type="button"
                    onClick={openManualQueryModal}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg studio-btn-cyan font-mono font-bold text-xs"
                  >
                    <IconPlus className="w-3.5 h-3.5" />
                    <span>New Manual Query</span>
                  </button>
                )}
              </div>

              {queries.length === 0 ? (
                <div className="p-8 text-center studio-fg-muted font-mono text-xs border border-dashed studio-border-default rounded-xl">
                  No open queries or validation discrepancies across subjects.
                </div>
              ) : (
                <div className="space-y-3">
                  {queries.map((q) => (
                    <div
                      key={q.id}
                      data-testid={`edc-query-card-${q.id}`}
                      className="p-4 rounded-xl studio-surface-card border studio-border-default space-y-2.5 font-mono text-xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2 min-w-0">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                              q.status === "Open"
                                ? "studio-accent-red-strong"
                                : q.status === "Answered"
                                  ? "studio-accent-amber-strong"
                                  : q.status === "Closed"
                                    ? "studio-accent-emerald-strong"
                                    : "studio-surface-muted studio-fg-muted studio-border-default"
                            }`}
                          >
                            {q.status}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                              q.severity === "error"
                                ? "studio-accent-red-strong"
                                : "studio-accent-amber-strong"
                            }`}
                          >
                            {q.severity}
                          </span>
                          <span className="font-bold studio-fg-primary">
                            Subject {q.subjectId}
                          </span>
                          <span className="studio-fg-muted">
                            • Variable: {q.fieldName}
                          </span>
                          <span className="text-[10px] studio-fg-muted">
                            (
                            {q.ruleId
                              ? `Rule ${q.ruleId}`
                              : `Raised by ${q.raisedBy}`}
                            )
                          </span>
                        </div>
                        <span className="text-[10px] studio-fg-muted">
                          {q.raisedAt.slice(0, 19)}
                        </span>
                      </div>

                      <p className="studio-fg-secondary font-sans text-xs">
                        {q.message}
                      </p>

                      {q.response && (
                        <div className="p-2.5 rounded-lg studio-surface-subtle border studio-border-default text-[11px] studio-fg-muted font-sans space-y-0.5">
                          <div>
                            <span className="font-bold studio-fg-primary">
                              Site Response:
                            </span>{" "}
                            {q.response}
                          </div>
                          {q.respondedBy && (
                            <div className="text-[10px] font-mono studio-fg-muted">
                              Responded by {q.respondedBy}
                              {q.respondedAt
                                ? ` · ${q.respondedAt.slice(0, 19)}`
                                : ""}
                            </div>
                          )}
                        </div>
                      )}

                      {(q.status === "Closed" || q.status === "Cancelled") &&
                        (q.resolvedBy || q.resolutionReason) && (
                          <div className="p-2.5 rounded-lg studio-surface-subtle border studio-border-default text-[11px] studio-fg-muted font-sans space-y-0.5">
                            <div>
                              <span className="font-bold studio-fg-primary">
                                {q.status} Resolution:
                              </span>{" "}
                              {q.resolutionReason || "Completed"}
                            </div>
                            {q.resolvedBy && (
                              <div className="text-[10px] font-mono studio-fg-muted">
                                {q.status} by {q.resolvedBy}
                                {q.resolvedAt
                                  ? ` · ${q.resolvedAt.slice(0, 19)}`
                                  : ""}
                              </div>
                            )}
                          </div>
                        )}

                      <div className="pt-2 border-t studio-border-default flex flex-wrap items-center justify-between gap-2">
                        {rolePermissions.canManageQueries ? (
                          <input
                            type="text"
                            aria-label={`Resolution note for query ${q.id}`}
                            value={queryResolutionNotes[q.id] || ""}
                            onChange={(e) =>
                              setQueryResolutionNotes((prev) => ({
                                ...prev,
                                [q.id]: e.target.value,
                              }))
                            }
                            placeholder="Optional resolution / transition note..."
                            className="flex-1 min-w-[180px] px-2.5 py-1 rounded-lg studio-surface-subtle border studio-border-default text-xs font-sans studio-fg-primary focus:outline-none studio-focus-input"
                          />
                        ) : (
                          <span className="text-[11px] font-sans studio-fg-muted">
                            {q.status === "Answered"
                              ? "Awaiting CRA Monitor / Data Manager review"
                              : ""}
                          </span>
                        )}

                        <div className="flex flex-wrap items-center justify-end gap-2 ml-auto">
                          {q.status === "Open" &&
                            rolePermissions.canRespondToQueries && (
                              <button
                                type="button"
                                onClick={() => setActiveQueryToAnswer(q)}
                                className="px-3 py-1.5 rounded-lg studio-btn-cyan font-bold text-xs"
                              >
                                Respond to Query
                              </button>
                            )}

                          {q.status === "Open" &&
                            rolePermissions.canManageQueries && (
                              <button
                                type="button"
                                onClick={() => handleCancelQuery(q.id)}
                                className="px-3 py-1.5 rounded-lg studio-surface-muted border studio-border-strong studio-fg-secondary studio-hover-fg-primary text-xs font-bold"
                              >
                                Cancel Query
                              </button>
                            )}

                          {q.status === "Answered" &&
                            rolePermissions.canManageQueries && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleReopenQuery(q.id)}
                                  className="px-3 py-1.5 rounded-lg studio-surface-muted border studio-border-strong studio-fg-primary studio-hover-border text-xs font-bold"
                                >
                                  Reopen Query
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleCloseQuery(q.id)}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg studio-btn-cyan font-bold text-xs"
                                >
                                  <IconCheck className="w-3.5 h-3.5" />
                                  <span>Close Query</span>
                                </button>
                              </>
                            )}

                          {(q.status === "Closed" ||
                            q.status === "Cancelled") &&
                            rolePermissions.canManageQueries && (
                              <button
                                type="button"
                                onClick={() => handleReopenQuery(q.id)}
                                className="px-3 py-1.5 rounded-lg studio-surface-muted border studio-border-strong studio-fg-primary studio-hover-border text-xs font-bold"
                              >
                                Reopen Query
                              </button>
                            )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* VIEW 4: PART 11 AUDIT TRAIL */}
          {subView === "audit_trail" && (
            <div className="p-5 rounded-2xl studio-surface-subtle border studio-border-default space-y-4">
              <h2 className="text-sm font-bold studio-fg-primary font-mono">
                Part 11-style audit trail (simulation)
              </h2>

              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs border-collapse">
                  <caption className="sr-only">
                    Part 11-style audit trail (simulation)
                  </caption>
                  <thead>
                    <tr className="border-b studio-border-default studio-surface-subtle studio-fg-muted">
                      <th scope="col" className="p-2.5">
                        Timestamp
                      </th>
                      <th scope="col" className="p-2.5">
                        Subject
                      </th>
                      <th scope="col" className="p-2.5">
                        Action
                      </th>
                      <th scope="col" className="p-2.5">
                        Variable
                      </th>
                      <th scope="col" className="p-2.5">
                        Previous Value
                      </th>
                      <th scope="col" className="p-2.5">
                        New Value
                      </th>
                      <th scope="col" className="p-2.5">
                        Actor &amp; Role
                      </th>
                      <th scope="col" className="p-2.5">
                        Justification Reason
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y studio-divide-default">
                    {auditLog.map((entry) => (
                      <tr key={entry.id} className="studio-hover-surface">
                        <td className="p-2.5 studio-fg-muted whitespace-nowrap">
                          {entry.timestamp.slice(0, 19)}
                        </td>
                        <td className="p-2.5 studio-fg-cyan font-bold">
                          {entry.subjectId}
                        </td>
                        <td className="p-2.5 whitespace-nowrap">
                          {(() => {
                            const actionLabel =
                              entry.actionType || entry.action || "UPDATE";
                            return (
                              <span
                                className={`inline-flex px-2 py-0.5 rounded-md border text-[10px] font-bold ${
                                  actionLabel === "FORM_UNLOCK"
                                    ? "studio-accent-red"
                                    : actionLabel === "FORM_LOCK"
                                      ? "studio-accent-sky"
                                      : "studio-surface-card studio-border-default studio-fg-secondary"
                                }`}
                              >
                                {actionLabel}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="p-2.5 studio-fg-primary">
                          {entry.fieldName}
                        </td>
                        <td className="p-2.5 studio-fg-muted">
                          {String(entry.previousValue ?? "—")}
                        </td>
                        <td className="p-2.5 studio-fg-emerald font-bold">
                          {String(entry.newValue ?? "—")}
                        </td>
                        <td className="p-2.5 studio-fg-secondary">
                          <div>{entry.changedBy}</div>
                          <div className="text-[10px] studio-fg-muted">
                            {entry.userRole}
                          </div>
                        </td>
                        <td className="p-2.5 studio-fg-muted font-sans text-xs">
                          {entry.reasonForChange}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT SIDEBAR: CDISC CLINICAL DATA EXCHANGE */}
        <EdcClinicalDataExchangePanel
          study={study}
          currentSimSnapshot={currentSimSnapshot}
          onApplyImportedSimulationState={handleApplyImportedSimulationState}
          announce={announce}
        />
      </div>

      {/* MODAL: 21 CFR Part 11 Unlock & Signature Revocation */}
      {isUnlockModalOpen && activeForm && (
        <EdcUnlockRevocationModal
          subjectId={effectiveSubjectId}
          visitLabel={visitDisplayLabel}
          formDomain={activeForm.domain}
          formName={activeForm.name}
          actorLabel={rolePermissions.actorLabel}
          revokedSignature={signatureStatus.activeDataLockSignature}
          onClose={() => setIsUnlockModalOpen(false)}
          onConfirm={handleConfirmUnlockForm}
        />
      )}

      {/* MODAL: 21 CFR Part 11 Reason for Change Prompt */}
      {pendingChange && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 studio-surface-scrim backdrop-blur-sm">
          <div className="studio-surface-elevated border studio-border-strong rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold studio-fg-primary font-mono flex items-center gap-2">
              <IconShieldCheck className="w-5 h-5 studio-fg-cyan" />
              <span>21 CFR Part 11 Audit Justification</span>
            </h3>
            <p className="text-xs studio-fg-muted font-sans">
              Modifying existing clinical observation data requires a documented
              Reason for Change.
            </p>

            <div className="p-3 rounded studio-surface-subtle border studio-border-default font-mono text-xs space-y-1">
              <div>
                Variable:{" "}
                <span className="studio-fg-cyan">
                  {pendingChange.field.variableName}
                </span>
              </div>
              <div>
                Previous Value:{" "}
                <span className="studio-fg-muted">
                  {String(pendingChange.oldVal)}
                </span>
              </div>
              <div>
                New Value:{" "}
                <span className="studio-fg-emerald">
                  {String(pendingChange.newVal)}
                </span>
              </div>
            </div>

            <div>
              <label
                htmlFor="edc-reason-for-change-input"
                className="block text-[10px] font-mono studio-fg-muted mb-1"
              >
                Reason for Change Justification:
              </label>
              <textarea
                id="edc-reason-for-change-input"
                rows={2}
                value={changeReasonInput}
                onChange={(e) => setChangeReasonInput(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs studio-surface-subtle border studio-border-strong rounded-lg studio-fg-primary font-sans studio-focus-input focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingChange(null)}
                className="px-3 py-1.5 rounded-lg studio-surface-muted studio-hover-active studio-fg-secondary text-xs font-mono"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() =>
                  applyValueChange(
                    pendingChange.field,
                    pendingChange.oldVal,
                    pendingChange.newVal,
                    changeReasonInput
                  )
                }
                className="px-3 py-1.5 rounded-lg studio-btn-cyan font-bold text-xs font-mono"
              >
                Confirm Audit Signature
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Query Response */}
      {activeQueryToAnswer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 studio-surface-scrim backdrop-blur-sm">
          <div className="studio-surface-elevated border studio-border-strong rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold studio-fg-primary font-mono">
              Respond to Clinical Query
            </h3>
            <p className="text-xs studio-fg-muted font-sans">
              {activeQueryToAnswer.message}
            </p>

            <textarea
              rows={3}
              value={queryResponseText}
              onChange={(e) => setQueryResponseText(e.target.value)}
              placeholder="Enter site investigator response and verification rationale..."
              className="w-full px-3 py-2 text-xs studio-surface-subtle border studio-border-strong rounded-lg studio-fg-primary font-sans studio-focus-input focus:outline-none"
            />

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveQueryToAnswer(null)}
                className="px-3 py-1.5 rounded-lg studio-surface-muted studio-fg-secondary text-xs font-mono"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitQueryAnswer}
                className="px-3 py-1.5 rounded-lg studio-btn-cyan font-bold text-xs font-mono"
              >
                Submit Response
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Raise Manual Query */}
      {isManualQueryModalOpen && (
        <EdcManualQueryModal
          study={study}
          availableSubjects={availableSubjects}
          defaultSubjectId={effectiveSubjectId}
          defaultVisitId={effectiveVisitId}
          defaultFormId={effectiveFormId}
          currentRole={currentRole}
          onClose={() => setIsManualQueryModalOpen(false)}
          onSubmit={handleRaiseManualQuery}
        />
      )}
    </div>
  );
};
