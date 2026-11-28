/**
 * Shared Export Preparation Context & Statistical Helpers for CRF Studio
 *
 * Centralizes form-scope validation/filtering, study and standard codelist
 * indexing, per-field option resolution, multi-select EDC value parsing, and
 * 32-character identifier deduplication across R, SAS, DOCX, and PDF exporters.
 *
 * Intentionally free of `docx` and `jspdf` imports so lazy document bundles
 * remain isolated from the primary `@/lib/crf` entry point.
 */

import { STANDARD_CODELISTS } from "@/lib/clinical-standards";
import type {
  CodelistDefinition,
  CodelistOption,
  CRFField,
  CRFForm,
  ExportDocxOptions,
  ExportPdfOptions,
  ExportROptions,
  ExportSasOptions,
  StudyProtocol,
} from "../types";

function indexCodelistsById(
  codelists: readonly CodelistDefinition[] | undefined
): ReadonlyMap<string, CodelistDefinition> {
  const map = new Map<string, CodelistDefinition>();
  if (!codelists) return map;
  for (const codelist of codelists) {
    if (!map.has(codelist.id)) {
      map.set(codelist.id, codelist);
    }
  }
  return map;
}

/** Pre-indexed CDISC and sponsor standard codelists keyed by codelist ID. */
export const STANDARD_CODELISTS_BY_ID: ReadonlyMap<string, CodelistDefinition> =
  indexCodelistsById(STANDARD_CODELISTS);

/** Pre-resolved dichotomous No/Yes (`CL_NY`) standard codelist. */
export const NY_CODELIST: CodelistDefinition | undefined =
  STANDARD_CODELISTS_BY_ID.get("CL_NY");

/** Default mock choices rendered by DOCX and PDF when a select/radio field has no options. */
export const DEFAULT_DOCUMENT_SELECT_OPTIONS: CodelistOption[] = [
  { code: "1", label: "Option 1", order: 1 },
  { code: "2", label: "Option 2", order: 2 },
];

export type DocumentExportScopeOptions = Pick<
  ExportDocxOptions | ExportPdfOptions,
  "scope" | "selectedFormIds"
>;

export type StatisticalExportScopeOptions = Pick<
  ExportROptions | ExportSasOptions,
  "selectedFormId"
>;

export interface ExplicitFormsExportScope {
  forms: CRFForm[];
}

export type ExportScopeRequest =
  | DocumentExportScopeOptions
  | StatisticalExportScopeOptions
  | ExplicitFormsExportScope;

export interface PreparedExportContext {
  study: StudyProtocol;
  forms: CRFForm[];
  headerScope?: string;
  studyCodelistsById: ReadonlyMap<string, CodelistDefinition>;
  nyCodelist: CodelistDefinition | undefined;
  activeCodelists: CodelistDefinition[];
  studyCodelistByField: ReadonlyMap<CRFField, CodelistDefinition | undefined>;
  fieldOptionsByField: ReadonlyMap<CRFField, CodelistOption[]>;
  documentOptionsByField: ReadonlyMap<CRFField, CodelistOption[] | undefined>;
}

/**
 * Looks up a codelist by ID within a study's `codelists` collection.
 */
export function lookupStudyCodelist(
  study: StudyProtocol,
  codelistId: string | undefined
): CodelistDefinition | undefined {
  if (!codelistId || !study.codelists) return undefined;
  return study.codelists.find((c) => c.id === codelistId);
}

function computeStatisticalFieldOptions(
  field: CRFField,
  studyCodelist: CodelistDefinition | undefined
): CodelistOption[] {
  if (field.customOptions && field.customOptions.length > 0) {
    return field.customOptions;
  }
  if (field.codelistId) {
    const cl = studyCodelist || STANDARD_CODELISTS_BY_ID.get(field.codelistId);
    if (cl && cl.options && cl.options.length > 0) {
      return cl.options;
    }
  }
  if (field.dataType === "checkbox" || field.dataType === "multi_select") {
    if (NY_CODELIST) return NY_CODELIST.options;
  }
  return [];
}

/**
 * Retrieves field options from custom options or referenced codelists.
 */
export function getFieldOptions(
  field: CRFField,
  study: StudyProtocol
): CodelistOption[] {
  return computeStatisticalFieldOptions(
    field,
    lookupStudyCodelist(study, field.codelistId)
  );
}

/**
 * Parses a comma-separated multi-select EDC response string
 * and checks whether a specific option code is selected.
 * Returns 'Y' if selected, 'N' if absent/unselected.
 */
export function parseMultiSelectValue(
  edcValue: string | string[] | boolean | null | undefined,
  optionCode: string
): "Y" | "N" {
  if (edcValue === null || edcValue === undefined || edcValue === false)
    return "N";
  if (edcValue === true) return "Y";
  let selectedCodes: string[] = [];
  if (Array.isArray(edcValue)) {
    selectedCodes = edcValue.map((s) => String(s).trim().toUpperCase());
  } else if (typeof edcValue === "string") {
    const trimmed = edcValue.trim().toUpperCase();
    if (
      trimmed === "TRUE" ||
      trimmed === "1" ||
      trimmed === "Y" ||
      trimmed === "YES"
    ) {
      const targetUpper = String(optionCode).trim().toUpperCase();
      if (
        targetUpper === "Y" ||
        targetUpper === "1" ||
        targetUpper === "YES" ||
        targetUpper === "TRUE"
      ) {
        return "Y";
      }
    }
    selectedCodes = trimmed
      .split(/[,;]/)
      .map((s) => s.trim().replace(/^['"]+|['"]+$/g, ""))
      .filter(Boolean);
  }
  const targetCode = String(optionCode).trim().toUpperCase();
  return selectedCodes.includes(targetCode) ? "Y" : "N";
}

/**
 * Generates a unique uppercase variable identifier guaranteed not to collide
 * with `usedNames` and within `maxLength` characters, recording it in `usedNames`.
 */
export function allocateUniqueIdentifier(
  baseName: string,
  usedNames: Set<string>,
  sanitize: (name: string, maxLength?: number) => string,
  maxLength = 32
): string {
  let counter = 1;
  const sanitizedBase = sanitize(baseName, maxLength).toUpperCase();
  let candidate = sanitizedBase;
  while (usedNames.has(candidate)) {
    const suffix = `_${counter}`;
    const maxPrefixLen = Math.max(0, maxLength - suffix.length);
    candidate = `${sanitizedBase.substring(0, maxPrefixLen)}${suffix}`;
    counter++;
  }
  usedNames.add(candidate);
  return candidate;
}

function resolveScopedForms(
  study: StudyProtocol,
  request?: ExportScopeRequest
): { forms: CRFForm[]; headerScope?: string } {
  if (request && "forms" in request) {
    return { forms: request.forms };
  }

  if (request && "scope" in request) {
    if (request.scope === "all") {
      return { forms: study.forms };
    }

    const selectedFormIds = request.selectedFormIds;
    if (!selectedFormIds?.length) {
      const selectionError =
        request.scope === "single"
          ? "Cannot export with scope 'single': selectedFormIds must contain a first entry."
          : "Cannot export with scope 'selected': selectedFormIds must contain at least one entry.";
      throw new RangeError(selectionError);
    }

    if (request.scope === "single") {
      const form = study.forms.find(
        (candidate) => candidate.id === selectedFormIds[0]
      );
      if (!form) {
        throw new RangeError(
          "Cannot export with scope 'single': the first selectedFormIds entry must match a study form."
        );
      }
      return { forms: [form] };
    }

    const requestedFormIds = new Set(selectedFormIds);
    const forms = study.forms.filter((form) => requestedFormIds.has(form.id));
    if (forms.length === 0) {
      throw new RangeError(
        "Cannot export with scope 'selected': selectedFormIds must match at least one study form."
      );
    }
    return { forms };
  }

  const selectedFormId = request?.selectedFormId;
  const forms = selectedFormId
    ? study.forms.filter((form) => form.id === selectedFormId)
    : study.forms;
  const headerScope =
    forms.length === 0
      ? undefined
      : selectedFormId
        ? forms[0]?.domain || forms[0]?.id
        : "suite";

  return { forms, headerScope };
}

/**
 * Prepares normalized form scopes, pre-indexed study and `CL_NY` codelists,
 * and resolved option maps for every included field in a single pass.
 */
export function prepareExportContext(
  study: StudyProtocol,
  request?: ExportScopeRequest
): PreparedExportContext {
  const { forms, headerScope } = resolveScopedForms(study, request);
  const userCodelists = study.codelists || [];
  const studyCodelistsById = indexCodelistsById(userCodelists);

  const referencedCodelistIds = new Set<string>();
  let hasMultiOrCheckbox = false;

  const studyCodelistByField = new Map<
    CRFField,
    CodelistDefinition | undefined
  >();
  const fieldOptionsByField = new Map<CRFField, CodelistOption[]>();
  const documentOptionsByField = new Map<
    CRFField,
    CodelistOption[] | undefined
  >();

  for (const form of forms) {
    for (const section of form.sections) {
      for (const field of section.fields) {
        if (field.codelistId) {
          referencedCodelistIds.add(field.codelistId);
        }
        if (
          field.dataType === "multi_select" ||
          field.dataType === "checkbox"
        ) {
          hasMultiOrCheckbox = true;
        }

        const studyCodelist = field.codelistId
          ? studyCodelistsById.get(field.codelistId)
          : undefined;
        studyCodelistByField.set(field, studyCodelist);
        fieldOptionsByField.set(
          field,
          computeStatisticalFieldOptions(field, studyCodelist)
        );
        documentOptionsByField.set(
          field,
          field.customOptions || studyCodelist?.options
        );
      }
    }
  }

  let activeCodelists: CodelistDefinition[] = [];
  if (userCodelists.length > 0) {
    const allAvailableCodelists = [...userCodelists];
    if (hasMultiOrCheckbox && !studyCodelistsById.has("CL_NY") && NY_CODELIST) {
      allAvailableCodelists.push(NY_CODELIST);
    }
    activeCodelists = allAvailableCodelists.filter(
      (cl) =>
        referencedCodelistIds.has(cl.id) ||
        (hasMultiOrCheckbox && cl.id === "CL_NY") ||
        cl.isStandard
    );
  }

  return {
    study,
    forms,
    headerScope,
    studyCodelistsById,
    nyCodelist: NY_CODELIST,
    activeCodelists,
    studyCodelistByField,
    fieldOptionsByField,
    documentOptionsByField,
  };
}

/**
 * Resolves statistical options for `field` from a prepared context (falling back
 * to indexed map lookup if `field` was outside `context.forms`).
 */
export function resolveFieldOptions(
  context: PreparedExportContext,
  field: CRFField
): CodelistOption[] {
  const cached = context.fieldOptionsByField.get(field);
  if (cached !== undefined) {
    return cached;
  }
  const studyCodelist = field.codelistId
    ? context.studyCodelistsById.get(field.codelistId)
    : undefined;
  return computeStatisticalFieldOptions(field, studyCodelist);
}

/**
 * Resolves document mock options (`customOptions` or study codelist options) for
 * `field` from a prepared context without injecting `CL_NY` defaults.
 */
export function resolveDocumentFieldOptions(
  context: PreparedExportContext,
  field: CRFField
): CodelistOption[] | undefined {
  if (context.documentOptionsByField.has(field)) {
    return context.documentOptionsByField.get(field);
  }
  const studyCodelist = field.codelistId
    ? context.studyCodelistsById.get(field.codelistId)
    : undefined;
  return field.customOptions || studyCodelist?.options;
}

/**
 * Resolves the study codelist referenced by `field` from a prepared context.
 */
export function resolveStudyCodelist(
  context: PreparedExportContext,
  field: CRFField
): CodelistDefinition | undefined {
  if (context.studyCodelistByField.has(field)) {
    return context.studyCodelistByField.get(field);
  }
  return field.codelistId
    ? context.studyCodelistsById.get(field.codelistId)
    : undefined;
}
