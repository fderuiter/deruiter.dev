import type {
  CanonicalCrfDocument,
  CanonicalCrfIndexes,
  CanonicalCrfMetadata,
  CanonicalCrfSymbolTable,
  CanonicalFieldNode,
  CanonicalFormNode,
  CanonicalRuleNode,
  CodelistDefinition,
  CRFField,
  CRFForm,
  CRFSection,
  EditCheckRule,
  StudyProtocol,
  StudyVisit,
} from "../../types";
import { CodecValidationError } from "./types";

/**
 * Options controlling structural validation strictness when projecting a
 * `StudyProtocol` into a `CanonicalCrfDocument`.
 */
export interface CanonicalProjectionOptions {
  /**
   * `"strict"` enforces non-empty variable names, clinical data types, and
   * unique primary IDs across symbol tables for codec decode/encode.
   * `"storage"` validates structural array/record integrity while allowing
   * partial draft stubs stored in browser storage.
   */
  readonly mode?: "strict" | "storage";
}

/**
 * Outcome of validating a candidate study object against `CanonicalCrfDocument` invariants.
 */
export interface CanonicalValidationResult {
  readonly valid: boolean;
  readonly document?: CanonicalCrfDocument;
  readonly errors: readonly string[];
}

const VALID_CLINICAL_DATA_TYPES = new Set<string>([
  "text",
  "textarea",
  "number",
  "integer",
  "date",
  "partial_date",
  "precision_date",
  "time",
  "datetime",
  "single_select",
  "multi_select",
  "radio",
  "checkbox",
  "calculated",
  "vas_scale",
  "nrs_scale",
  "repeating_table",
]);

const VALID_VISIT_TYPES = new Set<string>([
  "Scheduled",
  "Unscheduled",
  "Common",
]);

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validateOptionalObjectArray(
  record: Record<string, unknown>,
  key: string,
  requireId: boolean,
  errors: string[]
): void {
  const val = record[key];
  if (val === undefined) return;
  if (!Array.isArray(val)) {
    errors.push(`${key} must be an array when present`);
    return;
  }
  for (let i = 0; i < val.length; i++) {
    const item = val[i];
    if (!isPlainRecord(item)) {
      errors.push(`${key}[${i}] must be a plain object`);
      continue;
    }
    if (requireId && (typeof item.id !== "string" || item.id.trim() === "")) {
      errors.push(`${key}[${i}].id must be a non-empty string`);
    }
  }
}

function validateFieldRecord(
  rawField: unknown,
  pathPrefix: string,
  strict: boolean,
  errors: string[]
): rawField is CRFField {
  if (!isPlainRecord(rawField)) {
    errors.push(`${pathPrefix} must be a plain object`);
    return false;
  }
  if (typeof rawField.id !== "string" || rawField.id.trim() === "") {
    errors.push(`${pathPrefix}.id must be a non-empty string`);
  }
  if (strict) {
    if (
      typeof rawField.variableName !== "string" ||
      rawField.variableName.trim() === ""
    ) {
      errors.push(`${pathPrefix}.variableName must be a non-empty string`);
    } else if (rawField.variableName.length > 128) {
      errors.push(
        `${pathPrefix}.variableName exceeds structural 128-character bound`
      );
    }
    if (typeof rawField.label !== "string" || rawField.label.trim() === "") {
      errors.push(`${pathPrefix}.label must be a non-empty string`);
    }
    if (
      typeof rawField.dataType !== "string" ||
      !VALID_CLINICAL_DATA_TYPES.has(rawField.dataType)
    ) {
      errors.push(
        `${pathPrefix}.dataType "${String(rawField.dataType)}" is not a supported ClinicalDataType`
      );
    }
  } else {
    if (
      rawField.variableName !== undefined &&
      typeof rawField.variableName !== "string"
    ) {
      errors.push(`${pathPrefix}.variableName must be a string`);
    }
    if (
      rawField.dataType !== undefined &&
      typeof rawField.dataType !== "string"
    ) {
      errors.push(`${pathPrefix}.dataType must be a string`);
    }
  }

  if (
    rawField.customOptions !== undefined &&
    !Array.isArray(rawField.customOptions)
  ) {
    errors.push(`${pathPrefix}.customOptions must be an array`);
  }
  if (
    rawField.unitOptions !== undefined &&
    !Array.isArray(rawField.unitOptions)
  ) {
    errors.push(`${pathPrefix}.unitOptions must be an array`);
  }
  if (rawField.repeatingColumns !== undefined) {
    if (!Array.isArray(rawField.repeatingColumns)) {
      errors.push(`${pathPrefix}.repeatingColumns must be an array`);
    } else {
      rawField.repeatingColumns.forEach((col, colIdx) => {
        validateFieldRecord(
          col,
          `${pathPrefix}.repeatingColumns[${colIdx}]`,
          strict,
          errors
        );
      });
    }
  }
  return errors.length === 0;
}

function validateRuleRecord(
  rawRule: unknown,
  pathPrefix: string,
  strict: boolean,
  errors: string[]
): rawRule is EditCheckRule {
  if (!isPlainRecord(rawRule)) {
    errors.push(`${pathPrefix} must be a plain object`);
    return false;
  }
  if (typeof rawRule.id !== "string" || rawRule.id.trim() === "") {
    errors.push(`${pathPrefix}.id must be a non-empty string`);
  }
  if (strict) {
    if (typeof rawRule.name !== "string" || rawRule.name.trim() === "") {
      errors.push(`${pathPrefix}.name must be a non-empty string`);
    }
    if (!Array.isArray(rawRule.triggerFieldIds)) {
      errors.push(`${pathPrefix}.triggerFieldIds must be an array`);
    }
    if (!Array.isArray(rawRule.conditions)) {
      errors.push(`${pathPrefix}.conditions must be an array`);
    }
  } else {
    if (
      rawRule.triggerFieldIds !== undefined &&
      !Array.isArray(rawRule.triggerFieldIds)
    ) {
      errors.push(`${pathPrefix}.triggerFieldIds must be an array`);
    }
    if (
      rawRule.conditions !== undefined &&
      !Array.isArray(rawRule.conditions)
    ) {
      errors.push(`${pathPrefix}.conditions must be an array`);
    }
  }
  if (
    rawRule.conditionGroups !== undefined &&
    !Array.isArray(rawRule.conditionGroups)
  ) {
    errors.push(`${pathPrefix}.conditionGroups must be an array`);
  }
  return errors.length === 0;
}

/**
 * Validates any candidate value and constructs an indexed `CanonicalCrfDocument` when valid.
 */
export function validateCanonicalCrfDocument(
  candidate: unknown,
  options: CanonicalProjectionOptions = {}
): CanonicalValidationResult {
  const mode = options.mode ?? "strict";
  const strict = mode === "strict";
  const errors: string[] = [];

  if (!isPlainRecord(candidate)) {
    return {
      valid: false,
      errors: ["Study protocol must be a non-null plain object"],
    };
  }

  if (typeof candidate.id !== "string" || candidate.id.trim() === "") {
    errors.push("id must be a non-empty string");
  }

  if (strict) {
    const hasProtoNumber =
      typeof candidate.protocolNumber === "string" &&
      candidate.protocolNumber.trim().length > 0;
    const hasProtoId =
      typeof candidate.protocolId === "string" &&
      candidate.protocolId.trim().length > 0;
    if (!hasProtoNumber && !hasProtoId) {
      errors.push(
        "protocolNumber or protocolId must be a non-empty string in strict mode"
      );
    }
  } else {
    if (
      candidate.protocolNumber !== undefined &&
      typeof candidate.protocolNumber !== "string"
    ) {
      errors.push("protocolNumber must be a string when present");
    }
    if (
      candidate.protocolId !== undefined &&
      typeof candidate.protocolId !== "string"
    ) {
      errors.push("protocolId must be a string when present");
    }
  }

  if (!Array.isArray(candidate.forms)) {
    errors.push("forms must be an array");
  }
  if (!Array.isArray(candidate.visits)) {
    errors.push("visits must be an array");
  }
  if (!Array.isArray(candidate.codelists)) {
    errors.push("codelists must be an array");
  }

  validateOptionalObjectArray(candidate, "rules", true, errors);
  validateOptionalObjectArray(candidate, "arms", true, errors);
  validateOptionalObjectArray(candidate, "epochs", true, errors);
  validateOptionalObjectArray(candidate, "cohorts", true, errors);
  validateOptionalObjectArray(candidate, "eligibilityCriteria", true, errors);
  validateOptionalObjectArray(candidate, "objectives", true, errors);
  validateOptionalObjectArray(candidate, "interventions", true, errors);
  validateOptionalObjectArray(candidate, "biomedicalConcepts", true, errors);
  validateOptionalObjectArray(candidate, "testScenarios", true, errors);
  validateOptionalObjectArray(candidate, "reviewThreads", true, errors);
  validateOptionalObjectArray(candidate, "auditTrail", true, errors);
  validateOptionalObjectArray(candidate, "auditLog", true, errors);
  validateOptionalObjectArray(candidate, "libraryUses", false, errors);

  if (candidate.branding !== undefined && !isPlainRecord(candidate.branding)) {
    errors.push("branding must be a plain object when present");
  }
  if (
    candidate.provenance !== undefined &&
    !isPlainRecord(candidate.provenance)
  ) {
    errors.push("provenance must be a plain object when present");
  }
  if (
    candidate.simulationState !== undefined &&
    !isPlainRecord(candidate.simulationState)
  ) {
    errors.push("simulationState must be a plain object when present");
  }
  if (
    candidate.population !== undefined &&
    !isPlainRecord(candidate.population)
  ) {
    errors.push("population must be a plain object when present");
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const rawForms = candidate.forms as unknown[];
  const rawVisits = candidate.visits as unknown[];
  const rawCodelists = candidate.codelists as unknown[];
  const rawStudyRules = Array.isArray(candidate.rules)
    ? (candidate.rules as unknown[])
    : [];

  const formOrder: string[] = [];
  const formsById: Record<string, CanonicalFormNode> = {};
  const fieldOrder: string[] = [];
  const fieldsById: Record<string, CanonicalFieldNode> = {};
  const visitOrder: string[] = [];
  const visitsById: Record<string, StudyVisit> = {};
  const codelistOrder: string[] = [];
  const codelistsById: Record<string, CodelistDefinition> = {};
  const ruleOrder: string[] = [];
  const rulesById: Record<string, CanonicalRuleNode> = {};

  const visitIdByOid: Record<string, string> = {};
  const fieldKeysByFormVariable: Record<string, string[]> = {};
  const fieldKeysByFormFieldId: Record<string, string[]> = {};
  const formIdsByDomain: Record<string, string[]> = {};
  const visitIdsByFormId: Record<string, string[]> = {};

  const registerField = (
    formId: string,
    formDomain: string,
    formName: string,
    sectionId: string,
    sectionTitle: string,
    field: CRFField,
    formFieldKeys: string[],
    parentFieldId?: string
  ) => {
    const baseKey = parentFieldId
      ? `${formId}::${parentFieldId}::${field.id}`
      : `${formId}::${field.id}`;
    let symbolKey = baseKey;
    if (fieldsById[symbolKey]) {
      let suffix = 2;
      while (fieldsById[`${baseKey}#${suffix}`]) {
        suffix++;
      }
      symbolKey = `${baseKey}#${suffix}`;
    }

    fieldOrder.push(symbolKey);
    formFieldKeys.push(symbolKey);
    fieldsById[symbolKey] = {
      key: symbolKey,
      formId,
      formDomain,
      formName,
      sectionId,
      sectionTitle,
      ...(parentFieldId ? { parentFieldId } : {}),
      field,
    };

    const formFieldLookupKey = `${formId}::${field.id}`;
    if (!fieldKeysByFormFieldId[formFieldLookupKey]) {
      fieldKeysByFormFieldId[formFieldLookupKey] = [];
    }
    fieldKeysByFormFieldId[formFieldLookupKey].push(symbolKey);

    if (typeof field.variableName === "string" && field.variableName.trim()) {
      const varLookupKey = `${formId}::${field.variableName.trim().toUpperCase()}`;
      if (!fieldKeysByFormVariable[varLookupKey]) {
        fieldKeysByFormVariable[varLookupKey] = [];
      }
      fieldKeysByFormVariable[varLookupKey].push(symbolKey);
    }

    if (Array.isArray(field.repeatingColumns)) {
      for (const col of field.repeatingColumns) {
        registerField(
          formId,
          formDomain,
          formName,
          sectionId,
          sectionTitle,
          col,
          formFieldKeys,
          field.id
        );
      }
    }
  };

  for (let fIdx = 0; fIdx < rawForms.length; fIdx++) {
    const rawForm = rawForms[fIdx];
    if (!isPlainRecord(rawForm)) {
      errors.push(`forms[${fIdx}] must be a plain object`);
      continue;
    }
    if (typeof rawForm.id !== "string" || rawForm.id.trim() === "") {
      errors.push(`forms[${fIdx}].id must be a non-empty string`);
      continue;
    }
    if (strict) {
      if (typeof rawForm.name !== "string" || rawForm.name.trim() === "") {
        errors.push(`forms[${fIdx}].name must be a non-empty string`);
      }
      if (
        rawForm.domain !== undefined &&
        typeof rawForm.domain === "string" &&
        rawForm.domain.length > 64
      ) {
        errors.push(
          `forms[${fIdx}].domain exceeds structural 64-character bound`
        );
      }
    }
    if (formsById[rawForm.id]) {
      if (strict) {
        errors.push(`Duplicate form id "${rawForm.id}" in forms symbol table`);
        continue;
      }
    }

    if (rawForm.sections !== undefined && !Array.isArray(rawForm.sections)) {
      errors.push(`forms[${fIdx}].sections must be an array`);
      continue;
    }
    if (rawForm.rules !== undefined && !Array.isArray(rawForm.rules)) {
      errors.push(`forms[${fIdx}].rules must be an array`);
      continue;
    }

    const sectionsRaw = Array.isArray(rawForm.sections)
      ? (rawForm.sections as unknown[])
      : [];
    const rulesRaw = Array.isArray(rawForm.rules)
      ? (rawForm.rules as unknown[])
      : [];

    const normalizedSections: CRFSection[] = [];
    const formFieldKeys: string[] = [];
    const formRuleKeys: string[] = [];
    const formDomain = typeof rawForm.domain === "string" ? rawForm.domain : "";
    const formName =
      typeof rawForm.name === "string" ? rawForm.name : rawForm.id;

    for (let sIdx = 0; sIdx < sectionsRaw.length; sIdx++) {
      const rawSec = sectionsRaw[sIdx];
      if (!isPlainRecord(rawSec)) {
        errors.push(`forms[${fIdx}].sections[${sIdx}] must be a plain object`);
        continue;
      }
      if (typeof rawSec.id !== "string" || rawSec.id.trim() === "") {
        errors.push(
          `forms[${fIdx}].sections[${sIdx}].id must be a non-empty string`
        );
        continue;
      }
      if (
        strict &&
        (typeof rawSec.title !== "string" || rawSec.title.trim() === "")
      ) {
        errors.push(
          `forms[${fIdx}].sections[${sIdx}].title must be a non-empty string`
        );
      }
      if (rawSec.fields !== undefined && !Array.isArray(rawSec.fields)) {
        errors.push(`forms[${fIdx}].sections[${sIdx}].fields must be an array`);
        continue;
      }
      const secFieldsRaw = Array.isArray(rawSec.fields)
        ? (rawSec.fields as unknown[])
        : [];
      const secTitle =
        typeof rawSec.title === "string" ? rawSec.title : rawSec.id;

      for (let fldIdx = 0; fldIdx < secFieldsRaw.length; fldIdx++) {
        const fldCandidate = secFieldsRaw[fldIdx];
        validateFieldRecord(
          fldCandidate,
          `forms[${fIdx}].sections[${sIdx}].fields[${fldIdx}]`,
          strict,
          errors
        );
        if (
          isPlainRecord(fldCandidate) &&
          typeof fldCandidate.id === "string" &&
          fldCandidate.id.trim() !== ""
        ) {
          registerField(
            rawForm.id,
            formDomain,
            formName,
            rawSec.id,
            secTitle,
            fldCandidate as unknown as CRFField,
            formFieldKeys
          );
        }
      }

      normalizedSections.push({
        ...(rawSec as unknown as CRFSection),
        id: rawSec.id,
        title: secTitle,
        fields: secFieldsRaw as CRFField[],
      });
    }

    for (let rIdx = 0; rIdx < rulesRaw.length; rIdx++) {
      const ruleCandidate = rulesRaw[rIdx];
      validateRuleRecord(
        ruleCandidate,
        `forms[${fIdx}].rules[${rIdx}]`,
        strict,
        errors
      );
      if (
        isPlainRecord(ruleCandidate) &&
        typeof ruleCandidate.id === "string" &&
        ruleCandidate.id.trim() !== ""
      ) {
        const baseRuleKey = `${rawForm.id}::${ruleCandidate.id}`;
        let ruleKey = baseRuleKey;
        if (rulesById[ruleKey]) {
          if (strict) {
            errors.push(
              `Duplicate rule id "${ruleCandidate.id}" in form "${rawForm.id}"`
            );
            continue;
          }
          let suffix = 2;
          while (rulesById[`${baseRuleKey}#${suffix}`]) suffix++;
          ruleKey = `${baseRuleKey}#${suffix}`;
        }
        ruleOrder.push(ruleKey);
        formRuleKeys.push(ruleKey);
        rulesById[ruleKey] = {
          key: ruleKey,
          scope: "form",
          formId: rawForm.id,
          formDomain,
          formName,
          rule: ruleCandidate as unknown as EditCheckRule,
        };
      }
    }

    const normalizedForm: CRFForm = {
      ...(rawForm as unknown as CRFForm),
      id: rawForm.id,
      name: formName,
      domain: formDomain,
      description:
        typeof rawForm.description === "string" ? rawForm.description : "",
      version: typeof rawForm.version === "string" ? rawForm.version : "1.0",
      sections: normalizedSections,
      rules: rulesRaw as EditCheckRule[],
    };

    if (!formsById[rawForm.id]) {
      formOrder.push(rawForm.id);
    }
    formsById[rawForm.id] = {
      form: normalizedForm,
      fieldIds: formFieldKeys,
      ruleIds: formRuleKeys,
    };

    const domainKey = formDomain.trim().toUpperCase();
    if (domainKey) {
      if (!formIdsByDomain[domainKey]) {
        formIdsByDomain[domainKey] = [];
      }
      formIdsByDomain[domainKey].push(rawForm.id);
    }
  }

  for (let rIdx = 0; rIdx < rawStudyRules.length; rIdx++) {
    const ruleCandidate = rawStudyRules[rIdx];
    validateRuleRecord(ruleCandidate, `rules[${rIdx}]`, strict, errors);
    if (
      isPlainRecord(ruleCandidate) &&
      typeof ruleCandidate.id === "string" &&
      ruleCandidate.id.trim() !== ""
    ) {
      const baseRuleKey = `study::${ruleCandidate.id}`;
      if (rulesById[baseRuleKey] && strict) {
        errors.push(`Duplicate study-level rule id "${ruleCandidate.id}"`);
        continue;
      }
      let ruleKey = baseRuleKey;
      if (rulesById[ruleKey]) {
        let suffix = 2;
        while (rulesById[`${baseRuleKey}#${suffix}`]) suffix++;
        ruleKey = `${baseRuleKey}#${suffix}`;
      }
      ruleOrder.push(ruleKey);
      rulesById[ruleKey] = {
        key: ruleKey,
        scope: "study",
        rule: ruleCandidate as unknown as EditCheckRule,
      };
    }
  }

  for (let vIdx = 0; vIdx < rawVisits.length; vIdx++) {
    const rawVisit = rawVisits[vIdx];
    if (!isPlainRecord(rawVisit)) {
      errors.push(`visits[${vIdx}] must be a plain object`);
      continue;
    }
    if (typeof rawVisit.id !== "string" || rawVisit.id.trim() === "") {
      errors.push(`visits[${vIdx}].id must be a non-empty string`);
      continue;
    }
    if (visitsById[rawVisit.id] && strict) {
      errors.push(`Duplicate visit id "${rawVisit.id}" in visits symbol table`);
      continue;
    }
    if (
      rawVisit.assignedFormIds !== undefined &&
      !Array.isArray(rawVisit.assignedFormIds)
    ) {
      errors.push(`visits[${vIdx}].assignedFormIds must be an array`);
      continue;
    }
    if (Array.isArray(rawVisit.assignedFormIds)) {
      for (let aIdx = 0; aIdx < rawVisit.assignedFormIds.length; aIdx++) {
        if (typeof rawVisit.assignedFormIds[aIdx] !== "string") {
          errors.push(
            `visits[${vIdx}].assignedFormIds[${aIdx}] must be a string`
          );
        }
      }
    }
    if (
      strict &&
      rawVisit.visitType !== undefined &&
      (typeof rawVisit.visitType !== "string" ||
        !VALID_VISIT_TYPES.has(rawVisit.visitType))
    ) {
      errors.push(
        `visits[${vIdx}].visitType "${String(rawVisit.visitType)}" must be Scheduled, Unscheduled, or Common`
      );
    }

    const assignedFormIds = Array.isArray(rawVisit.assignedFormIds)
      ? (rawVisit.assignedFormIds as string[])
      : [];
    const normalizedVisit: StudyVisit = {
      ...(rawVisit as unknown as StudyVisit),
      id: rawVisit.id,
      oid:
        typeof rawVisit.oid === "string" && rawVisit.oid.trim()
          ? rawVisit.oid
          : `SE.${rawVisit.id.toUpperCase()}`,
      name: typeof rawVisit.name === "string" ? rawVisit.name : rawVisit.id,
      visitType:
        typeof rawVisit.visitType === "string" &&
        VALID_VISIT_TYPES.has(rawVisit.visitType)
          ? (rawVisit.visitType as StudyVisit["visitType"])
          : "Scheduled",
      targetDay:
        typeof rawVisit.targetDay === "number" ? rawVisit.targetDay : 0,
      windowBefore:
        typeof rawVisit.windowBefore === "number" ? rawVisit.windowBefore : 0,
      windowAfter:
        typeof rawVisit.windowAfter === "number" ? rawVisit.windowAfter : 0,
      assignedFormIds,
    };

    if (!visitsById[rawVisit.id]) {
      visitOrder.push(rawVisit.id);
    }
    visitsById[rawVisit.id] = normalizedVisit;
    if (normalizedVisit.oid) {
      visitIdByOid[normalizedVisit.oid] = rawVisit.id;
    }

    const scheduledForVisit = new Set<string>(assignedFormIds);
    if (isPlainRecord(rawVisit.armFormAssignments)) {
      for (const armForms of Object.values(rawVisit.armFormAssignments)) {
        if (Array.isArray(armForms)) {
          for (const fId of armForms) {
            if (typeof fId === "string") scheduledForVisit.add(fId);
          }
        }
      }
    }
    for (const fId of scheduledForVisit) {
      if (!visitIdsByFormId[fId]) {
        visitIdsByFormId[fId] = [];
      }
      visitIdsByFormId[fId].push(rawVisit.id);
    }
  }

  for (let cIdx = 0; cIdx < rawCodelists.length; cIdx++) {
    const rawCl = rawCodelists[cIdx];
    if (!isPlainRecord(rawCl)) {
      errors.push(`codelists[${cIdx}] must be a plain object`);
      continue;
    }
    if (typeof rawCl.id !== "string" || rawCl.id.trim() === "") {
      errors.push(`codelists[${cIdx}].id must be a non-empty string`);
      continue;
    }
    if (codelistsById[rawCl.id] && strict) {
      errors.push(
        `Duplicate codelist id "${rawCl.id}" in codelists symbol table`
      );
      continue;
    }
    if (rawCl.options !== undefined && !Array.isArray(rawCl.options)) {
      errors.push(`codelists[${cIdx}].options must be an array`);
      continue;
    }
    if (Array.isArray(rawCl.options)) {
      for (let oIdx = 0; oIdx < rawCl.options.length; oIdx++) {
        const opt = rawCl.options[oIdx];
        if (!isPlainRecord(opt)) {
          errors.push(
            `codelists[${cIdx}].options[${oIdx}] must be a plain object`
          );
        } else if (
          strict &&
          (typeof opt.code !== "string" || typeof opt.label !== "string")
        ) {
          errors.push(
            `codelists[${cIdx}].options[${oIdx}] must carry string code and label`
          );
        }
      }
    }
    if (!codelistsById[rawCl.id]) {
      codelistOrder.push(rawCl.id);
    }
    codelistsById[rawCl.id] = {
      ...(rawCl as unknown as CodelistDefinition),
      id: rawCl.id,
      name: typeof rawCl.name === "string" ? rawCl.name : rawCl.id,
      options: Array.isArray(rawCl.options)
        ? (rawCl.options as CodelistDefinition["options"])
        : [],
    };
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const resolvedProtocolNumber =
    (typeof candidate.protocolNumber === "string" &&
    candidate.protocolNumber.trim()
      ? candidate.protocolNumber
      : undefined) ??
    (typeof candidate.protocolId === "string" && candidate.protocolId.trim()
      ? candidate.protocolId
      : undefined) ??
    (candidate.id as string);

  const resolvedStudyName =
    (typeof candidate.studyName === "string" && candidate.studyName.trim()
      ? candidate.studyName
      : undefined) ??
    (typeof candidate.title === "string" && candidate.title.trim()
      ? candidate.title
      : undefined) ??
    resolvedProtocolNumber;

  const studyCandidate = candidate as unknown as StudyProtocol;

  const metadata: CanonicalCrfMetadata = {
    ...(typeof studyCandidate.$schema === "string"
      ? { $schema: studyCandidate.$schema }
      : {}),
    ...(typeof studyCandidate.schemaVersion === "string"
      ? { schemaVersion: studyCandidate.schemaVersion }
      : {}),
    id: studyCandidate.id,
    protocolNumber: resolvedProtocolNumber,
    ...(studyCandidate.protocolId !== undefined
      ? { protocolId: studyCandidate.protocolId }
      : {}),
    studyName: resolvedStudyName,
    ...(studyCandidate.title !== undefined
      ? { title: studyCandidate.title }
      : {}),
    phase:
      typeof studyCandidate.phase === "string" && studyCandidate.phase.trim()
        ? studyCandidate.phase
        : "Phase III",
    sponsor:
      typeof studyCandidate.sponsor === "string"
        ? studyCandidate.sponsor
        : "Clinical Sponsor",
    therapeuticArea:
      typeof studyCandidate.therapeuticArea === "string"
        ? studyCandidate.therapeuticArea
        : "General Medicine",
    version:
      typeof studyCandidate.version === "string" &&
      studyCandidate.version.trim()
        ? studyCandidate.version
        : "1.0",
    lastModified:
      typeof studyCandidate.lastModified === "string"
        ? studyCandidate.lastModified
        : "",
    ...(studyCandidate.branding !== undefined
      ? { branding: studyCandidate.branding }
      : {}),
    ...(studyCandidate.arms !== undefined ? { arms: studyCandidate.arms } : {}),
    ...(studyCandidate.epochs !== undefined
      ? { epochs: studyCandidate.epochs }
      : {}),
    ...(studyCandidate.cohorts !== undefined
      ? { cohorts: studyCandidate.cohorts }
      : {}),
    ...(studyCandidate.population !== undefined
      ? { population: studyCandidate.population }
      : {}),
    ...(studyCandidate.eligibilityCriteria !== undefined
      ? { eligibilityCriteria: studyCandidate.eligibilityCriteria }
      : {}),
    ...(studyCandidate.objectives !== undefined
      ? { objectives: studyCandidate.objectives }
      : {}),
    ...(studyCandidate.interventions !== undefined
      ? { interventions: studyCandidate.interventions }
      : {}),
    ...(studyCandidate.biomedicalConcepts !== undefined
      ? { biomedicalConcepts: studyCandidate.biomedicalConcepts }
      : {}),
    ...(studyCandidate.provenance !== undefined
      ? { provenance: studyCandidate.provenance }
      : {}),
    ...(studyCandidate.testScenarios !== undefined
      ? { testScenarios: studyCandidate.testScenarios }
      : {}),
    ...(studyCandidate.reviewThreads !== undefined
      ? { reviewThreads: studyCandidate.reviewThreads }
      : {}),
    ...(studyCandidate.simulationState !== undefined
      ? { simulationState: studyCandidate.simulationState }
      : {}),
    ...(studyCandidate.auditTrail !== undefined
      ? { auditTrail: studyCandidate.auditTrail }
      : {}),
    ...(studyCandidate.libraryUses !== undefined
      ? { libraryUses: studyCandidate.libraryUses }
      : {}),
    ...(studyCandidate.auditLog !== undefined
      ? { auditLog: studyCandidate.auditLog }
      : {}),
  };

  const formsTable: CanonicalCrfSymbolTable<CanonicalFormNode> = {
    order: formOrder,
    byId: formsById,
  };
  const fieldsTable: CanonicalCrfSymbolTable<CanonicalFieldNode> = {
    order: fieldOrder,
    byId: fieldsById,
  };
  const visitsTable: CanonicalCrfSymbolTable<StudyVisit> = {
    order: visitOrder,
    byId: visitsById,
  };
  const codelistsTable: CanonicalCrfSymbolTable<CodelistDefinition> = {
    order: codelistOrder,
    byId: codelistsById,
  };
  const rulesTable: CanonicalCrfSymbolTable<CanonicalRuleNode> = {
    order: ruleOrder,
    byId: rulesById,
  };
  const indexes: CanonicalCrfIndexes = {
    visitIdByOid,
    fieldKeysByFormVariable,
    fieldKeysByFormFieldId,
    formIdsByDomain,
    visitIdsByFormId,
  };

  return {
    valid: true,
    document: {
      kind: "CanonicalCrfDocument",
      irVersion: "1.0.0",
      metadata,
      forms: formsTable,
      fields: fieldsTable,
      visits: visitsTable,
      codelists: codelistsTable,
      rules: rulesTable,
      indexes,
    },
    errors: [],
  };
}

/**
 * Projects a `StudyProtocol` into an indexed `CanonicalCrfDocument`, throwing
 * `CodecValidationError` if structural invariants are violated.
 */
export function toCanonicalCrfDocument(
  study: StudyProtocol,
  options: CanonicalProjectionOptions = {}
): CanonicalCrfDocument {
  const result = validateCanonicalCrfDocument(study, options);
  if (!result.valid || !result.document) {
    throw new CodecValidationError(
      "canonical_ir",
      `Invalid CanonicalCrfDocument: ${result.errors.slice(0, 5).join("; ")}`,
      result.errors
    );
  }
  return result.document;
}

/**
 * Asserts that an existing `CanonicalCrfDocument` upholds all symbol-table
 * invariants and returns its lossless `StudyProtocol` projection.
 */
export function fromCanonicalCrfDocument(
  doc: CanonicalCrfDocument
): StudyProtocol {
  if (!doc || doc.kind !== "CanonicalCrfDocument") {
    throw new CodecValidationError(
      "canonical_ir",
      "Expected a valid CanonicalCrfDocument instance."
    );
  }

  const forms: CRFForm[] = doc.forms.order.map((formId) => {
    const node = doc.forms.byId[formId];
    if (!node) {
      throw new CodecValidationError(
        "canonical_ir",
        `CanonicalCrfDocument forms symbol table is missing "${formId}".`
      );
    }
    return node.form;
  });

  const visits: StudyVisit[] = doc.visits.order.map((visitId) => {
    const visit = doc.visits.byId[visitId];
    if (!visit) {
      throw new CodecValidationError(
        "canonical_ir",
        `CanonicalCrfDocument visits symbol table is missing "${visitId}".`
      );
    }
    return visit;
  });

  const codelists: CodelistDefinition[] = doc.codelists.order.map((clId) => {
    const cl = doc.codelists.byId[clId];
    if (!cl) {
      throw new CodecValidationError(
        "canonical_ir",
        `CanonicalCrfDocument codelists symbol table is missing "${clId}".`
      );
    }
    return cl;
  });

  const studyRules: EditCheckRule[] = [];
  for (const ruleKey of doc.rules.order) {
    const ruleNode = doc.rules.byId[ruleKey];
    if (!ruleNode) {
      throw new CodecValidationError(
        "canonical_ir",
        `CanonicalCrfDocument rules symbol table is missing "${ruleKey}".`
      );
    }
    if (ruleNode.scope === "study") {
      studyRules.push(ruleNode.rule);
    }
  }

  const meta = doc.metadata;
  const study: StudyProtocol = {
    ...(meta.$schema !== undefined ? { $schema: meta.$schema } : {}),
    ...(meta.schemaVersion !== undefined
      ? { schemaVersion: meta.schemaVersion }
      : {}),
    id: meta.id,
    protocolNumber: meta.protocolNumber,
    ...(meta.protocolId !== undefined ? { protocolId: meta.protocolId } : {}),
    studyName: meta.studyName,
    ...(meta.title !== undefined ? { title: meta.title } : {}),
    phase: meta.phase,
    sponsor: meta.sponsor,
    therapeuticArea: meta.therapeuticArea,
    version: meta.version,
    lastModified: meta.lastModified,
    forms,
    visits,
    codelists,
    ...(studyRules.length > 0 ? { rules: studyRules } : {}),
    ...(meta.branding !== undefined ? { branding: meta.branding } : {}),
    ...(meta.arms !== undefined ? { arms: meta.arms } : {}),
    ...(meta.epochs !== undefined ? { epochs: meta.epochs } : {}),
    ...(meta.cohorts !== undefined ? { cohorts: meta.cohorts } : {}),
    ...(meta.population !== undefined ? { population: meta.population } : {}),
    ...(meta.eligibilityCriteria !== undefined
      ? { eligibilityCriteria: meta.eligibilityCriteria }
      : {}),
    ...(meta.objectives !== undefined ? { objectives: meta.objectives } : {}),
    ...(meta.interventions !== undefined
      ? { interventions: meta.interventions }
      : {}),
    ...(meta.biomedicalConcepts !== undefined
      ? { biomedicalConcepts: meta.biomedicalConcepts }
      : {}),
    ...(meta.provenance !== undefined ? { provenance: meta.provenance } : {}),
    ...(meta.testScenarios !== undefined
      ? { testScenarios: meta.testScenarios }
      : {}),
    ...(meta.reviewThreads !== undefined
      ? { reviewThreads: meta.reviewThreads }
      : {}),
    ...(meta.simulationState !== undefined
      ? { simulationState: meta.simulationState }
      : {}),
    ...(meta.auditTrail !== undefined ? { auditTrail: meta.auditTrail } : {}),
    ...(meta.libraryUses !== undefined
      ? { libraryUses: meta.libraryUses }
      : {}),
    ...(meta.auditLog !== undefined ? { auditLog: meta.auditLog } : {}),
  };

  return study;
}
