import {
  AnswerEdcQueryInput,
  AuditTrailEntry,
  CancelEdcQueryInput,
  CloseEdcQueryInput,
  EDCQuery,
  EdcSimulationState,
  RaiseEdcQueryInput,
  ReopenEdcQueryInput,
  StudyProtocol,
} from "../types";
import { generateEngineId } from "./precision-date";

/**
 * Maps an EDC simulation role to its representative actor label.
 */
export function getEdcRoleActorLabel(role: string): string {
  switch (role) {
    case "Site Coordinator":
      return "S. Jenkins, RN (Site 001)";
    case "Principal Investigator":
      return "Dr. A. Patel, MD (PI)";
    case "CRA Monitor":
      return "M. Vance, CRA (Monitor)";
    case "Data Manager":
      return "K. Lin, CCDM (Data Manager)";
    default:
      return role || "Clinical User";
  }
}

function resolveFieldDisplayName(
  study: StudyProtocol | undefined,
  formId: string,
  fieldId: string,
  explicitName?: string
): string {
  if (explicitName && explicitName.trim()) {
    return explicitName.trim();
  }
  if (study) {
    const form = study.forms.find((f) => f.id === formId);
    for (const sec of form?.sections || []) {
      const field = sec.fields.find((f) => f.id === fieldId);
      if (field) {
        return field.variableName || field.label || fieldId;
      }
    }
  }
  return fieldId;
}

function buildQueryAuditEntry(params: {
  timestamp: string;
  subjectId: string;
  formId: string;
  fieldId: string;
  fieldName: string;
  previousValue: string | null;
  newValue: string;
  changedBy: string;
  userRole: string;
  reasonForChange: string;
  actionType: string;
  queryId: string;
}): AuditTrailEntry {
  return {
    id: generateEngineId("aud_q"),
    timestamp: params.timestamp,
    subjectId: params.subjectId,
    formId: params.formId,
    fieldId: params.fieldId,
    fieldName: params.fieldName,
    targetId: params.queryId,
    targetType: "query",
    actionType: params.actionType,
    previousValue: params.previousValue,
    newValue: params.newValue,
    changedBy: params.changedBy,
    userRole: params.userRole,
    reasonForChange: params.reasonForChange,
  };
}

/**
 * Pure helper to raise a manual or automated discrepancy query in `EdcSimulationState`
 * and append an `AuditTrailEntry` row to `auditLog`.
 */
export function raiseSimulationQuery(
  state: EdcSimulationState | undefined,
  input: RaiseEdcQueryInput,
  study?: StudyProtocol
): EdcSimulationState {
  const message = input.message.trim();
  if (!message) {
    throw new Error("Query message is required.");
  }

  const ts = input.timestamp || new Date().toISOString();
  const queryId = input.id || generateEngineId("q_man");
  const fieldName = resolveFieldDisplayName(
    study,
    input.formId,
    input.fieldId,
    input.fieldName
  );
  const actor = input.actor.trim() || getEdcRoleActorLabel(input.userRole);

  const newQuery: EDCQuery = {
    id: queryId,
    subjectId: input.subjectId,
    visitId: input.visitId,
    formId: input.formId,
    fieldId: input.fieldId,
    fieldName,
    ...(input.ruleId ? { ruleId: input.ruleId } : {}),
    severity: input.severity || "warning",
    message,
    status: "Open",
    raisedBy: actor,
    raisedAt: ts,
  };

  const auditEntry = buildQueryAuditEntry({
    timestamp: ts,
    subjectId: input.subjectId,
    formId: input.formId,
    fieldId: input.fieldId,
    fieldName,
    previousValue: null,
    newValue: "Open",
    changedBy: actor,
    userRole: input.userRole,
    reasonForChange:
      input.reasonForChange?.trim() || `Query raised: ${message}`,
    actionType: "QUERY_RAISE",
    queryId,
  });

  const existingSubjects = state?.availableSubjects || [];
  const availableSubjects = existingSubjects.includes(input.subjectId)
    ? [...existingSubjects]
    : [...existingSubjects, input.subjectId];

  return {
    ...state,
    availableSubjects,
    queries: [newQuery, ...(state?.queries || [])],
    auditLog: [auditEntry, ...(state?.auditLog || [])],
  };
}

/**
 * Pure helper to answer an open discrepancy query in `EdcSimulationState`
 * and append an `AuditTrailEntry` row to `auditLog`.
 */
export function answerSimulationQuery(
  state: EdcSimulationState | undefined,
  input: AnswerEdcQueryInput
): EdcSimulationState {
  const response = input.response.trim();
  if (!response) {
    throw new Error("Query response is required.");
  }

  const queries = state?.queries || [];
  const target = queries.find((q) => q.id === input.queryId);
  if (!target || target.status === "Closed" || target.status === "Cancelled") {
    return state ? { ...state } : { queries: [], auditLog: [] };
  }

  const ts = input.timestamp || new Date().toISOString();
  const actor = input.actor.trim() || getEdcRoleActorLabel(input.userRole);
  const previousStatus = target.status;

  const updatedQuery: EDCQuery = {
    ...target,
    status: "Answered",
    response,
    respondedBy: actor,
    respondedAt: ts,
  };

  const auditEntry = buildQueryAuditEntry({
    timestamp: ts,
    subjectId: target.subjectId,
    formId: target.formId,
    fieldId: target.fieldId,
    fieldName: target.fieldName,
    previousValue: previousStatus,
    newValue: "Answered",
    changedBy: actor,
    userRole: input.userRole,
    reasonForChange:
      input.reasonForChange?.trim() || `Query answered: ${response}`,
    actionType: "QUERY_ANSWER",
    queryId: target.id,
  });

  return {
    ...state,
    queries: queries.map((q) => (q.id === input.queryId ? updatedQuery : q)),
    auditLog: [auditEntry, ...(state?.auditLog || [])],
  };
}

/**
 * Pure helper to close an answered or open discrepancy query in `EdcSimulationState`
 * and append an `AuditTrailEntry` row to `auditLog`.
 */
export function closeSimulationQuery(
  state: EdcSimulationState | undefined,
  input: CloseEdcQueryInput
): EdcSimulationState {
  const queries = state?.queries || [];
  const target = queries.find((q) => q.id === input.queryId);
  if (!target || target.status === "Closed" || target.status === "Cancelled") {
    return state ? { ...state } : { queries: [], auditLog: [] };
  }

  const ts = input.timestamp || new Date().toISOString();
  const actor = input.actor.trim() || getEdcRoleActorLabel(input.userRole);
  const reason =
    input.resolutionReason?.trim() || "Query response verified and closed";
  const previousStatus = target.status;

  const updatedQuery: EDCQuery = {
    ...target,
    status: "Closed",
    resolvedBy: actor,
    resolvedAt: ts,
    resolutionReason: reason,
  };

  const auditEntry = buildQueryAuditEntry({
    timestamp: ts,
    subjectId: target.subjectId,
    formId: target.formId,
    fieldId: target.fieldId,
    fieldName: target.fieldName,
    previousValue: previousStatus,
    newValue: "Closed",
    changedBy: actor,
    userRole: input.userRole,
    reasonForChange: reason,
    actionType: "QUERY_CLOSE",
    queryId: target.id,
  });

  return {
    ...state,
    queries: queries.map((q) => (q.id === input.queryId ? updatedQuery : q)),
    auditLog: [auditEntry, ...(state?.auditLog || [])],
  };
}

/**
 * Pure helper to cancel an open (or answered) discrepancy query in `EdcSimulationState`
 * and append an `AuditTrailEntry` row to `auditLog`.
 */
export function cancelSimulationQuery(
  state: EdcSimulationState | undefined,
  input: CancelEdcQueryInput
): EdcSimulationState {
  const queries = state?.queries || [];
  const target = queries.find((q) => q.id === input.queryId);
  if (!target || target.status === "Closed" || target.status === "Cancelled") {
    return state ? { ...state } : { queries: [], auditLog: [] };
  }

  const ts = input.timestamp || new Date().toISOString();
  const actor = input.actor.trim() || getEdcRoleActorLabel(input.userRole);
  const reason =
    input.resolutionReason?.trim() || "Query cancelled without site edit";
  const previousStatus = target.status;

  const updatedQuery: EDCQuery = {
    ...target,
    status: "Cancelled",
    resolvedBy: actor,
    resolvedAt: ts,
    resolutionReason: reason,
  };

  const auditEntry = buildQueryAuditEntry({
    timestamp: ts,
    subjectId: target.subjectId,
    formId: target.formId,
    fieldId: target.fieldId,
    fieldName: target.fieldName,
    previousValue: previousStatus,
    newValue: "Cancelled",
    changedBy: actor,
    userRole: input.userRole,
    reasonForChange: reason,
    actionType: "QUERY_CANCEL",
    queryId: target.id,
  });

  return {
    ...state,
    queries: queries.map((q) => (q.id === input.queryId ? updatedQuery : q)),
    auditLog: [auditEntry, ...(state?.auditLog || [])],
  };
}

/**
 * Pure helper to reopen an answered, closed, or cancelled discrepancy query
 * in `EdcSimulationState` and append an `AuditTrailEntry` row to `auditLog`.
 */
export function reopenSimulationQuery(
  state: EdcSimulationState | undefined,
  input: ReopenEdcQueryInput
): EdcSimulationState {
  const queries = state?.queries || [];
  const target = queries.find((q) => q.id === input.queryId);
  if (!target || target.status === "Open") {
    return state ? { ...state } : { queries: [], auditLog: [] };
  }

  const ts = input.timestamp || new Date().toISOString();
  const actor = input.actor.trim() || getEdcRoleActorLabel(input.userRole);
  const reason =
    input.reason?.trim() || "Query reopened for follow-up clarification";
  const previousStatus = target.status;

  const updatedQuery: EDCQuery = {
    ...target,
    status: "Open",
    resolvedBy: undefined,
    resolvedAt: undefined,
    resolutionReason: undefined,
  };

  const auditEntry = buildQueryAuditEntry({
    timestamp: ts,
    subjectId: target.subjectId,
    formId: target.formId,
    fieldId: target.fieldId,
    fieldName: target.fieldName,
    previousValue: previousStatus,
    newValue: "Open",
    changedBy: actor,
    userRole: input.userRole,
    reasonForChange: reason,
    actionType: "QUERY_REOPEN",
    queryId: target.id,
  });

  return {
    ...state,
    queries: queries.map((q) => (q.id === input.queryId ? updatedQuery : q)),
    auditLog: [auditEntry, ...(state?.auditLog || [])],
  };
}
