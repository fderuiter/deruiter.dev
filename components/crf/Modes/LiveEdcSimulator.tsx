"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  StudyProtocol,
  CRFField,
  EDCQuery,
  AuditTrailEntry,
  ElectronicSignature,
  SubjectFormStatus,
  EdcSimulationState,
} from "@/lib/crf/types";
import {
  evaluateRule,
  resolveFormConditionalState,
  describeFieldConditionalState,
  parsePrecisionDate,
  formatPrecisionDate,
  isCdiscNullFlavor,
  validatePrecisionDate,
  CDISC_NULL_FLAVORS,
  raiseSimulationQuery,
  answerSimulationQuery,
  closeSimulationQuery,
  cancelSimulationQuery,
  reopenSimulationQuery,
  getEdcRoleActorLabel,
} from "@/lib/crf";
import { useCrfService } from "@/hooks/useCrfService";
import { generateId } from "@/lib/utils";
import { NoPhiNotice } from "../NoPhiNotice";
import { EdcClinicalDataExchangePanel } from "./EdcClinicalDataExchangePanel";
import { EdcManualQueryModal } from "./EdcManualQueryModal";
import { useAnnouncer } from "@/components/providers/A11yProvider";
import {
  IconShieldCheck,
  IconHistory,
  IconCheck,
  IconPlus,
  IconLock,
  IconLockOpen,
  IconTable,
  IconFileText,
  IconMessageCircleQuestion,
  IconAlertTriangle,
  IconDeviceFloppy,
  IconEyeOff,
} from "@tabler/icons-react";
import { TooltipButton } from "@/components/ui/Tooltip";

function generateAuditId(): string {
  return generateId("aud_");
}

function generateSignatureId(): string {
  return generateId("sig_");
}

function generateQueryId(): string {
  return generateId("qry_");
}

interface LiveEdcSimulatorProps {
  study: StudyProtocol;
  simulationState?: EdcSimulationState;
  onUpdateSimulationState?: (nextState: EdcSimulationState) => void;
}

type UserRole =
  | "Site Coordinator"
  | "Principal Investigator"
  | "CRA Monitor"
  | "Data Manager";
type EdcSubView = "form_entry" | "subject_matrix" | "audit_trail" | "queries";

export const LiveEdcSimulator: React.FC<LiveEdcSimulatorProps> = ({
  study,
  simulationState,
  onUpdateSimulationState,
}) => {
  const { evaluateFormula } = useCrfService();
  const { announce } = useAnnouncer();
  const [subView, setSubView] = useState<EdcSubView>("form_entry");
  const [subjectId, setSubjectId] = useState("001-101");
  const [newSubjectInput, setNewSubjectInput] = useState("");
  const [isAddingSubject, setIsAddingSubject] = useState(false);

  const initialSimState = simulationState ?? study.simulationState;

  const [availableSubjects, setAvailableSubjects] = useState<string[]>(
    () =>
      initialSimState?.availableSubjects ?? ["001-101", "001-102", "001-103"]
  );

  const [activeVisitId, setActiveVisitId] = useState<string>(
    study.visits[0]?.id || ""
  );
  const [activeFormId, setActiveFormId] = useState<string>(
    study.forms[0]?.id || ""
  );
  const [currentRole, setCurrentRole] = useState<UserRole>("Site Coordinator");

  // Subject Form Values State: Map<subjectId_visitId_fieldId, value>
  const [formValues, setFormValues] = useState<
    Record<string, string | number | boolean | null>
  >(
    () =>
      initialSimState?.formValues ?? {
        "001-101_v_screen_f_brthyr": 1982,
        "001-101_v_screen_f_age": 44,
        "001-101_v_screen_f_sex": "M",
        "001-101_v_screen_f_height": 178,
        "001-101_v_screen_f_weight": 78,
        "001-101_v_screen_f_sysbp": 132,
        "001-101_v_screen_f_diabp": 84,
        "001-101_v_screen_f_pulse": 72,
        "001-101_v_screen_f_temp": 36.8,
      }
  );

  // CRA SDV Verification State: Map<subjectId_visitId_fieldId, { verified: boolean; timestamp: string }>
  const [sdvMap, setSdvMap] = useState<
    Record<string, { verified: boolean; timestamp: string; auditedBy: string }>
  >(() => initialSimState?.sdvMap ?? {});

  // PI Form Lock State: Map<subjectId_visitId_formId, { locked: boolean; lockedBy: string; timestamp: string }>
  const [lockedForms, setLockedForms] = useState<
    Record<string, { locked: boolean; lockedBy: string; timestamp: string }>
  >(() => initialSimState?.lockedForms ?? {});

  // Queries State
  const [queries, setQueries] = useState<EDCQuery[]>(
    () => initialSimState?.queries ?? []
  );

  // Audit Trail State
  const [auditLog, setAuditLog] = useState<AuditTrailEntry[]>(
    () =>
      initialSimState?.auditLog ?? [
        {
          id: "aud_init_1",
          timestamp: "2026-08-15T08:30:00Z",
          subjectId: "001-101",
          formId: study.forms[0]?.id || "form_dm",
          fieldId: "f_brthyr",
          fieldName: "BRTHYR",
          previousValue: null,
          newValue: 1982,
          changedBy: "Dr. Sarah Jenkins (Site CRC)",
          userRole: "Site Coordinator",
          reasonForChange: "Initial baseline data entry from hospital records",
        },
      ]
  );

  // Signatures State
  const [signatures, setSignatures] = useState<ElectronicSignature[]>(
    () => initialSimState?.signatures ?? []
  );

  const emittedStatesRef = React.useRef<WeakSet<EdcSimulationState>>(
    new WeakSet()
  );
  const hadActiveSimStateRef = React.useRef<boolean>(
    Boolean(simulationState ?? study.simulationState)
  );
  const prevStudyRef = React.useRef<StudyProtocol>(study);
  const activeSimState = simulationState ?? study.simulationState;

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    const studyChanged = prevStudyRef.current !== study;
    prevStudyRef.current = study;

    if (activeSimState) {
      hadActiveSimStateRef.current = true;
      if (!emittedStatesRef.current.has(activeSimState)) {
        if (activeSimState.formValues !== undefined)
          setFormValues(activeSimState.formValues);
        if (activeSimState.sdvMap !== undefined)
          setSdvMap(activeSimState.sdvMap);
        if (activeSimState.lockedForms !== undefined)
          setLockedForms(activeSimState.lockedForms);
        if (activeSimState.queries !== undefined)
          setQueries(activeSimState.queries);
        if (activeSimState.auditLog !== undefined)
          setAuditLog(activeSimState.auditLog);
        if (activeSimState.signatures !== undefined)
          setSignatures(activeSimState.signatures);
        if (activeSimState.availableSubjects !== undefined)
          setAvailableSubjects(activeSimState.availableSubjects);
      }
    } else if (
      !activeSimState &&
      (hadActiveSimStateRef.current || studyChanged)
    ) {
      // Cleanly reset state if incoming study/props explicitly cleared simulationState
      hadActiveSimStateRef.current = false;
      setFormValues({});
      setSdvMap({});
      setLockedForms({});
      setQueries([]);
      setAuditLog([]);
      setSignatures([]);
      setAvailableSubjects(["001-101", "001-102", "001-103"]);
    }
  }, [activeSimState, study]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (
      study.forms.length > 0 &&
      !study.forms.some((f) => f.id === activeFormId)
    ) {
      setActiveFormId(study.forms[0].id);
    }
    if (
      study.visits.length > 0 &&
      !study.visits.some((v) => v.id === activeVisitId)
    ) {
      setActiveVisitId(study.visits[0].id);
    }
  }, [study, activeFormId, activeVisitId]);

  useEffect(() => {
    if (onUpdateSimulationState) {
      const nextState: EdcSimulationState = {
        formValues,
        sdvMap,
        lockedForms,
        queries,
        auditLog,
        signatures,
        availableSubjects,
      };
      emittedStatesRef.current.add(nextState);
      onUpdateSimulationState(nextState);
    }
  }, [
    formValues,
    sdvMap,
    lockedForms,
    queries,
    auditLog,
    signatures,
    availableSubjects,
    onUpdateSimulationState,
  ]);

  // Reason For Change Modal State
  const [pendingChange, setPendingChange] = useState<{
    field: CRFField;
    oldVal: string | number | boolean | null;
    newVal: string | number | boolean | null;
  } | null>(null);
  const [changeReasonInput, setChangeReasonInput] = useState(
    "Transcription correction against source chart"
  );

  // Query Response Modal State
  const [activeQueryToAnswer, setActiveQueryToAnswer] =
    useState<EDCQuery | null>(null);
  const [queryResponseText, setQueryResponseText] = useState("");
  const [queryResolutionNotes, setQueryResolutionNotes] = useState<
    Record<string, string>
  >({});

  // Manual Query Modal State
  const [isManualQueryModalOpen, setIsManualQueryModalOpen] = useState(false);

  const isMonitorOrDm =
    currentRole === "CRA Monitor" || currentRole === "Data Manager";

  const currentSimSnapshot = useMemo<EdcSimulationState>(
    () => ({
      formValues,
      sdvMap,
      lockedForms,
      queries,
      auditLog,
      signatures,
      availableSubjects,
    }),
    [
      formValues,
      sdvMap,
      lockedForms,
      queries,
      auditLog,
      signatures,
      availableSubjects,
    ]
  );

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
    const nextSim = raiseSimulationQuery(
      currentSimSnapshot,
      {
        id: generateQueryId(),
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
      study
    );

    if (nextSim.availableSubjects)
      setAvailableSubjects(nextSim.availableSubjects);
    if (nextSim.queries) setQueries(nextSim.queries);
    if (nextSim.auditLog) setAuditLog(nextSim.auditLog);
    setIsManualQueryModalOpen(false);
    setSubView("queries");
    announce("Manual discrepancy query raised.", "polite");
  };

  const handleSubmitQueryAnswer = () => {
    if (!activeQueryToAnswer || !queryResponseText.trim()) return;
    const nextSim = answerSimulationQuery(currentSimSnapshot, {
      queryId: activeQueryToAnswer.id,
      response: queryResponseText,
      actor: getEdcRoleActorLabel(currentRole),
      userRole: currentRole,
    });
    if (nextSim.queries) setQueries(nextSim.queries);
    if (nextSim.auditLog) setAuditLog(nextSim.auditLog);
    setActiveQueryToAnswer(null);
    setQueryResponseText("");
    announce("Discrepancy query response recorded.", "polite");
  };

  const handleCloseQuery = (queryId: string) => {
    const note = queryResolutionNotes[queryId];
    const nextSim = closeSimulationQuery(currentSimSnapshot, {
      queryId,
      actor: getEdcRoleActorLabel(currentRole),
      userRole: currentRole,
      resolutionReason: note,
    });
    if (nextSim.queries) setQueries(nextSim.queries);
    if (nextSim.auditLog) setAuditLog(nextSim.auditLog);
    setQueryResolutionNotes((prev) => {
      const copy = { ...prev };
      delete copy[queryId];
      return copy;
    });
    announce("Discrepancy query closed.", "polite");
  };

  const handleCancelQuery = (queryId: string) => {
    const note = queryResolutionNotes[queryId];
    const nextSim = cancelSimulationQuery(currentSimSnapshot, {
      queryId,
      actor: getEdcRoleActorLabel(currentRole),
      userRole: currentRole,
      resolutionReason: note,
    });
    if (nextSim.queries) setQueries(nextSim.queries);
    if (nextSim.auditLog) setAuditLog(nextSim.auditLog);
    setQueryResolutionNotes((prev) => {
      const copy = { ...prev };
      delete copy[queryId];
      return copy;
    });
    announce("Discrepancy query cancelled.", "polite");
  };

  const handleReopenQuery = (queryId: string) => {
    const note = queryResolutionNotes[queryId];
    const nextSim = reopenSimulationQuery(currentSimSnapshot, {
      queryId,
      actor: getEdcRoleActorLabel(currentRole),
      userRole: currentRole,
      reason: note,
    });
    if (nextSim.queries) setQueries(nextSim.queries);
    if (nextSim.auditLog) setAuditLog(nextSim.auditLog);
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
    if (importedSim.availableSubjects) {
      setAvailableSubjects(importedSim.availableSubjects);
      if (
        source === "odm" &&
        importedSim.availableSubjects.length > 0 &&
        !importedSim.availableSubjects.includes(subjectId)
      ) {
        setSubjectId(importedSim.availableSubjects[0]);
      }
    }
    if (importedSim.formValues) setFormValues(importedSim.formValues);
    if (importedSim.auditLog) setAuditLog(importedSim.auditLog);
    if (importedSim.signatures) setSignatures(importedSim.signatures);
    if (importedSim.queries) setQueries(importedSim.queries);
    if (importedSim.lockedForms) setLockedForms(importedSim.lockedForms);
    if (importedSim.sdvMap) setSdvMap(importedSim.sdvMap);
  };

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

  const activeForm =
    study.forms.find((f) => f.id === activeFormId) || study.forms[0];
  const formLockKey = `${subjectId}_${activeVisitId}_${activeForm?.id || ""}`;
  const isCurrentFormLocked = lockedForms[formLockKey]?.locked || false;

  // Values for the active subject, keyed by both field id and variable name,
  // plus cross-visit keys. Shared by formula evaluation, edit checks and the
  // conditional visibility runtime so all three see identical inputs.
  const subjectVals = useMemo(() => {
    const vals: Record<string, string | number | boolean | null | undefined> =
      {};
    if (!activeForm) return vals;

    activeForm.sections
      .flatMap((s) => s.fields)
      .forEach((f) => {
        const key = `${subjectId}_${activeVisitId}_${f.id}`;
        vals[f.id] = formValues[key];
        vals[f.variableName] = formValues[key];
      });

    Object.entries(formValues).forEach(([key, val]) => {
      if (key.startsWith(`${subjectId}_`)) {
        vals[key.replace(`${subjectId}_`, "")] = val;
      }
    });

    return vals;
  }, [activeForm, formValues, subjectId, activeVisitId]);

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
      activeVisitId
    );
  }, [activeForm, subjectVals, activeVisitId]);

  // Evaluate dynamic formulas and edit checks when formValues change
  useEffect(() => {
    if (!activeForm) return;

    const fields = activeForm.sections.flatMap((s) => s.fields);

    // 1. Evaluate Calculated Fields
    fields.forEach((field) => {
      if (field.dataType === "calculated" && field.calculationFormula) {
        const evalRes = evaluateFormula({
          formula: field.calculationFormula,
          fieldValues: subjectVals,
          fieldsList: fields,
        });
        const calculatedVal = evalRes.success ? evalRes.data.value : null;
        const key = `${subjectId}_${activeVisitId}_${field.id}`;
        if (formValues[key] !== calculatedVal) {
          setFormValues((prev) => ({ ...prev, [key]: calculatedVal }));
        }
      }
    });

    // 2. Evaluate Dynamic Edit Check Rules
    (activeForm.rules || []).forEach((rule) => {
      const isTriggered = evaluateRule(
        rule,
        subjectVals,
        fields,
        activeVisitId
      );

      if (isTriggered && rule.actionType === "raise_query") {
        setQueries((prevQueries) => {
          const queryExists = prevQueries.some(
            (q) =>
              q.subjectId === subjectId &&
              q.visitId === activeVisitId &&
              q.ruleId === rule.id &&
              q.status !== "Cancelled"
          );

          if (queryExists) return prevQueries;

          const targetF = fields.find((f) => f.id === rule.targetFieldId);
          const newQuery: EDCQuery = {
            id: generateQueryId(),
            fieldId: rule.targetFieldId,
            fieldName: targetF?.variableName || "FIELD",
            ruleId: rule.id,
            formId: activeForm.id,
            visitId: activeVisitId,
            subjectId,
            status: "Open",
            severity: rule.querySeverity || "warning",
            message: rule.queryMessage || `Edit check ${rule.name} failed.`,
            raisedBy: "CRF Studio Auto-Linter Engine",
            raisedAt: new Date().toISOString(),
          };
          return [...prevQueries, newQuery];
        });
      }
    });
  }, [
    formValues,
    activeForm,
    activeVisitId,
    subjectId,
    evaluateFormula,
    subjectVals,
  ]);

  const handleFieldChange = (
    field: CRFField,
    rawValue: string | number | boolean | null
  ) => {
    if (isCurrentFormLocked && currentRole !== "Principal Investigator") {
      alert(
        "This form has been locked by the Principal Investigator. Edits are disabled."
      );
      return;
    }

    const key = `${subjectId}_${activeVisitId}_${field.id}`;
    const previousVal = formValues[key] ?? null;

    // Prompt for 21 CFR Part 11 Reason for Change if modifying existing non-empty value
    if (
      previousVal !== null &&
      previousVal !== rawValue &&
      previousVal !== ""
    ) {
      setPendingChange({
        field,
        oldVal: previousVal,
        newVal: rawValue,
      });
      return;
    }

    applyValueChange(field, previousVal, rawValue, "Initial Entry");
  };

  const applyValueChange = (
    field: CRFField,
    oldVal: string | number | boolean | null,
    newVal: string | number | boolean | null,
    reason: string
  ) => {
    if (!activeForm) return;
    const key = `${subjectId}_${activeVisitId}_${field.id}`;
    setFormValues((prev) => ({ ...prev, [key]: newVal }));

    const auditEntry: AuditTrailEntry = {
      id: generateAuditId(),
      timestamp: new Date().toISOString(),
      subjectId,
      formId: activeForm.id,
      fieldId: field.id,
      fieldName: field.variableName,
      previousValue: oldVal,
      newValue: newVal,
      changedBy: getEdcRoleActorLabel(currentRole),
      userRole: currentRole,
      reasonForChange: reason,
    };

    setAuditLog((prev) => [auditEntry, ...prev]);
    setPendingChange(null);
  };

  // Toggle Source Data Verification (SDV) for a field
  const handleToggleSdv = (fieldId: string, fieldName: string) => {
    if (!activeForm) return;
    const key = `${subjectId}_${activeVisitId}_${fieldId}`;
    const isAlreadyVerified = sdvMap[key]?.verified || false;

    const newVerified = !isAlreadyVerified;
    setSdvMap((prev) => ({
      ...prev,
      [key]: {
        verified: newVerified,
        timestamp: new Date().toISOString(),
        auditedBy: "CRA Monitor",
      },
    }));

    const auditEntry: AuditTrailEntry = {
      id: generateAuditId(),
      timestamp: new Date().toISOString(),
      subjectId,
      formId: activeForm.id,
      fieldId,
      fieldName,
      previousValue: isAlreadyVerified ? "SDV Verified" : "Unverified",
      newValue: newVerified ? "SDV Verified" : "Unverified",
      changedBy: "CRA Monitor",
      userRole: "CRA Monitor",
      reasonForChange: newVerified
        ? "Source Data Verification (SDV) against medical records completed"
        : "SDV verification revoked",
    };
    setAuditLog((prev) => [auditEntry, ...prev]);
  };

  // Toggle Form Lock (PI)
  const handleToggleLockForm = () => {
    if (!activeForm) return;
    const key = formLockKey;
    const currentlyLocked = lockedForms[key]?.locked || false;
    const newLocked = !currentlyLocked;

    setLockedForms((prev) => ({
      ...prev,
      [key]: {
        locked: newLocked,
        lockedBy: "Dr. Sarah Jenkins, M.D. (PI)",
        timestamp: new Date().toISOString(),
      },
    }));

    if (newLocked) {
      const signature: ElectronicSignature = {
        id: generateSignatureId(),
        subjectId,
        formId: activeForm.id,
        visitId: activeVisitId,
        signedBy: "Dr. Sarah Jenkins, M.D. (Investigator)",
        userRole: "Principal Investigator",
        timestamp: new Date().toISOString(),
        meaning: "Data Lock",
        // A random reference token: nothing is hashed or signed (#3617).
        digest: generateId("sim_"),
      };
      setSignatures((prev) => [...prev, signature]);
    }
  };

  // 3-Tier Missing Data & Date Validation Engine (Save / Complete Form)
  const handleSaveForm = () => {
    if (!activeForm) return;

    const fields = activeForm.sections.flatMap((s) => s.fields);
    const newErrors: Record<string, string> = {};
    const hardStopVars: string[] = [];
    const autoQueryVars: string[] = [];
    const newQueriesToRaise: EDCQuery[] = [];

    fields.forEach((field) => {
      const key = `${subjectId}_${activeVisitId}_${field.id}`;
      const val = formValues[key];
      const hasNullFlavor = isCdiscNullFlavor(val);
      const isEmpty = val === null || val === undefined || val === "";

      // A field a conditional rule has taken off screen is never validated
      // (#670). Requiring an invisible answer would make the form
      // unsubmittable with no way for the investigator to resolve it. The
      // captured value is left untouched, not cleared.
      const fieldState = conditionalState?.fields[field.id];
      if (fieldState && !fieldState.visible) return;

      // 1. Missing data checks. Requiredness comes from the same resolved
      // state the control rendered from, so a rule-required field is enforced
      // exactly when it is shown as required.
      const isRuleRequired = fieldState?.required ?? field.required;
      const isHardStop =
        field.requirementTier === "hard_stop" ||
        (!field.requirementTier && isRuleRequired);
      const isAutoQuery = field.requirementTier === "auto_query";

      if (isEmpty && !hasNullFlavor) {
        if (isHardStop) {
          newErrors[field.id] =
            `Mandatory variable '${field.variableName}' is missing (Hard Stop).`;
          hardStopVars.push(field.variableName);
        } else if (isAutoQuery) {
          autoQueryVars.push(field.variableName);
          const newQuery: EDCQuery = {
            id: generateQueryId(),
            fieldId: field.id,
            fieldName: field.variableName,
            ruleId: `rule_auto_query_${field.id}`,
            formId: activeForm.id,
            visitId: activeVisitId,
            subjectId,
            status: "Open",
            severity: "warning",
            message: `Auto-Query: Required clinical variable '${field.variableName}' (${field.label}) is missing upon form submission.`,
            raisedBy: "3-Tier Missing Data Engine",
            raisedAt: new Date().toISOString(),
          };
          newQueriesToRaise.push(newQuery);
        }
      }

      // 2. Range checks (#1200). An out-of-range value follows the same tier
      // as a missing one: Hard Stop blocks the save, anything else saves and
      // raises a discrepancy query for the site to confirm or correct.
      if (
        !isEmpty &&
        !hasNullFlavor &&
        (field.dataType === "number" || field.dataType === "integer")
      ) {
        const num = Number(val);
        const belowMin = field.minValue !== undefined && num < field.minValue;
        const aboveMax = field.maxValue !== undefined && num > field.maxValue;
        if (Number.isFinite(num) && (belowMin || aboveMax)) {
          const expected =
            field.minValue !== undefined && field.maxValue !== undefined
              ? `between ${field.minValue} and ${field.maxValue}`
              : field.minValue !== undefined
                ? `at least ${field.minValue}`
                : `at most ${field.maxValue}`;
          const rangeMsg = `${field.variableName} is ${num}; expected ${expected}${field.unit ? ` ${field.unit}` : ""}.`;
          if (isHardStop) {
            newErrors[field.id] = `${rangeMsg} Correct it to save (Hard Stop).`;
            hardStopVars.push(field.variableName);
          } else {
            autoQueryVars.push(field.variableName);
            newQueriesToRaise.push({
              id: generateQueryId(),
              fieldId: field.id,
              fieldName: field.variableName,
              ruleId: `rule_range_${field.id}`,
              formId: activeForm.id,
              visitId: activeVisitId,
              subjectId,
              status: "Open",
              severity: "warning",
              message: `Range check: ${rangeMsg} Please confirm or correct.`,
              raisedBy: "Range Check Engine",
              raisedAt: new Date().toISOString(),
            });
          }
        }
      }

      // 3. Date validation (Precision dates & future date checks)
      if (
        !isEmpty &&
        !hasNullFlavor &&
        (field.dataType === "precision_date" ||
          field.dataType === "date" ||
          field.dataType === "partial_date")
      ) {
        const valRes = validatePrecisionDate(String(val), {
          allowPartial:
            field.allowPartial ??
            (field.dataType === "partial_date" ||
              field.dataType === "precision_date"),
          preventFutureDate: field.preventFutureDate,
          allowNullFlavor: field.allowNullFlavor,
        });
        if (!valRes.isValid) {
          newErrors[field.id] = valRes.error || "Date validation failed.";
          hardStopVars.push(field.variableName);
        }
      }
    });

    setValidationErrors(newErrors);

    if (newQueriesToRaise.length > 0) {
      setQueries((prev) => {
        const existingKeys = new Set(
          prev.map(
            (q) => `${q.subjectId}_${q.visitId}_${q.fieldId}_${q.ruleId}`
          )
        );
        const filteredNew = newQueriesToRaise.filter(
          (q) =>
            !existingKeys.has(
              `${q.subjectId}_${q.visitId}_${q.fieldId}_${q.ruleId}`
            )
        );
        return [...prev, ...filteredNew];
      });
    }

    if (hardStopVars.length > 0) {
      const errMsg = `Form submission blocked! ${hardStopVars.length} field(s) failed hard-stop validation.`;
      setSaveStatus({
        type: "error",
        message: errMsg,
        hardStops: hardStopVars,
      });
      announce(errMsg, "assertive");
      return;
    }

    const successMsg = `Form saved successfully for Subject ${subjectId} at ${activeVisitId}.${
      autoQueryVars.length > 0
        ? ` Registered ${autoQueryVars.length} auto-query ticket(s).`
        : ""
    }`;
    setSaveStatus({
      type: "success",
      message: successMsg,
      autoQueries: autoQueryVars,
    });
    announce(successMsg, "polite");
  };

  const isFormSigned = signatures.some(
    (s) =>
      s.subjectId === subjectId &&
      s.formId === activeForm?.id &&
      s.visitId === activeVisitId
  );

  const activeFormQueries = queries.filter(
    (q) =>
      q.subjectId === subjectId &&
      q.formId === activeForm?.id &&
      q.visitId === activeVisitId
  );

  // Compute Subject Form Status Matrix
  const getSubjectFormStatus = (
    subjId: string,
    visitId: string,
    formId: string
  ): SubjectFormStatus => {
    const fKey = `${subjId}_${visitId}_${formId}`;
    const isLocked = lockedForms[fKey]?.locked || false;
    const formDef = study.forms.find((f) => f.id === formId);
    const formFields = formDef ? formDef.sections.flatMap((s) => s.fields) : [];

    let hasValues = false;
    let sdvCount = 0;
    formFields.forEach((f) => {
      const vKey = `${subjId}_${visitId}_${f.id}`;
      if (
        formValues[vKey] !== undefined &&
        formValues[vKey] !== null &&
        formValues[vKey] !== ""
      ) {
        hasValues = true;
      }
      if (sdvMap[vKey]?.verified) {
        sdvCount++;
      }
    });

    const openQueriesCount = queries.filter(
      (q) =>
        q.subjectId === subjId &&
        q.visitId === visitId &&
        q.formId === formId &&
        q.status === "Open"
    ).length;

    const isSdvVerified =
      formFields.length > 0 && sdvCount >= formFields.length;

    return {
      subjectId: subjId,
      visitId,
      formId,
      isComplete: hasValues,
      isLocked,
      isSdvVerified,
      openQueriesCount,
    };
  };

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
            ] as UserRole[]
          ).map((role) => (
            <button
              key={role}
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

        {isMonitorOrDm && (
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
                        aria-label="Confirm new subject"
                        onClick={() => {
                          if (newSubjectInput.trim()) {
                            setAvailableSubjects([
                              ...availableSubjects,
                              newSubjectInput.trim(),
                            ]);
                            setSubjectId(newSubjectInput.trim());
                            setIsAddingSubject(false);
                            setNewSubjectInput("");
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
                        value={subjectId}
                        onChange={(e) => setSubjectId(e.target.value)}
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
                    value={activeVisitId}
                    onChange={(e) => setActiveVisitId(e.target.value)}
                    className="w-full px-3 py-1.5 studio-surface-subtle border studio-border-strong rounded-xl text-xs studio-fg-primary font-mono studio-focus-input focus:outline-none"
                  >
                    {study.visits.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} (Day {v.targetDay})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Form Selector */}
                <div>
                  <label
                    htmlFor="edc-crf-form-select"
                    className="block text-[10px] font-mono studio-fg-muted mb-1"
                  >
                    CRF Form
                  </label>
                  <select
                    id="edc-crf-form-select"
                    value={activeFormId}
                    onChange={(e) => setActiveFormId(e.target.value)}
                    className="w-full px-3 py-1.5 studio-surface-subtle border studio-border-strong rounded-xl text-xs studio-fg-primary font-mono studio-focus-input focus:outline-none"
                  >
                    {study.forms.map((f) => (
                      <option key={f.id} value={f.id}>
                        [{f.domain}] {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Form Header Card with PI Lock and SDV Actions */}
              <div className="p-5 rounded-2xl studio-surface-subtle border studio-border-default space-y-5">
                <div className="flex items-start justify-between gap-4 border-b studio-border-default pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-xs font-mono font-bold studio-accent-cyan-strong border">
                        {activeForm.domain}
                      </span>
                      <h2 className="text-base font-bold studio-fg-primary font-mono">
                        {activeForm.name}
                      </h2>
                      {isCurrentFormLocked && (
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

                  <div className="flex items-center gap-2">
                    <TooltipButton
                      onClick={handleSaveForm}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-xs font-bold studio-btn-cyan transition-all shadow-sm"
                      tooltip="Save Form Data and run 3-Tier Missing Data Engine"
                    >
                      <IconDeviceFloppy className="w-4 h-4" />
                      <span>Save Form</span>
                    </TooltipButton>

                    {currentRole === "Principal Investigator" && (
                      <button
                        onClick={handleToggleLockForm}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition-all shadow-sm ${
                          isCurrentFormLocked
                            ? "studio-surface-muted studio-hover-active studio-fg-primary border studio-border-strong"
                            : "studio-btn-sky"
                        }`}
                      >
                        {isCurrentFormLocked ? (
                          <>
                            <IconLockOpen className="w-4 h-4" />
                            <span>Unlock Form</span>
                          </>
                        ) : (
                          <>
                            <IconLock className="w-4 h-4" />
                            <span>Lock &amp; Sign (PI)</span>
                          </>
                        )}
                      </button>
                    )}

                    {isFormSigned && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl studio-accent-emerald border font-mono text-xs">
                        <IconShieldCheck className="w-4 h-4" />
                        <span>Signed</span>
                      </div>
                    )}
                  </div>
                </div>

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

                        const key = `${subjectId}_${activeVisitId}_${field.id}`;
                        const currentVal = formValues[key];
                        const isSdv = sdvMap[key]?.verified || false;
                        const fieldQueries = activeFormQueries.filter(
                          (q) => q.fieldId === field.id && q.status === "Open"
                        );
                        const fieldError = validationErrors[field.id];
                        const hasNullFlavor = isCdiscNullFlavor(currentVal);
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
                                    onClick={() =>
                                      handleToggleSdv(
                                        field.id,
                                        field.variableName
                                      )
                                    }
                                    className={`px-1.5 py-0.5 rounded text-[9px] font-mono transition-colors border ${
                                      isSdv
                                        ? "studio-accent-emerald-strong"
                                        : "studio-surface-card studio-fg-muted studio-border-default studio-hover-fg-primary"
                                    }`}
                                    tooltip="Source Data Verification"
                                  >
                                    {isSdv ? "✓ SDV Done" : "SDV Verify"}
                                  </TooltipButton>
                                )}

                                {/* CDISC Null Flavor Toggle Pills */}
                                {(field.allowNullFlavor || true) && (
                                  <div className="flex items-center gap-0.5 studio-surface-card p-0.5 rounded-lg border studio-border-default">
                                    {(["ND", "NA", "UNK"] as const).map(
                                      (nf) => {
                                        const isSelectedNf = currentVal === nf;
                                        return (
                                          <TooltipButton
                                            key={nf}
                                            type="button"
                                            onClick={() => {
                                              if (isSelectedNf) {
                                                handleFieldChange(field, null);
                                              } else {
                                                handleFieldChange(field, nf);
                                              }
                                            }}
                                            disabled={
                                              isCurrentFormLocked &&
                                              currentRole !==
                                                "Principal Investigator"
                                            }
                                            className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold transition-all border ${
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
                            ) : hasNullFlavor ? (
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
                                  disabled={
                                    isCurrentFormLocked &&
                                    currentRole !== "Principal Investigator"
                                  }
                                  className="text-[10px] studio-fg-muted studio-hover-fg-primary underline font-mono"
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
                                          disabled={
                                            isCurrentFormLocked &&
                                            currentRole !==
                                              "Principal Investigator"
                                          }
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
                                          disabled={
                                            isCurrentFormLocked &&
                                            currentRole !==
                                              "Principal Investigator"
                                          }
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
                                          disabled={
                                            isCurrentFormLocked &&
                                            currentRole !==
                                              "Principal Investigator"
                                          }
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
                                    disabled={
                                      isCurrentFormLocked &&
                                      currentRole !== "Principal Investigator"
                                    }
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
                                    disabled={
                                      isCurrentFormLocked &&
                                      currentRole !== "Principal Investigator"
                                    }
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
                                        currentVal !== null
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
                                      disabled={
                                        isCurrentFormLocked &&
                                        currentRole !== "Principal Investigator"
                                      }
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
                                    disabled={
                                      isCurrentFormLocked &&
                                      currentRole !== "Principal Investigator"
                                    }
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
                                          disabled={
                                            isCurrentFormLocked &&
                                            currentRole !==
                                              "Principal Investigator"
                                          }
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
                                    disabled={
                                      isCurrentFormLocked &&
                                      currentRole !== "Principal Investigator"
                                    }
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
                                            disabled={
                                              isCurrentFormLocked &&
                                              currentRole !==
                                                "Principal Investigator"
                                            }
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
                    onClick={handleSaveForm}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-mono text-xs font-bold studio-btn-cyan transition-all shadow-sm"
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
                          const formsForVisit = study.forms.filter((f) =>
                            v.assignedFormIds.includes(f.id)
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

                {isMonitorOrDm && (
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
                        {isMonitorOrDm ? (
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
                            (currentRole === "Site Coordinator" ||
                              currentRole === "Principal Investigator") && (
                              <button
                                type="button"
                                onClick={() => setActiveQueryToAnswer(q)}
                                className="px-3 py-1.5 rounded-lg studio-btn-cyan font-bold text-xs"
                              >
                                Respond to Query
                              </button>
                            )}

                          {q.status === "Open" && isMonitorOrDm && (
                            <button
                              type="button"
                              onClick={() => handleCancelQuery(q.id)}
                              className="px-3 py-1.5 rounded-lg studio-surface-muted border studio-border-strong studio-fg-secondary studio-hover-fg-primary text-xs font-bold"
                            >
                              Cancel Query
                            </button>
                          )}

                          {q.status === "Answered" && isMonitorOrDm && (
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
                            isMonitorOrDm && (
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
                        Variable
                      </th>
                      <th scope="col" className="p-2.5">
                        Previous Value
                      </th>
                      <th scope="col" className="p-2.5">
                        New Value
                      </th>
                      <th scope="col" className="p-2.5">
                        User Role
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
                          {entry.userRole}
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
              <label className="block text-[10px] font-mono studio-fg-muted mb-1">
                Reason for Change Justification:
              </label>
              <textarea
                rows={2}
                value={changeReasonInput}
                onChange={(e) => setChangeReasonInput(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs studio-surface-subtle border studio-border-strong rounded-lg studio-fg-primary font-sans studio-focus-input focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setPendingChange(null)}
                className="px-3 py-1.5 rounded-lg studio-surface-muted studio-hover-active studio-fg-secondary text-xs font-mono"
              >
                Cancel
              </button>
              <button
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
          defaultSubjectId={subjectId}
          defaultVisitId={activeVisitId}
          defaultFormId={activeFormId}
          currentRole={currentRole}
          onClose={() => setIsManualQueryModalOpen(false)}
          onSubmit={handleRaiseManualQuery}
        />
      )}
    </div>
  );
};
