/**
 * Pure Part 11-style EDC simulation reducer and clinical runtime selectors.
 * Centralizes state hydration, role permissions, electronic Data Lock signatures,
 * signature revocations, source data verification (SDV), 3-tier validation,
 * and derived formula calculations without React effect loops.
 */

import {
  AuditTrailEntry,
  CRFField,
  CRFForm,
  EDCQuery,
  EdcFormSignatureStatus,
  EdcFormValidationResult,
  EdcRolePermissions,
  EdcSimulationAction,
  EdcSimulationActionInput,
  EdcSimulationState,
  EdcUserRole,
  ElectronicSignature,
  StudyProtocol,
  SubjectFormStatus,
} from "../types";
import { cloneDeep } from "../../utils";
import { resolveFormConditionalState } from "./conditional-logic";
import {
  answerSimulationQuery,
  cancelSimulationQuery,
  closeSimulationQuery,
  getEdcRoleActorLabel,
  raiseSimulationQuery,
  reopenSimulationQuery,
} from "./edc-query-lifecycle";
import { evaluateFormula, evaluateRule } from "./expression-evaluator";
import { isCdiscNullFlavor, validatePrecisionDate } from "./precision-date";
import { discoverSimulationSubjects } from "./simulation-records";

/**
 * Default simulated subject roster seeded when a study has no recorded subjects.
 */
export const DEFAULT_EDC_SUBJECTS: readonly string[] = [
  "001-101",
  "001-102",
  "001-103",
];

const BASELINE_SEED_SPECS: ReadonlyArray<{
  variableName: string;
  idPrefix: string;
  value: string | number;
}> = [
  { variableName: "BRTHYR", idPrefix: "f_brthyr", value: 1982 },
  { variableName: "AGE", idPrefix: "f_age", value: 44 },
  { variableName: "SEX", idPrefix: "f_sex", value: "M" },
  { variableName: "HEIGHT", idPrefix: "f_height", value: 178 },
  { variableName: "WEIGHT", idPrefix: "f_weight", value: 78 },
  { variableName: "SYSBP", idPrefix: "f_sysbp", value: 132 },
  { variableName: "DIABP", idPrefix: "f_diabp", value: 84 },
  { variableName: "PULSE", idPrefix: "f_pulse", value: 72 },
  { variableName: "TEMP", idPrefix: "f_temp", value: 36.8 },
];

function matchesStandardFieldPrefix(field: CRFField, prefix: string): boolean {
  const lowerId = field.id.toLowerCase();
  const lowerPrefix = prefix.toLowerCase();
  return lowerId === lowerPrefix || lowerId.startsWith(`${lowerPrefix}_`);
}

function isLogOrContinuousForm(form: CRFForm): boolean {
  const upperDomain = (form.domain || "").trim().toUpperCase();
  return (
    Boolean(form.isLogForm) || upperDomain === "AE" || upperDomain === "CM"
  );
}

/**
 * Pure 64-bit deterministic token generator producing lowercase hex suffixes (`[0-9a-f]{12}`).
 * Ensures reducing the same `(study, state, action)` twice produces deep-equal audit,
 * query, and `sim_` Data Lock signature records without wall-clock or PRNG entropy.
 */
function deterministicSimId(prefix: string, material: string): string {
  let h1 = 0xdeadbeef ^ material.length;
  let h2 = 0x41c6ce57 ^ material.length;
  for (let i = 0; i < material.length; i++) {
    const ch = material.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 =
    Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
    Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 =
    Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
    Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hex =
    (h2 >>> 0).toString(16).padStart(8, "0") +
    (h1 >>> 0).toString(16).padStart(8, "0");
  return `${prefix}${hex.slice(0, 12)}`;
}

function stateSequenceKey(state: EdcSimulationState): string {
  return `a${state.auditLog?.length ?? 0}:s${state.signatures?.length ?? 0}:q${state.queries?.length ?? 0}`;
}

/**
 * Stamps a caller-supplied ISO `timestamp` once onto an {@link EdcSimulationActionInput}
 * when omitted by UI callers, returning a strictly-typed {@link EdcSimulationAction}.
 */
export function stampEdcSimulationAction(
  action: EdcSimulationActionInput,
  timestamp: string
): EdcSimulationAction {
  switch (action.type) {
    case "ENROLL_SUBJECT":
    case "REPLACE_SIMULATION_STATE":
      return action;
    case "SEED_SIMULATION":
    case "UPDATE_FIELD_VALUE":
    case "TOGGLE_SDV":
    case "SAVE_FORM":
    case "LOCK_FORM":
    case "UNLOCK_FORM":
      return {
        ...action,
        timestamp: action.timestamp || timestamp,
      };
    case "RAISE_QUERY":
      return {
        type: "RAISE_QUERY",
        input: {
          ...action.input,
          timestamp: action.input.timestamp || timestamp,
        },
      };
    case "ANSWER_QUERY":
      return {
        type: "ANSWER_QUERY",
        input: {
          ...action.input,
          timestamp: action.input.timestamp || timestamp,
        },
      };
    case "CLOSE_QUERY":
      return {
        type: "CLOSE_QUERY",
        input: {
          ...action.input,
          timestamp: action.input.timestamp || timestamp,
        },
      };
    case "CANCEL_QUERY":
      return {
        type: "CANCEL_QUERY",
        input: {
          ...action.input,
          timestamp: action.input.timestamp || timestamp,
        },
      };
    case "REOPEN_QUERY":
      return {
        type: "REOPEN_QUERY",
        input: {
          ...action.input,
          timestamp: action.input.timestamp || timestamp,
        },
      };
  }
}

/**
 * Returns the forms scheduled for `visitId` plus continuous `AE` and `CM` log forms.
 * Falls back to all study forms only when the protocol defines no visits or when
 * none of the visit's assigned form IDs exist in `study.forms`.
 */
export function getScheduledFormsForVisit(
  study: StudyProtocol,
  visitId: string
): CRFForm[] {
  const forms = study.forms || [];
  if (forms.length === 0) return [];

  const visits = study.visits || [];
  if (visits.length === 0) return [...forms];

  const visit = visits.find((v) => v.id === visitId) || visits[0];
  if (!visit) return [...forms];

  const assignedSet = new Set(visit.assignedFormIds || []);
  const studyFormIdSet = new Set(forms.map((f) => f.id));
  const hasAnyValidAssignment = Array.from(assignedSet).some((id) =>
    studyFormIdSet.has(id)
  );
  const anyVisitHasValidAssignment = visits.some((v) =>
    (v.assignedFormIds || []).some((id) => studyFormIdSet.has(id))
  );

  // Synthetic unit-test studies sometimes spread a preset's visits while overriding `forms`.
  if (!hasAnyValidAssignment && !anyVisitHasValidAssignment) {
    return [...forms];
  }

  return forms.filter(
    (form) => assignedSet.has(form.id) || isLogOrContinuousForm(form)
  );
}

/**
 * Resolves lock and electronic signature status for a `(subjectId, visitId, formId)` tuple.
 */
export function getFormSignatureStatus(
  state: EdcSimulationState | undefined,
  subjectId: string,
  visitId: string,
  formId: string
): EdcFormSignatureStatus {
  const lockKey = `${subjectId}_${visitId}_${formId}`;
  const lockEntry = state?.lockedForms?.[lockKey];
  const matchingSignatures = (state?.signatures || []).filter(
    (sig) =>
      sig.subjectId === subjectId &&
      sig.visitId === visitId &&
      sig.formId === formId
  );
  const activeDataLockSignature = [...matchingSignatures]
    .reverse()
    .find((sig) => sig.meaning === "Data Lock");

  const isLocked =
    lockEntry !== undefined
      ? Boolean(lockEntry.locked)
      : Boolean(activeDataLockSignature);

  return {
    isLocked,
    lockedBy: lockEntry?.lockedBy || activeDataLockSignature?.signedBy,
    lockedAt: lockEntry?.timestamp || activeDataLockSignature?.timestamp,
    isSigned: matchingSignatures.length > 0,
    activeDataLockSignature,
    signatures: matchingSignatures,
  };
}

/**
 * Computes the Part 11 role capability matrix and inline read-only guidance banner.
 */
export function getEdcRolePermissions(
  role: EdcUserRole,
  options?: { isLocked?: boolean }
): EdcRolePermissions {
  const isLocked = Boolean(options?.isLocked);
  const actorLabel = getEdcRoleActorLabel(role);
  const canEditUnlockedFields =
    role === "Site Coordinator" || role === "Principal Investigator";
  const canEditActiveForm = canEditUnlockedFields && !isLocked;
  const canToggleSdv = role === "CRA Monitor" && !isLocked;
  const canLockAndSign = role === "Principal Investigator" && !isLocked;
  const canUnlockForm = role === "Principal Investigator" && isLocked;
  const canManageQueries = role === "CRA Monitor" || role === "Data Manager";
  const canRespondToQueries =
    role === "Site Coordinator" || role === "Principal Investigator";

  let readOnlyBanner: string | null = null;
  if (isLocked) {
    readOnlyBanner =
      role === "Principal Investigator"
        ? "This form is locked under a Data Lock signature. Select Unlock Form to record a Part 11 justification and revoke the signature before amending values."
        : "This form is locked by the Principal Investigator under a Data Lock signature. Field edits are read-only.";
  } else if (role === "CRA Monitor") {
    readOnlyBanner =
      "CRA Monitor role is read-only for clinical form values. Verify source records with SDV toggles or raise discrepancy queries.";
  } else if (role === "Data Manager") {
    readOnlyBanner =
      "Data Manager role is read-only for clinical form values and SDV. Review captured records or manage discrepancy queries.";
  }

  return {
    role,
    actorLabel,
    canEditUnlockedFields,
    canEditActiveForm,
    canToggleSdv,
    canLockAndSign,
    canUnlockForm,
    canManageQueries,
    canRespondToQueries,
    readOnlyBanner,
  };
}

/**
 * Builds the lookup map of field IDs, variable names, and cross-visit keys for a subject and visit.
 */
export function buildSubjectFieldValues(
  form: CRFForm | undefined,
  subjectId: string,
  visitId: string,
  formValues: Record<string, string | number | boolean | null>
): Record<string, string | number | boolean | null | undefined> {
  const vals: Record<string, string | number | boolean | null | undefined> = {};
  if (!form) return vals;

  for (const section of form.sections || []) {
    for (const field of section.fields || []) {
      const key = `${subjectId}_${visitId}_${field.id}`;
      vals[field.id] = formValues[key];
      vals[field.variableName] = formValues[key];
    }
  }

  const subjectPrefix = `${subjectId}_`;
  for (const [key, val] of Object.entries(formValues)) {
    if (key.startsWith(subjectPrefix)) {
      vals[key.slice(subjectPrefix.length)] = val;
    }
  }

  return vals;
}

/**
 * Evaluates all `calculated` fields on `form` for `(subjectId, visitId)` and returns
 * an updated `formValues` map containing deterministic derived values (such as rounded `BMI`).
 */
export function evaluateDerivedFormValues(
  form: CRFForm | undefined,
  subjectId: string,
  visitId: string,
  formValues: Record<string, string | number | boolean | null>
): Record<string, string | number | boolean | null> {
  if (!form) return { ...formValues };

  const fields = (form.sections || []).flatMap((s) => s.fields || []);
  const calculatedFields = fields.filter(
    (f) => f.dataType === "calculated" && Boolean(f.calculationFormula)
  );
  if (calculatedFields.length === 0) {
    return { ...formValues };
  }

  const nextFormValues = { ...formValues };
  for (const field of calculatedFields) {
    if (!field.calculationFormula) continue;
    const subjectVals = buildSubjectFieldValues(
      form,
      subjectId,
      visitId,
      nextFormValues
    );
    const calculatedVal = evaluateFormula(
      field.calculationFormula,
      subjectVals,
      fields
    );
    const key = `${subjectId}_${visitId}_${field.id}`;
    nextFormValues[key] = calculatedVal;
  }

  return nextFormValues;
}

/**
 * Deterministically seeds or normalizes `EdcSimulationState` against actual `StudyProtocol` field IDs.
 * Maps stamped CDASH field IDs (such as `f_brthyr_1`, `f_age_2`, `f_sex_3`, and `VS` vitals)
 * and computes initial derived calculations without mutating partial or imported states.
 */
export function seedEdcSimulationState(
  study: StudyProtocol,
  existingState?: EdcSimulationState,
  timestamp = "2026-08-15T08:30:00Z"
): EdcSimulationState {
  if (existingState !== undefined) {
    const discovered = discoverSimulationSubjects(study, existingState);
    const fallbackSubjects = Array.from(
      new Set([...DEFAULT_EDC_SUBJECTS, ...discovered])
    );
    return {
      availableSubjects: existingState.availableSubjects
        ? [...existingState.availableSubjects]
        : fallbackSubjects,
      formValues: { ...(existingState.formValues || {}) },
      sdvMap: { ...(existingState.sdvMap || {}) },
      lockedForms: { ...(existingState.lockedForms || {}) },
      queries: [...(existingState.queries || [])],
      auditLog: [...(existingState.auditLog || [])],
      signatures: [...(existingState.signatures || [])],
    };
  }

  const seedSubjectId = DEFAULT_EDC_SUBJECTS[0];
  const seedVisitId =
    study.visits?.find((v) => v.id === "v_screen")?.id ||
    study.visits?.[0]?.id ||
    "v_screen";

  let seededValues: Record<string, string | number | boolean | null> = {};
  const allFieldsWithForm = (study.forms || []).flatMap((form) =>
    (form.sections || []).flatMap((section) =>
      (section.fields || []).map((field) => ({ form, field }))
    )
  );

  for (const spec of BASELINE_SEED_SPECS) {
    const match = allFieldsWithForm.find(
      ({ field }) =>
        field.variableName.toUpperCase() === spec.variableName &&
        matchesStandardFieldPrefix(field, spec.idPrefix)
    );
    if (match) {
      seededValues[`${seedSubjectId}_${seedVisitId}_${match.field.id}`] =
        spec.value;
    }
  }

  for (const form of study.forms || []) {
    seededValues = evaluateDerivedFormValues(
      form,
      seedSubjectId,
      seedVisitId,
      seededValues
    );
  }

  const dmForm =
    (study.forms || []).find((f) => f.domain.toUpperCase() === "DM") ||
    study.forms?.[0];
  const brthyrField = dmForm?.sections
    ?.flatMap((s) => s.fields || [])
    .find(
      (f) =>
        f.variableName.toUpperCase() === "BRTHYR" ||
        matchesStandardFieldPrefix(f, "f_brthyr")
    );

  const initialAuditEntry: AuditTrailEntry = {
    id: "aud_init_1",
    timestamp,
    actionType: "FIELD_UPDATE",
    subjectId: seedSubjectId,
    formId: dmForm?.id || "form_dm",
    fieldId: brthyrField?.id || "f_brthyr",
    fieldName: brthyrField?.variableName || "BRTHYR",
    previousValue: null,
    newValue: 1982,
    changedBy: getEdcRoleActorLabel("Site Coordinator"),
    userRole: "Site Coordinator",
    reasonForChange: "Initial baseline data entry from hospital records",
  };

  return {
    availableSubjects: [...DEFAULT_EDC_SUBJECTS],
    formValues: seededValues,
    sdvMap: {},
    lockedForms: {},
    queries: [],
    auditLog: [initialAuditEntry],
    signatures: [],
  };
}

/**
 * Pure 3-tier form submission validator enforcing Hard Stop rules on missing required fields,
 * disallowed CDISC null flavors, out-of-range numbers, and invalid precision dates while
 * collecting deduplicatable Auto-Query tickets.
 */
export function validateEdcFormSubmission(
  study: StudyProtocol,
  form: CRFForm | undefined,
  subjectId: string,
  visitId: string,
  formValues: Record<string, string | number | boolean | null>,
  timestamp: string
): EdcFormValidationResult {
  if (!form) {
    return {
      isValid: true,
      errors: {},
      hardStops: [],
      autoQueries: [],
      queriesToRaise: [],
    };
  }

  const effectiveValues = evaluateDerivedFormValues(
    form,
    subjectId,
    visitId,
    formValues
  );
  const fields = (form.sections || []).flatMap((s) => s.fields || []);
  const subjectVals = buildSubjectFieldValues(
    form,
    subjectId,
    visitId,
    effectiveValues
  );
  const conditionalState = resolveFormConditionalState(
    fields,
    form.rules || [],
    subjectVals,
    visitId
  );

  const errors: Record<string, string> = {};
  const hardStops: string[] = [];
  const autoQueries: string[] = [];
  const queriesToRaise: EDCQuery[] = [];

  for (const field of fields) {
    const fieldState = conditionalState.fields[field.id];
    if (fieldState && !fieldState.visible) continue;

    const key = `${subjectId}_${visitId}_${field.id}`;
    const val = effectiveValues[key];
    const hasNullFlavor = isCdiscNullFlavor(val);
    const isEmpty = val === null || val === undefined || val === "";

    // Enforce Hard Stop against disallowed CDISC null flavors when allowNullFlavor is not enabled
    if (hasNullFlavor && field.allowNullFlavor !== true) {
      const code = String(val).trim().toUpperCase();
      errors[field.id] =
        `Null flavor '${code}' is not permitted for '${field.variableName}' (Hard Stop).`;
      hardStops.push(field.variableName);
      continue;
    }

    const isRuleRequired = fieldState?.required ?? field.required;
    const isHardStop =
      field.requirementTier === "hard_stop" ||
      (!field.requirementTier && isRuleRequired);
    const isAutoQuery = field.requirementTier === "auto_query";

    if (isEmpty && !hasNullFlavor) {
      if (isHardStop) {
        errors[field.id] =
          `Mandatory variable '${field.variableName}' is missing (Hard Stop).`;
        hardStops.push(field.variableName);
      } else if (isAutoQuery) {
        autoQueries.push(field.variableName);
        queriesToRaise.push({
          id: deterministicSimId(
            "qry_",
            `auto_missing|${form.id}|${subjectId}|${visitId}|${field.id}|${timestamp}`
          ),
          fieldId: field.id,
          fieldName: field.variableName,
          ruleId: `rule_auto_query_${field.id}`,
          formId: form.id,
          visitId,
          subjectId,
          status: "Open",
          severity: "warning",
          message: `Auto-Query: Required clinical variable '${field.variableName}' (${field.label}) is missing upon form submission.`,
          raisedBy: "3-Tier Missing Data Engine",
          raisedAt: timestamp,
        });
      }
    }

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
          errors[field.id] = `${rangeMsg} Correct it to save (Hard Stop).`;
          hardStops.push(field.variableName);
        } else {
          autoQueries.push(field.variableName);
          queriesToRaise.push({
            id: deterministicSimId(
              "qry_",
              `auto_range|${form.id}|${subjectId}|${visitId}|${field.id}|${String(val)}|${timestamp}`
            ),
            fieldId: field.id,
            fieldName: field.variableName,
            ruleId: `rule_range_${field.id}`,
            formId: form.id,
            visitId,
            subjectId,
            status: "Open",
            severity: "warning",
            message: `Range check: ${rangeMsg} Please confirm or correct.`,
            raisedBy: "Range Check Engine",
            raisedAt: timestamp,
          });
        }
      }
    }

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
        errors[field.id] = valRes.error || "Date validation failed.";
        hardStops.push(field.variableName);
      }
    }
  }

  void study;

  return {
    isValid: hardStops.length === 0,
    errors,
    hardStops,
    autoQueries,
    queriesToRaise,
  };
}

/**
 * Computes longitudinal completion, lock, SDV, and open query counts for `(subjectId, visitId, formId)`.
 */
export function getSubjectFormStatus(
  study: StudyProtocol,
  state: EdcSimulationState | undefined,
  subjectId: string,
  visitId: string,
  formId: string
): SubjectFormStatus {
  const sigStatus = getFormSignatureStatus(state, subjectId, visitId, formId);
  const formDef = (study.forms || []).find((f) => f.id === formId);
  const formFields = formDef
    ? (formDef.sections || []).flatMap((s) => s.fields || [])
    : [];
  const formValues = formDef
    ? evaluateDerivedFormValues(
        formDef,
        subjectId,
        visitId,
        state?.formValues || {}
      )
    : state?.formValues || {};
  const sdvMap = state?.sdvMap || {};

  let hasValues = false;
  let sdvCount = 0;
  for (const f of formFields) {
    const vKey = `${subjectId}_${visitId}_${f.id}`;
    if (
      f.dataType !== "calculated" &&
      formValues[vKey] !== undefined &&
      formValues[vKey] !== null &&
      formValues[vKey] !== ""
    ) {
      hasValues = true;
    }
    if (sdvMap[vKey]?.verified) {
      sdvCount++;
    }
  }

  const openQueriesCount = (state?.queries || []).filter(
    (q) =>
      q.subjectId === subjectId &&
      q.visitId === visitId &&
      q.formId === formId &&
      q.status === "Open"
  ).length;

  const isSdvVerified = formFields.length > 0 && sdvCount >= formFields.length;

  return {
    subjectId,
    visitId,
    formId,
    isComplete: hasValues,
    isLocked: sigStatus.isLocked,
    isSdvVerified,
    openQueriesCount,
  };
}

function collectTriggeredRuleQueries(
  form: CRFForm,
  subjectId: string,
  visitId: string,
  formValues: Record<string, string | number | boolean | null>,
  existingQueries: EDCQuery[],
  timestamp: string
): EDCQuery[] {
  const fields = (form.sections || []).flatMap((s) => s.fields || []);
  const subjectVals = buildSubjectFieldValues(
    form,
    subjectId,
    visitId,
    formValues
  );
  const nextQueries = [...existingQueries];

  for (const rule of form.rules || []) {
    if (rule.actionType !== "raise_query") continue;
    const isTriggered = evaluateRule(rule, subjectVals, fields, visitId);
    if (!isTriggered) continue;

    const alreadyExists = nextQueries.some(
      (q) =>
        q.subjectId === subjectId &&
        q.visitId === visitId &&
        q.ruleId === rule.id &&
        q.status !== "Cancelled"
    );
    if (alreadyExists) continue;

    const targetField = fields.find((f) => f.id === rule.targetFieldId);
    nextQueries.push({
      id: deterministicSimId(
        "qry_",
        `rule|${nextQueries.length}|${form.id}|${subjectId}|${visitId}|${rule.id}|${timestamp}`
      ),
      fieldId: rule.targetFieldId,
      fieldName: targetField?.variableName || "FIELD",
      ruleId: rule.id,
      formId: form.id,
      visitId,
      subjectId,
      status: "Open",
      severity: rule.querySeverity || "warning",
      message: rule.queryMessage || `Edit check ${rule.name} failed.`,
      raisedBy: "CRF Studio Auto-Linter Engine",
      raisedAt: timestamp,
    });
  }

  return nextQueries;
}

/**
 * Pure Part 11-style reducer driving all `EdcSimulationState` transitions.
 */
export function reduceEdcSimulationState(
  study: StudyProtocol,
  state: EdcSimulationState | undefined,
  action: EdcSimulationAction
): EdcSimulationState {
  if (action.type === "REPLACE_SIMULATION_STATE") {
    return seedEdcSimulationState(study, cloneDeep(action.simulationState));
  }

  const base = seedEdcSimulationState(study, state);

  switch (action.type) {
    case "SEED_SIMULATION": {
      return state === undefined
        ? seedEdcSimulationState(study, undefined, action.timestamp)
        : base;
    }

    case "UPDATE_FIELD_VALUE": {
      const sigStatus = getFormSignatureStatus(
        base,
        action.subjectId,
        action.visitId,
        action.formId
      );
      const permissions = getEdcRolePermissions(action.role, {
        isLocked: sigStatus.isLocked,
      });
      if (!permissions.canEditActiveForm) {
        return base;
      }

      const form = (study.forms || []).find((f) => f.id === action.formId);
      const field = form?.sections
        ?.flatMap((s) => s.fields || [])
        .find((f) => f.id === action.fieldId);
      const key = `${action.subjectId}_${action.visitId}_${action.fieldId}`;
      const previousValue = base.formValues?.[key] ?? null;

      if (previousValue === action.value) {
        return base;
      }

      const ts = action.timestamp;
      const updatedValues = evaluateDerivedFormValues(
        form,
        action.subjectId,
        action.visitId,
        {
          ...(base.formValues || {}),
          [key]: action.value,
        }
      );

      const nextQueries = form
        ? collectTriggeredRuleQueries(
            form,
            action.subjectId,
            action.visitId,
            updatedValues,
            base.queries || [],
            ts
          )
        : [...(base.queries || [])];

      const hasExistingNonEmpty =
        previousValue !== null &&
        previousValue !== undefined &&
        previousValue !== "";
      const resolvedReason =
        action.reasonForChange?.trim() ||
        (hasExistingNonEmpty
          ? "Transcription correction against source chart"
          : "Initial Entry");

      const auditEntry: AuditTrailEntry = {
        id: deterministicSimId(
          "aud_",
          `${stateSequenceKey(base)}|FIELD_UPDATE|${action.subjectId}|${action.visitId}|${action.formId}|${action.fieldId}|${String(action.value)}|${ts}`
        ),
        timestamp: ts,
        actionType: "FIELD_UPDATE",
        subjectId: action.subjectId,
        formId: action.formId,
        fieldId: action.fieldId,
        fieldName: field?.variableName || action.fieldId,
        previousValue,
        newValue: action.value,
        changedBy: permissions.actorLabel,
        userRole: action.role,
        reasonForChange: resolvedReason,
      };

      const subjects = base.availableSubjects || [];
      const availableSubjects = subjects.includes(action.subjectId)
        ? [...subjects]
        : [...subjects, action.subjectId];

      return {
        ...base,
        availableSubjects,
        formValues: updatedValues,
        queries: nextQueries,
        auditLog: [auditEntry, ...(base.auditLog || [])],
      };
    }

    case "TOGGLE_SDV": {
      const sigStatus = getFormSignatureStatus(
        base,
        action.subjectId,
        action.visitId,
        action.formId
      );
      const permissions = getEdcRolePermissions(action.role, {
        isLocked: sigStatus.isLocked,
      });
      if (!permissions.canToggleSdv) {
        return base;
      }

      const form = (study.forms || []).find((f) => f.id === action.formId);
      const field = form?.sections
        ?.flatMap((s) => s.fields || [])
        .find((f) => f.id === action.fieldId);
      const fieldLabel =
        action.fieldName?.trim() || field?.variableName || action.fieldId;
      const key = `${action.subjectId}_${action.visitId}_${action.fieldId}`;
      const isAlreadyVerified = Boolean(base.sdvMap?.[key]?.verified);
      const newVerified = !isAlreadyVerified;
      const ts = action.timestamp;

      const auditEntry: AuditTrailEntry = {
        id: deterministicSimId(
          "aud_",
          `${stateSequenceKey(base)}|TOGGLE_SDV|${action.subjectId}|${action.visitId}|${action.formId}|${action.fieldId}|${newVerified}|${ts}`
        ),
        timestamp: ts,
        actionType: newVerified ? "SDV_VERIFY" : "SDV_REVOKE",
        subjectId: action.subjectId,
        formId: action.formId,
        fieldId: action.fieldId,
        fieldName: fieldLabel,
        previousValue: isAlreadyVerified ? "SDV Verified" : "Unverified",
        newValue: newVerified ? "SDV Verified" : "Unverified",
        changedBy: permissions.actorLabel,
        userRole: action.role,
        reasonForChange: newVerified
          ? "Source Data Verification (SDV) against medical records completed"
          : "SDV verification revoked",
      };

      return {
        ...base,
        sdvMap: {
          ...(base.sdvMap || {}),
          [key]: {
            verified: newVerified,
            timestamp: ts,
            auditedBy: permissions.actorLabel,
          },
        },
        auditLog: [auditEntry, ...(base.auditLog || [])],
      };
    }

    case "SAVE_FORM": {
      const form = (study.forms || []).find((f) => f.id === action.formId);
      if (!form) return base;
      const ts = action.timestamp;
      const validation = validateEdcFormSubmission(
        study,
        form,
        action.subjectId,
        action.visitId,
        base.formValues || {},
        ts
      );

      const updatedFormValues = evaluateDerivedFormValues(
        form,
        action.subjectId,
        action.visitId,
        base.formValues || {}
      );

      let nextQueries = [...(base.queries || [])];
      if (validation.queriesToRaise.length > 0) {
        const existingKeys = new Set(
          nextQueries
            .filter((q) => q.status !== "Cancelled")
            .map((q) => `${q.subjectId}_${q.visitId}_${q.fieldId}_${q.ruleId}`)
        );
        for (const q of validation.queriesToRaise) {
          const dedupKey = `${q.subjectId}_${q.visitId}_${q.fieldId}_${q.ruleId}`;
          if (!existingKeys.has(dedupKey)) {
            existingKeys.add(dedupKey);
            nextQueries.push(q);
          }
        }
      }

      nextQueries = collectTriggeredRuleQueries(
        form,
        action.subjectId,
        action.visitId,
        updatedFormValues,
        nextQueries,
        ts
      );

      return {
        ...base,
        formValues: updatedFormValues,
        queries: nextQueries,
      };
    }

    case "ENROLL_SUBJECT": {
      const trimmed = action.subjectId.trim();
      if (!trimmed) return base;
      const existing = base.availableSubjects || [];
      if (existing.includes(trimmed)) return base;

      return {
        ...base,
        availableSubjects: [...existing, trimmed],
      };
    }

    case "LOCK_FORM": {
      const sigStatus = getFormSignatureStatus(
        base,
        action.subjectId,
        action.visitId,
        action.formId
      );
      const permissions = getEdcRolePermissions(action.role, {
        isLocked: sigStatus.isLocked,
      });
      if (!permissions.canLockAndSign) {
        return base;
      }

      const ts = action.timestamp;
      const seqKey = stateSequenceKey(base);
      const lockKey = `${action.subjectId}_${action.visitId}_${action.formId}`;
      const form = (study.forms || []).find((f) => f.id === action.formId);
      const digest =
        action.digest ||
        deterministicSimId("sim_", `${seqKey}|DIGEST|${lockKey}|${ts}`);

      const signature: ElectronicSignature = {
        id:
          action.signatureId ||
          deterministicSimId("sig_", `${seqKey}|SIG|${lockKey}|${ts}`),
        subjectId: action.subjectId,
        formId: action.formId,
        visitId: action.visitId,
        signedBy: permissions.actorLabel,
        userRole: "Principal Investigator",
        timestamp: ts,
        meaning: "Data Lock",
        digest,
      };

      const auditEntry: AuditTrailEntry = {
        id: deterministicSimId("aud_", `${seqKey}|FORM_LOCK|${lockKey}|${ts}`),
        timestamp: ts,
        actionType: "FORM_LOCK",
        targetId: action.formId,
        targetType: "form",
        subjectId: action.subjectId,
        formId: action.formId,
        fieldId: action.formId,
        fieldName: form?.domain || action.formId,
        previousValue: "Unlocked",
        newValue: "Locked & Signed",
        changedBy: permissions.actorLabel,
        userRole: "Principal Investigator",
        reasonForChange: `Data Lock electronic signature applied (${digest})`,
      };

      return {
        ...base,
        lockedForms: {
          ...(base.lockedForms || {}),
          [lockKey]: {
            locked: true,
            lockedBy: permissions.actorLabel,
            timestamp: ts,
          },
        },
        signatures: [...(base.signatures || []), signature],
        auditLog: [auditEntry, ...(base.auditLog || [])],
      };
    }

    case "UNLOCK_FORM": {
      const reason = action.reasonForChange.trim();
      if (!reason) {
        return base;
      }

      const sigStatus = getFormSignatureStatus(
        base,
        action.subjectId,
        action.visitId,
        action.formId
      );
      const permissions = getEdcRolePermissions(action.role, {
        isLocked: sigStatus.isLocked,
      });
      if (!permissions.canUnlockForm) {
        return base;
      }

      const ts = action.timestamp;
      const lockKey = `${action.subjectId}_${action.visitId}_${action.formId}`;
      const form = (study.forms || []).find((f) => f.id === action.formId);
      const revokedToken = sigStatus.activeDataLockSignature?.digest;

      // Remove active Data Lock signatures for this (subjectId, visitId, formId)
      const remainingSignatures = (base.signatures || []).filter(
        (sig) =>
          !(
            sig.subjectId === action.subjectId &&
            sig.visitId === action.visitId &&
            sig.formId === action.formId &&
            sig.meaning === "Data Lock"
          )
      );

      const auditEntry: AuditTrailEntry = {
        id: deterministicSimId(
          "aud_",
          `${stateSequenceKey(base)}|FORM_UNLOCK|${lockKey}|${reason}|${ts}`
        ),
        timestamp: ts,
        actionType: "FORM_UNLOCK",
        targetId: action.formId,
        targetType: "form",
        subjectId: action.subjectId,
        formId: action.formId,
        fieldId: action.formId,
        fieldName: form?.domain || action.formId,
        previousValue: revokedToken
          ? `Locked & Signed (${revokedToken})`
          : "Locked & Signed",
        newValue: "Unlocked",
        changedBy: permissions.actorLabel,
        userRole: "Principal Investigator",
        reasonForChange: reason,
      };

      return {
        ...base,
        lockedForms: {
          ...(base.lockedForms || {}),
          [lockKey]: {
            locked: false,
            lockedBy: permissions.actorLabel,
            timestamp: ts,
          },
        },
        signatures: remainingSignatures,
        auditLog: [auditEntry, ...(base.auditLog || [])],
      };
    }

    case "RAISE_QUERY": {
      const role = action.input.userRole as EdcUserRole;
      if (!getEdcRolePermissions(role).canManageQueries) {
        return base;
      }
      const seqKey = stateSequenceKey(base);
      const seedBase = `${seqKey}|RAISE_QUERY|${action.input.subjectId}|${action.input.visitId}|${action.input.formId}|${action.input.fieldId}|${action.input.message}|${action.input.timestamp}`;
      return raiseSimulationQuery(
        base,
        {
          ...action.input,
          actor: action.input.actor?.trim() || getEdcRoleActorLabel(role),
        },
        study,
        {
          defaultQueryId: deterministicSimId("q_man_", seedBase),
          auditId: deterministicSimId("aud_q_", seedBase),
        }
      );
    }

    case "ANSWER_QUERY": {
      const role = action.input.userRole as EdcUserRole;
      if (!getEdcRolePermissions(role).canRespondToQueries) {
        return base;
      }
      const auditId = deterministicSimId(
        "aud_q_",
        `${stateSequenceKey(base)}|ANSWER_QUERY|${action.input.queryId}|${action.input.response}|${action.input.timestamp}`
      );
      return answerSimulationQuery(
        base,
        {
          ...action.input,
          actor: action.input.actor?.trim() || getEdcRoleActorLabel(role),
        },
        { auditId }
      );
    }

    case "CLOSE_QUERY": {
      const role = action.input.userRole as EdcUserRole;
      if (!getEdcRolePermissions(role).canManageQueries) {
        return base;
      }
      const auditId = deterministicSimId(
        "aud_q_",
        `${stateSequenceKey(base)}|CLOSE_QUERY|${action.input.queryId}|${action.input.resolutionReason ?? ""}|${action.input.timestamp}`
      );
      return closeSimulationQuery(
        base,
        {
          ...action.input,
          actor: action.input.actor?.trim() || getEdcRoleActorLabel(role),
        },
        { auditId }
      );
    }

    case "CANCEL_QUERY": {
      const role = action.input.userRole as EdcUserRole;
      if (!getEdcRolePermissions(role).canManageQueries) {
        return base;
      }
      const auditId = deterministicSimId(
        "aud_q_",
        `${stateSequenceKey(base)}|CANCEL_QUERY|${action.input.queryId}|${action.input.resolutionReason ?? ""}|${action.input.timestamp}`
      );
      return cancelSimulationQuery(
        base,
        {
          ...action.input,
          actor: action.input.actor?.trim() || getEdcRoleActorLabel(role),
        },
        { auditId }
      );
    }

    case "REOPEN_QUERY": {
      const role = action.input.userRole as EdcUserRole;
      if (!getEdcRolePermissions(role).canManageQueries) {
        return base;
      }
      const auditId = deterministicSimId(
        "aud_q_",
        `${stateSequenceKey(base)}|REOPEN_QUERY|${action.input.queryId}|${action.input.reason ?? ""}|${action.input.timestamp}`
      );
      return reopenSimulationQuery(
        base,
        {
          ...action.input,
          actor: action.input.actor?.trim() || getEdcRoleActorLabel(role),
        },
        { auditId }
      );
    }

    default:
      return base;
  }
}
