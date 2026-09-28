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
import { evaluateRule } from "@/lib/crf/ast-evaluator";
import {
  resolveFormConditionalState,
  describeFieldConditionalState,
} from "@/lib/crf";
import { useCrfService } from "@/hooks/useCrfService";
import { generateId } from "@/lib/utils";
import {
  parsePrecisionDate,
  formatPrecisionDate,
  isCdiscNullFlavor,
  validatePrecisionDate,
  CDISC_NULL_FLAVORS,
} from "@/lib/crf/precision-date";
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

function generateAuditId(): string {
  return generateId("aud_");
}

function generateSignatureId(): string {
  return generateId("sig_");
}

function generateQueryId(): string {
  return generateId("qry_");
}

export interface LiveEdcSimulatorProps {
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

  const lastEmittedStateRef = React.useRef<EdcSimulationState | null>(null);
  const activeSimState = simulationState ?? study.simulationState;

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (activeSimState && activeSimState !== lastEmittedStateRef.current) {
      if (activeSimState.formValues !== undefined)
        setFormValues(activeSimState.formValues);
      if (activeSimState.sdvMap !== undefined) setSdvMap(activeSimState.sdvMap);
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
  }, [activeSimState]);

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
      lastEmittedStateRef.current = nextState;
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
      changedBy:
        currentRole === "Principal Investigator"
          ? "Dr. Jenkins (PI)"
          : currentRole === "CRA Monitor"
            ? "CRA Monitor"
            : "Clinical Coordinator",
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
        digest: `SHA256-${Math.random().toString(36).substring(2)}${Math.random().toString(36).substring(2)}`,
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
    <div className="flex-1 flex flex-col h-full bg-zinc-950 p-4 sm:p-6 overflow-y-auto space-y-6">
      {/* Top Banner & Multi-Role Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 sm:pb-6 border-b border-zinc-800">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shrink-0">
              <IconShieldCheck className="w-5 h-5" />
            </span>
            <h2 className="text-base sm:text-lg font-bold text-white font-mono truncate">
              Live 21 CFR Part 11 EDC Simulation Mode
            </h2>
          </div>
          <p className="text-xs text-zinc-400 font-sans mt-1">
            Test live subject patient entry, CRA source data verification (SDV),
            investigator locking, and longitudinal visit matrix.
          </p>
        </div>

        {/* User Role Switcher */}
        <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 p-1 rounded-xl shadow-inner max-w-full overflow-x-auto scrollbar-none">
          <span className="text-[10px] font-mono text-zinc-500 uppercase px-1.5 hidden sm:inline">
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
                  ? "bg-brand-cyan text-black font-bold shadow-sm"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              {role}
            </button>
          ))}
        </div>
      </div>

      {/* Sub-View Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-2 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setSubView("form_entry")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono whitespace-nowrap transition-all ${
            subView === "form_entry"
              ? "bg-brand-cyan text-black font-bold"
              : "bg-zinc-900 text-zinc-400 hover:text-white"
          }`}
        >
          <IconFileText className="w-4 h-4" />
          <span>Patient Form Entry</span>
        </button>
        <button
          onClick={() => setSubView("subject_matrix")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono whitespace-nowrap transition-all ${
            subView === "subject_matrix"
              ? "bg-brand-cyan text-black font-bold"
              : "bg-zinc-900 text-zinc-400 hover:text-white"
          }`}
        >
          <IconTable className="w-4 h-4" />
          <span>Subject Status Matrix</span>
        </button>
        <button
          onClick={() => setSubView("queries")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono whitespace-nowrap transition-all ${
            subView === "queries"
              ? "bg-brand-cyan text-black font-bold"
              : "bg-zinc-900 text-zinc-400 hover:text-white"
          }`}
        >
          <IconMessageCircleQuestion className="w-4 h-4" />
          <span>
            Discrepancy Queries (
            {queries.filter((q) => q.status === "Open").length})
          </span>
        </button>
        <button
          onClick={() => setSubView("audit_trail")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono whitespace-nowrap transition-all ${
            subView === "audit_trail"
              ? "bg-brand-cyan text-black font-bold"
              : "bg-zinc-900 text-zinc-400 hover:text-white"
          }`}
        >
          <IconHistory className="w-4 h-4" />
          <span>Part 11 Audit Trail ({auditLog.length})</span>
        </button>
      </div>

      {/* VIEW 1: PATIENT FORM ENTRY */}
      {subView === "form_entry" && activeForm && (
        <div className="space-y-6">
          {/* Protocol Navigation Context: Subject, Visit, Form */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800">
            {/* Subject ID Selector */}
            <div>
              <label className="block text-[10px] font-mono text-zinc-400 mb-1">
                Active Subject / Patient ID
              </label>
              {isAddingSubject ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newSubjectInput}
                    onChange={(e) => setNewSubjectInput(e.target.value)}
                    placeholder="e.g. 001-104"
                    className="w-full px-2.5 py-1 bg-zinc-950 border border-zinc-700 rounded-lg text-xs text-white font-mono"
                  />
                  <button
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
                    className="p-1 rounded bg-brand-cyan text-black"
                  >
                    <IconCheck className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <select
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-zinc-950 border border-zinc-700 rounded-xl text-xs text-white font-mono focus:border-brand-cyan focus:outline-none"
                  >
                    {availableSubjects.map((s) => (
                      <option key={s} value={s}>
                        Subject: {s}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => setIsAddingSubject(true)}
                    className="px-2.5 py-1 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-mono"
                    title="Enroll New Simulated Subject"
                  >
                    <IconPlus className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Visit Selector */}
            <div>
              <label className="block text-[10px] font-mono text-zinc-400 mb-1">
                Protocol Visit
              </label>
              <select
                value={activeVisitId}
                onChange={(e) => setActiveVisitId(e.target.value)}
                className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-700 rounded-xl text-xs text-white font-mono focus:border-brand-cyan focus:outline-none"
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
              <label className="block text-[10px] font-mono text-zinc-400 mb-1">
                CRF Form
              </label>
              <select
                value={activeFormId}
                onChange={(e) => setActiveFormId(e.target.value)}
                className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-700 rounded-xl text-xs text-white font-mono focus:border-brand-cyan focus:outline-none"
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
          <div className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800 space-y-5">
            <div className="flex items-start justify-between gap-4 border-b border-zinc-800 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-brand-cyan/15 text-brand-cyan border border-brand-cyan/30">
                    {activeForm.domain}
                  </span>
                  <h2 className="text-base font-bold text-white font-mono">
                    {activeForm.name}
                  </h2>
                  {isCurrentFormLocked && (
                    <span className="inline-flex items-center gap-1 font-mono text-[10px] text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                      <IconLock className="w-3 h-3" />
                      <span>Locked (PI)</span>
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-400 font-sans">
                  {activeForm.description}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleSaveForm}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-xs font-bold bg-brand-cyan text-black hover:bg-white transition-all shadow-sm"
                  title="Save Form Data and run 3-Tier Missing Data Engine"
                >
                  <IconDeviceFloppy className="w-4 h-4" />
                  <span>Save Form</span>
                </button>

                {currentRole === "Principal Investigator" && (
                  <button
                    onClick={handleToggleLockForm}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition-all shadow-sm ${
                      isCurrentFormLocked
                        ? "bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700"
                        : "bg-sky-500 text-black hover:bg-white"
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
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-xs">
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
                    ? "bg-red-500/10 border-red-500/40 text-red-300"
                    : "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
                }`}
              >
                {saveStatus.type === "error" ? (
                  <IconAlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                ) : (
                  <IconCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                )}
                <div className="flex-1 space-y-1">
                  <div className="font-bold">{saveStatus.message}</div>
                  {saveStatus.hardStops && saveStatus.hardStops.length > 0 && (
                    <div className="text-[11px] text-red-400 font-sans">
                      Hard-stop blocked fields:{" "}
                      {saveStatus.hardStops.join(", ")}
                    </div>
                  )}
                  {saveStatus.autoQueries &&
                    saveStatus.autoQueries.length > 0 && (
                      <div className="text-[11px] text-amber-300 font-sans">
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
                <h3 className="text-xs font-bold text-zinc-300 font-mono border-b border-zinc-800/60 pb-1.5">
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
                            ? "bg-red-500/10 border-red-500/60 ring-1 ring-red-500/30"
                            : fieldQueries.length > 0
                              ? "bg-amber-500/5 border-amber-500/40 ring-1 ring-amber-500/20"
                              : "bg-zinc-950/70 border-zinc-800/80"
                        }`}
                        style={{ gridColumn: `span ${field.columnSpan}` }}
                      >
                        {/* Field Header */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <label
                              htmlFor={inputId}
                              className="block text-xs font-semibold text-zinc-200 cursor-pointer"
                            >
                              {field.label}
                              {isFieldRequired && (
                                <span
                                  className="text-red-400 ml-0.5"
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
                              <span className="text-[10px] font-mono text-zinc-500">
                                {field.variableName}
                              </span>

                              {/* Requirement Tier Badge */}
                              <span
                                className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold border ${
                                  field.requirementTier === "auto_query"
                                    ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                                    : field.requirementTier === "hard_stop" ||
                                        (!field.requirementTier &&
                                          isFieldRequired)
                                      ? "bg-red-500/15 text-red-300 border-red-500/30"
                                      : "bg-zinc-900 text-zinc-400 border-zinc-800"
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
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                                  <IconShieldCheck className="w-3 h-3" />
                                  <span>SDV</span>
                                </span>
                              )}

                              {field.isBlinded && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-mono text-indigo-400 bg-indigo-500/10 border border-indigo-500/20">
                                  <span>Blinded</span>
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {/* CRA SDV Toggle */}
                            {currentRole === "CRA Monitor" && (
                              <button
                                onClick={() =>
                                  handleToggleSdv(field.id, field.variableName)
                                }
                                className={`px-1.5 py-0.5 rounded text-[9px] font-mono transition-colors border ${
                                  isSdv
                                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                                    : "bg-zinc-900 text-zinc-500 border-zinc-800 hover:text-white"
                                }`}
                                title="Source Data Verification"
                              >
                                {isSdv ? "✓ SDV Done" : "SDV Verify"}
                              </button>
                            )}

                            {/* CDISC Null Flavor Toggle Pills */}
                            {(field.allowNullFlavor || true) && (
                              <div className="flex items-center gap-0.5 bg-zinc-900/80 p-0.5 rounded-lg border border-zinc-800">
                                {(["ND", "NA", "UNK"] as const).map((nf) => {
                                  const isSelectedNf = currentVal === nf;
                                  return (
                                    <button
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
                                        currentRole !== "Principal Investigator"
                                      }
                                      className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold transition-all border ${
                                        isSelectedNf
                                          ? "bg-brand-cyan text-black border-brand-cyan font-black"
                                          : "bg-zinc-950 text-zinc-400 border-zinc-850 hover:text-zinc-200"
                                      }`}
                                      title={`Set Null Flavor: ${CDISC_NULL_FLAVORS[nf]} (${nf})`}
                                    >
                                      {nf}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Field Input Area */}
                        {isBlindedForUser ? (
                          <div className="p-2.5 bg-zinc-900/90 border border-zinc-800 rounded-lg text-zinc-400 font-mono text-xs flex items-center gap-2">
                            <IconEyeOff className="w-4 h-4 text-indigo-400 shrink-0" />
                            <span>
                              [MASKED PROTOCOL DATA: BLINDED TO SPONSOR]
                            </span>
                          </div>
                        ) : hasNullFlavor ? (
                          <div className="p-2 bg-zinc-900 border border-brand-cyan/40 rounded-lg text-brand-cyan font-mono text-xs flex items-center justify-between">
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
                              className="text-[10px] text-zinc-400 hover:text-white underline font-mono"
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
                                      className="block text-[9px] font-mono text-zinc-500 mb-0.5"
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
                                          parsedPrecision?.month !== undefined
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
                                        currentRole !== "Principal Investigator"
                                      }
                                      className="w-full px-2 py-1 text-xs bg-zinc-900 border border-zinc-700 rounded text-white font-mono focus:border-brand-cyan focus:outline-none disabled:opacity-50"
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
                                      className="block text-[9px] font-mono text-zinc-500 mb-0.5"
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
                                              parsedPrecision?.month === null
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
                                        currentRole !== "Principal Investigator"
                                      }
                                      className="w-full px-2 py-1 text-xs bg-zinc-900 border border-zinc-700 rounded text-white font-mono focus:border-brand-cyan focus:outline-none disabled:opacity-50"
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
                                      className="block text-[9px] font-mono text-zinc-500 mb-0.5"
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
                                          parsedPrecision?.month !== undefined
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
                                        currentRole !== "Principal Investigator"
                                      }
                                      className="w-full px-2 py-1 text-xs bg-zinc-900 border border-zinc-700 rounded text-white font-mono focus:border-brand-cyan focus:outline-none disabled:opacity-50"
                                    />
                                  </div>
                                </div>

                                <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 pt-0.5">
                                  <span>
                                    ISO:{" "}
                                    <strong className="text-brand-cyan">
                                      {String(currentVal || "—")}
                                    </strong>
                                  </span>
                                  {field.preventFutureDate && (
                                    <span className="text-amber-400/90">
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
                                aria-invalid={fieldError ? "true" : undefined}
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
                                className="w-full px-2.5 py-1.5 text-xs bg-zinc-900 border border-zinc-700 rounded-lg text-white font-sans focus:border-brand-cyan focus:outline-none disabled:opacity-50"
                                placeholder={
                                  field.placeholder || "Enter value..."
                                }
                              />
                            )}

                            {field.dataType === "textarea" && (
                              <textarea
                                id={inputId}
                                rows={2}
                                aria-invalid={fieldError ? "true" : undefined}
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
                                className="w-full px-2.5 py-1.5 text-xs bg-zinc-900 border border-zinc-700 rounded-lg text-white font-sans focus:border-brand-cyan focus:outline-none resize-none disabled:opacity-50"
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
                                  aria-invalid={fieldError ? "true" : undefined}
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
                                  className="w-full px-2.5 py-1.5 text-xs bg-zinc-900 border border-zinc-700 rounded-lg text-white font-mono focus:border-brand-cyan focus:outline-none disabled:opacity-50"
                                  placeholder={field.placeholder || "0"}
                                />
                                {field.unit && (
                                  <span className="absolute right-2.5 top-1.5 text-[11px] font-mono text-zinc-400">
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
                                aria-invalid={fieldError ? "true" : undefined}
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
                                className="w-full px-2.5 py-1.5 text-xs bg-zinc-900 border border-zinc-700 rounded-lg text-white font-mono focus:border-brand-cyan focus:outline-none disabled:opacity-50"
                              />
                            )}

                            {field.dataType === "radio" && (
                              <div
                                id={inputId}
                                role="radiogroup"
                                aria-labelledby={inputId}
                                aria-invalid={fieldError ? "true" : undefined}
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
                                    className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer"
                                  >
                                    <input
                                      type="radio"
                                      name={key}
                                      value={opt.code}
                                      checked={currentVal === opt.code}
                                      onChange={(e) =>
                                        handleFieldChange(field, e.target.value)
                                      }
                                      disabled={
                                        isCurrentFormLocked &&
                                        currentRole !== "Principal Investigator"
                                      }
                                      className="text-brand-cyan focus:ring-0"
                                    />
                                    <span>{opt.label}</span>
                                  </label>
                                ))}
                              </div>
                            )}

                            {field.dataType === "single_select" && (
                              <select
                                id={inputId}
                                aria-invalid={fieldError ? "true" : undefined}
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
                                className="w-full px-2.5 py-1.5 text-xs bg-zinc-900 border border-zinc-700 rounded-lg text-white font-sans focus:border-brand-cyan focus:outline-none disabled:opacity-50"
                              >
                                <option value="">-- Select Option --</option>
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
                                  const selectedArray: string[] = Array.isArray(
                                    currentVal
                                  )
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
                                      className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer"
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
                                        className="text-brand-cyan rounded border-zinc-700 bg-zinc-900 focus:ring-0"
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
                                aria-invalid={fieldError ? "true" : undefined}
                                aria-describedby={
                                  fieldError ? errorId : undefined
                                }
                                className="p-2 rounded-lg bg-brand-cyan/10 border border-brand-cyan/30 flex items-center justify-between font-mono min-h-[34px]"
                              >
                                <span className="text-xs text-brand-cyan font-bold">
                                  {currentVal !== undefined &&
                                  currentVal !== null
                                    ? String(currentVal)
                                    : ""}
                                </span>
                                {field.unit && (
                                  <span className="text-[10px] text-zinc-400">
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
                            className="text-[10px] text-red-400 font-mono mt-1.5 flex items-center gap-1"
                          >
                            <IconAlertTriangle className="w-3 h-3 text-red-400 shrink-0" />
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
            <div className="pt-4 border-t border-zinc-800 flex items-center justify-between">
              <div className="text-xs text-zinc-400 font-mono">
                Active Form: <strong>{activeForm.name}</strong> (
                {activeForm.domain})
              </div>
              <button
                onClick={handleSaveForm}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-mono text-xs font-bold bg-brand-cyan text-black hover:bg-white transition-all shadow-sm"
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
        <div className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white font-mono">
                Longitudinal Subject vs. Visit Progression Matrix
              </h2>
              <p className="text-xs text-zinc-400 font-sans mt-0.5">
                Click any cell to jump into patient form data entry.
              </p>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-mono">
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />{" "}
                Complete
              </span>
              <span className="flex items-center gap-1 text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-400" />{" "}
                Incomplete
              </span>
              <span className="flex items-center gap-1 text-sky-400">
                <span className="w-2 h-2 rounded-full bg-sky-400" /> Locked
              </span>
              <span className="flex items-center gap-1 text-red-400">
                <span className="w-2 h-2 rounded-full bg-red-400" /> Query
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table
              className="w-full text-left font-mono text-xs border-collapse"
              role="grid"
              aria-label="Subject Status Progression Matrix"
            >
              <thead>
                <tr
                  className="border-b border-zinc-800 bg-zinc-950/60 text-zinc-400"
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
                      <div className="text-[10px] text-zinc-500">
                        Day {v.targetDay}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {availableSubjects.map((subj) => (
                  <tr
                    key={subj}
                    role="row"
                    className="hover:bg-zinc-850/40 transition-colors"
                  >
                    <th
                      scope="row"
                      role="rowheader"
                      className="p-3 font-bold text-brand-cyan text-left font-normal"
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
                                <button
                                  key={form.id}
                                  onClick={() => {
                                    setSubjectId(subj);
                                    setActiveVisitId(v.id);
                                    setActiveFormId(form.id);
                                    setSubView("form_entry");
                                  }}
                                  className={`px-2 py-1 rounded text-[10px] font-mono font-bold transition-all border ${
                                    status.openQueriesCount > 0
                                      ? "bg-red-500/20 text-red-400 border-red-500/40 animate-pulse"
                                      : status.isLocked
                                        ? "bg-sky-500/20 text-sky-400 border-sky-500/40"
                                        : status.isComplete
                                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                                          : "bg-zinc-800/80 text-zinc-400 border-zinc-700 hover:text-white"
                                  }`}
                                  title={`Open ${form.name} for ${subj}`}
                                >
                                  <span>{form.domain}</span>
                                  {status.openQueriesCount > 0 && (
                                    <span> !</span>
                                  )}
                                  {status.isLocked && <span> 🔒</span>}
                                </button>
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
        <div className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800 space-y-4">
          <h2 className="text-sm font-bold text-white font-mono">
            Clinical Discrepancy &amp; Query Management Ledger
          </h2>

          {queries.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 font-mono text-xs border border-dashed border-zinc-800 rounded-xl">
              No open queries or validation discrepancies across subjects.
            </div>
          ) : (
            <div className="space-y-3">
              {queries.map((q) => (
                <div
                  key={q.id}
                  className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2 font-mono text-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          q.severity === "error"
                            ? "bg-red-500/20 text-red-400 border border-red-500/30"
                            : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                        }`}
                      >
                        {q.severity}
                      </span>
                      <span className="font-bold text-white">
                        Subject {q.subjectId}
                      </span>
                      <span className="text-zinc-500">
                        • Variable: {q.fieldName}
                      </span>
                    </div>
                    <span className="text-[10px] text-zinc-500">
                      {q.raisedAt.slice(0, 19)}
                    </span>
                  </div>

                  <p className="text-zinc-300 font-sans text-xs">{q.message}</p>

                  {q.response && (
                    <div className="p-2.5 rounded bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-400 font-sans">
                      <span className="font-bold text-zinc-200">
                        Site Response:
                      </span>{" "}
                      {q.response}
                    </div>
                  )}

                  {q.status === "Open" && (
                    <div className="pt-2 flex justify-end gap-2">
                      <button
                        onClick={() => setActiveQueryToAnswer(q)}
                        className="px-3 py-1 rounded bg-brand-cyan text-black font-bold text-xs hover:bg-white"
                      >
                        Respond to Query
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* VIEW 4: PART 11 AUDIT TRAIL */}
      {subView === "audit_trail" && (
        <div className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800 space-y-4">
          <h2 className="text-sm font-bold text-white font-mono">
            21 CFR Part 11 Immutable Audit Trail Log
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-950/60 text-zinc-400">
                  <th className="p-2.5">Timestamp</th>
                  <th className="p-2.5">Subject</th>
                  <th className="p-2.5">Variable</th>
                  <th className="p-2.5">Previous Value</th>
                  <th className="p-2.5">New Value</th>
                  <th className="p-2.5">User Role</th>
                  <th className="p-2.5">Justification Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-850">
                {auditLog.map((entry) => (
                  <tr key={entry.id} className="hover:bg-zinc-850/30">
                    <td className="p-2.5 text-zinc-500 whitespace-nowrap">
                      {entry.timestamp.slice(0, 19)}
                    </td>
                    <td className="p-2.5 text-brand-cyan font-bold">
                      {entry.subjectId}
                    </td>
                    <td className="p-2.5 text-white">{entry.fieldName}</td>
                    <td className="p-2.5 text-zinc-400">
                      {String(entry.previousValue ?? "—")}
                    </td>
                    <td className="p-2.5 text-emerald-400 font-bold">
                      {String(entry.newValue ?? "—")}
                    </td>
                    <td className="p-2.5 text-zinc-300">{entry.userRole}</td>
                    <td className="p-2.5 text-zinc-400 font-sans text-xs">
                      {entry.reasonForChange}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: 21 CFR Part 11 Reason for Change Prompt */}
      {pendingChange && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
              <IconShieldCheck className="w-5 h-5 text-brand-cyan" />
              <span>21 CFR Part 11 Audit Justification</span>
            </h3>
            <p className="text-xs text-zinc-400 font-sans">
              Modifying existing clinical observation data requires a documented
              Reason for Change.
            </p>

            <div className="p-3 rounded bg-zinc-950 border border-zinc-800 font-mono text-xs space-y-1">
              <div>
                Variable:{" "}
                <span className="text-brand-cyan">
                  {pendingChange.field.variableName}
                </span>
              </div>
              <div>
                Previous Value:{" "}
                <span className="text-zinc-400">
                  {String(pendingChange.oldVal)}
                </span>
              </div>
              <div>
                New Value:{" "}
                <span className="text-emerald-400">
                  {String(pendingChange.newVal)}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-mono text-zinc-400 mb-1">
                Reason for Change Justification:
              </label>
              <textarea
                rows={2}
                value={changeReasonInput}
                onChange={(e) => setChangeReasonInput(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-zinc-950 border border-zinc-700 rounded-lg text-white font-sans focus:border-brand-cyan focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setPendingChange(null)}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-mono"
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
                className="px-3 py-1.5 rounded-lg bg-brand-cyan hover:bg-white text-black font-bold text-xs font-mono"
              >
                Confirm Audit Signature
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Query Response */}
      {activeQueryToAnswer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white font-mono">
              Respond to Clinical Query
            </h3>
            <p className="text-xs text-zinc-400 font-sans">
              {activeQueryToAnswer.message}
            </p>

            <textarea
              rows={3}
              value={queryResponseText}
              onChange={(e) => setQueryResponseText(e.target.value)}
              placeholder="Enter site investigator response and verification rationale..."
              className="w-full px-3 py-2 text-xs bg-zinc-950 border border-zinc-700 rounded-lg text-white font-sans focus:border-brand-cyan focus:outline-none"
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setActiveQueryToAnswer(null)}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 text-xs font-mono"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setQueries((prev) =>
                    prev.map((q) =>
                      q.id === activeQueryToAnswer.id
                        ? {
                            ...q,
                            status: "Answered",
                            response: queryResponseText,
                            respondedBy: "Site Coordinator",
                            respondedAt: new Date().toISOString(),
                          }
                        : q
                    )
                  );
                  setActiveQueryToAnswer(null);
                  setQueryResponseText("");
                }}
                className="px-3 py-1.5 rounded-lg bg-brand-cyan text-black font-bold text-xs font-mono"
              >
                Submit Response
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
