import {
  CRFField,
  CRFForm,
  EdcSimulationState,
  StudyProtocol,
  StudyVisit,
} from "../types";

export interface ParsedSimulationCell {
  key: string;
  subjectId: string;
  visitId: string;
  formId?: string;
  fieldId: string;
  value: string | number | boolean | null;
}

export interface CapturedFormRow {
  subjectId: string;
  visitId: string;
  visitName: string;
  visitNum: number;
  dtcInit: string;
  values: Record<string, string | number | boolean | null>;
}

/**
 * Resolves `formValues` keys (`${subjectId}_${visitId}_${fieldId}`) without
 * splitting naively on underscores, because subject IDs, visit IDs, and field
 * IDs can all contain underscores.
 */
export function parseSimulationFormValues(
  study: StudyProtocol,
  simulationState?: EdcSimulationState
): ParsedSimulationCell[] {
  const formValues = simulationState?.formValues;
  if (!formValues || Object.keys(formValues).length === 0) {
    return [];
  }

  const visits = study.visits || [];
  const fieldOwnerMap = new Map<string, { form: CRFForm; field: CRFField }>();
  for (const form of study.forms || []) {
    for (const section of form.sections || []) {
      for (const field of section.fields || []) {
        if (!fieldOwnerMap.has(field.id)) {
          fieldOwnerMap.set(field.id, { form, field });
        }
      }
    }
  }

  // Sort known subjects and visits longest-first so prefix matching is unambiguous.
  const knownSubjects = Array.from(
    new Set([
      ...(simulationState?.availableSubjects || []),
      ...(simulationState?.auditLog || [])
        .map((a) => a.subjectId)
        .filter((s): s is string => Boolean(s)),
      ...(simulationState?.signatures || [])
        .map((s) => s.subjectId)
        .filter((s): s is string => Boolean(s)),
      ...(simulationState?.queries || [])
        .map((q) => q.subjectId)
        .filter((s): s is string => Boolean(s)),
    ])
  ).sort((a, b) => b.length - a.length);

  const sortedVisits = [...visits].sort((a, b) => b.id.length - a.id.length);
  const sortedFieldIds = Array.from(fieldOwnerMap.keys()).sort(
    (a, b) => b.length - a.length
  );

  // Prebuild suffix index `_${visit.id}_${field.id}` sorted longest-first for unknown subjects.
  const suffixPatterns: Array<{
    suffix: string;
    visitId: string;
    fieldId: string;
    formId: string;
  }> = [];
  for (const visit of sortedVisits) {
    for (const fieldId of sortedFieldIds) {
      const owner = fieldOwnerMap.get(fieldId)!;
      suffixPatterns.push({
        suffix: `_${visit.id}_${fieldId}`,
        visitId: visit.id,
        fieldId,
        formId: owner.form.id,
      });
    }
  }
  suffixPatterns.sort((a, b) => b.suffix.length - a.suffix.length);

  const cells: ParsedSimulationCell[] = [];

  for (const [key, value] of Object.entries(formValues)) {
    if (value === undefined) continue;

    let matched: ParsedSimulationCell | null = null;

    // Strategy A: Match known subject + known visit + known field (or remaining fieldId)
    for (const subj of knownSubjects) {
      const prefix = `${subj}_`;
      if (!key.startsWith(prefix)) continue;
      const afterSubject = key.slice(prefix.length);

      for (const visit of sortedVisits) {
        const vPrefix = `${visit.id}_`;
        if (!afterSubject.startsWith(vPrefix)) continue;
        const fieldId = afterSubject.slice(vPrefix.length);
        if (!fieldId) continue;
        const owner = fieldOwnerMap.get(fieldId);
        matched = {
          key,
          subjectId: subj,
          visitId: visit.id,
          formId: owner?.form.id,
          fieldId,
          value,
        };
        if (owner) break;
      }
      if (matched) break;
    }

    // Strategy B: Match known `_${visit.id}_${field.id}` suffix for ad-hoc subjects
    if (!matched) {
      for (const pat of suffixPatterns) {
        if (key.endsWith(pat.suffix) && key.length > pat.suffix.length) {
          const subjectId = key.slice(0, key.length - pat.suffix.length);
          matched = {
            key,
            subjectId,
            visitId: pat.visitId,
            formId: pat.formId,
            fieldId: pat.fieldId,
            value,
          };
          break;
        }
      }
    }

    // Strategy C: Fallback first/last underscore split if custom IDs not in protocol
    if (!matched) {
      const firstIdx = key.indexOf("_");
      const lastIdx = key.lastIndexOf("_");
      if (firstIdx > 0 && lastIdx > firstIdx && lastIdx < key.length - 1) {
        const subjectId = key.slice(0, firstIdx);
        const visitId = key.slice(firstIdx + 1, lastIdx);
        const fieldId = key.slice(lastIdx + 1);
        matched = {
          key,
          subjectId,
          visitId,
          formId: fieldOwnerMap.get(fieldId)?.form.id,
          fieldId,
          value,
        };
      }
    }

    if (matched) {
      cells.push(matched);
    }
  }

  return cells;
}

/**
 * Discovers all distinct simulated subjects in deterministic order.
 */
export function discoverSimulationSubjects(
  study: StudyProtocol,
  simulationState?: EdcSimulationState
): string[] {
  if (!simulationState) return [];
  const seen = new Set<string>();
  const ordered: string[] = [];

  const push = (subj?: string) => {
    const trimmed = subj?.trim();
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      ordered.push(trimmed);
    }
  };

  for (const subj of simulationState.availableSubjects || []) {
    push(subj);
  }
  for (const cell of parseSimulationFormValues(study, simulationState)) {
    push(cell.subjectId);
  }
  for (const sig of simulationState.signatures || []) {
    push(sig.subjectId);
  }
  for (const q of simulationState.queries || []) {
    push(q.subjectId);
  }
  for (const aud of simulationState.auditLog || []) {
    push(aud.subjectId);
  }

  return ordered;
}

/**
 * Returns true when `study.simulationState` holds at least one captured
 * form value, signature, or locked form record so statistical exporters emit
 * simulated clinical data instead of synthetic `101-1001` placeholder rows.
 */
export function hasSimulationRecords(study: StudyProtocol): boolean {
  const sim = study.simulationState;
  if (!sim) return false;

  if (sim.formValues) {
    for (const val of Object.values(sim.formValues)) {
      if (val !== undefined) {
        return true;
      }
    }
  }

  if (sim.signatures && sim.signatures.length > 0) {
    return true;
  }

  if (sim.lockedForms) {
    for (const lock of Object.values(sim.lockedForms)) {
      if (lock?.locked) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Extracts captured `(subjectId, visit)` rows for a given `CRFForm` from `study.simulationState`.
 */
export function extractCapturedFormRows(
  form: CRFForm,
  study: StudyProtocol
): CapturedFormRow[] {
  const sim = study.simulationState;
  if (!sim) return [];

  const formFields = (form.sections || []).flatMap((sec) => sec.fields || []);
  const formFieldIds = new Set(formFields.map((f) => f.id));

  const parsedCells = parseSimulationFormValues(study, sim);
  const subjects = discoverSimulationSubjects(study, sim);
  const visits: StudyVisit[] =
    study.visits && study.visits.length > 0
      ? study.visits
      : [
          {
            id: "v_default",
            oid: "SE.DEFAULT",
            name: "Visit 1",
            visitType: "Scheduled",
            targetDay: 1,
            windowBefore: 0,
            windowAfter: 0,
            assignedFormIds: [form.id],
          },
        ];

  // Index cells by `${subjectId}:::${visitId}`
  const bucketMap = new Map<
    string,
    Record<string, string | number | boolean | null>
  >();
  const extraVisitIds = new Set<string>();
  const knownVisitIds = new Set(visits.map((v) => v.id));

  for (const cell of parsedCells) {
    if (!formFieldIds.has(cell.fieldId)) continue;
    const bucketKey = `${cell.subjectId}:::${cell.visitId}`;
    let bucket = bucketMap.get(bucketKey);
    if (!bucket) {
      bucket = {};
      bucketMap.set(bucketKey, bucket);
    }
    bucket[cell.fieldId] = cell.value;
    if (!knownVisitIds.has(cell.visitId)) {
      extraVisitIds.add(cell.visitId);
    }
  }

  const allVisits: Array<{ id: string; name: string; num: number }> = [
    ...visits.map((v, idx) => ({ id: v.id, name: v.name, num: idx + 1 })),
    ...Array.from(extraVisitIds).map((id, idx) => ({
      id,
      name: id,
      num: visits.length + idx + 1,
    })),
  ];

  const rows: CapturedFormRow[] = [];

  for (const subjectId of subjects) {
    for (const visit of allVisits) {
      const bucketKey = `${subjectId}:::${visit.id}`;
      const values = bucketMap.get(bucketKey);
      const lockKey = `${subjectId}_${visit.id}_${form.id}`;
      const isLocked = Boolean(sim.lockedForms?.[lockKey]?.locked);
      const matchingSig = (sim.signatures || []).find(
        (s) =>
          s.subjectId === subjectId &&
          s.visitId === visit.id &&
          s.formId === form.id
      );

      if (!values && !isLocked && !matchingSig) {
        continue;
      }

      // Derive initiation ISO date from earliest audit or signature if available
      const matchingAudit = (sim.auditLog || []).find(
        (a) => a.subjectId === subjectId && a.formId === form.id
      );
      const rawTs =
        matchingAudit?.timestamp ||
        matchingSig?.timestamp ||
        sim.lockedForms?.[lockKey]?.timestamp;
      const isoDateMatch = rawTs?.match(/^(\d{4}-\d{2}-\d{2})/);
      const dtcInit = isoDateMatch ? isoDateMatch[1] : "2026-03-15";

      rows.push({
        subjectId,
        visitId: visit.id,
        visitName: visit.name,
        visitNum: visit.num,
        dtcInit,
        values: values || {},
      });
    }
  }

  return rows;
}

/**
 * Evaluates whether a multi-select or checkbox raw value selects `optionCode`.
 */
export function parseMultiSelectValue(
  raw: string,
  optionCode: string
): "Y" | "N" {
  const trimmed = raw.trim();
  if (!trimmed) return "N";
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map(String).includes(optionCode) ? "Y" : "N";
      }
    } catch {
      // fall through to delimiter split
    }
  }
  const tokens = trimmed
    .split(/[|,;]/)
    .map((t) => t.trim())
    .filter(Boolean);
  return tokens.includes(optionCode) ? "Y" : "N";
}
