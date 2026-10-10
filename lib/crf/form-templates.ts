/**
 * Whole-form templates for the CRF Studio.
 *
 * The personal library (see personal-library.ts) keeps versioned single
 * sections. A form template is the coarser sibling: a complete form with all
 * its sections, its edit checks and the codelists it uses, saved once and
 * inserted into any study as an independent copy. Templates have no versions
 * or upgrade path, so they live in their own store and the section library's
 * contract is untouched.
 *
 * Packages move templates between browsers as JSON. A package is untrusted
 * input: it is size-capped, its structure is validated, variable names must
 * be plain identifiers (they are later used in formula rewriting), and every
 * imported template gets a fresh id so an import can never overwrite what is
 * already saved.
 */

import type {
  CRFField,
  CRFForm,
  CodelistDefinition,
  StudyProtocol,
} from "./types";
import { generateEngineId } from "./precision-date";
import { cloneDeep } from "../utils";
import type { RawStorage } from "../safe-storage";
import { instantiateContent, resolveLibraryStorage } from "./personal-library";

/** localStorage key holding saved form templates. */
export const FORM_TEMPLATES_STORAGE_KEY = "crf_studio_form_templates_v1";

/** Backup key an unreadable store is copied to before it is reset. */
export const FORM_TEMPLATES_CORRUPT_BACKUP_KEY =
  "crf_studio_form_templates_v1_corrupt";

/** Current store and package format version. */
export const FORM_TEMPLATE_FORMAT_VERSION = 1;

/** Most templates the store keeps. */
export const MAX_FORM_TEMPLATES = 50;

/** Largest package, in characters, an import will parse. */
export const MAX_TEMPLATE_PACKAGE_CHARS = 2 * 1024 * 1024;

const MAX_SECTIONS_PER_TEMPLATE = 50;
const MAX_FIELDS_PER_TEMPLATE = 1000;
const MAX_RULES_PER_TEMPLATE = 500;
const MAX_CODELISTS_PER_TEMPLATE = 200;

/** A saved form. */
export interface FormTemplate {
  id: string;
  name: string;
  description?: string;
  /** The form as captured; its `rules` are the edit checks that come with it. */
  form: CRFForm;
  /** Only the codelists the form's fields reference. */
  codelists: CodelistDefinition[];
  createdAt: string;
  updatedAt: string;
}

/** Outcome of a write to the template store. */
export type SaveFormTemplatesResult =
  | { status: "saved" }
  | { status: "limit"; max: number }
  | { status: "unavailable" }
  | { status: "error"; message: string };

interface FormTemplateEnvelope {
  envelopeVersion: number;
  savedAt: string;
  templates: FormTemplate[];
}

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function walkFields(fields: CRFField[], visit: (field: CRFField) => void) {
  for (const field of fields) {
    visit(field);
    if (field.repeatingColumns) walkFields(field.repeatingColumns, visit);
  }
}

/**
 * Captures a form, with the codelists its fields use, into a new template.
 * The copy is independent of the study, and a data lock on the source form
 * does not carry over.
 */
export function captureFormTemplate(options: {
  form: CRFForm;
  codelists: readonly CodelistDefinition[];
  name?: string;
  description?: string;
  now?: Date;
}): FormTemplate {
  const form = cloneDeep(options.form);
  delete form.isLocked;
  delete form.lockedBy;
  delete form.lockedAt;

  const referenced = new Set<string>();
  for (const section of form.sections || []) {
    walkFields(section.fields || [], (field) => {
      if (field.codelistId) referenced.add(field.codelistId);
    });
  }
  const timestamp = (options.now || new Date()).toISOString();
  return {
    id: generateEngineId("tpl"),
    name: options.name?.trim() || form.name,
    description: options.description ?? (form.description || undefined),
    form,
    codelists: cloneDeep(options.codelists.filter((c) => referenced.has(c.id))),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function isFieldShape(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (typeof value.id !== "string" || !value.id) return false;
  if (typeof value.label !== "string") return false;
  if (typeof value.dataType !== "string") return false;
  if (
    typeof value.variableName !== "string" ||
    !IDENTIFIER.test(value.variableName)
  ) {
    return false;
  }
  if (value.repeatingColumns !== undefined) {
    if (!Array.isArray(value.repeatingColumns)) return false;
    if (!value.repeatingColumns.every(isFieldShape)) return false;
  }
  return true;
}

function countFields(fields: unknown[]): number {
  let total = 0;
  for (const field of fields) {
    total += 1;
    const columns = (field as { repeatingColumns?: unknown[] })
      .repeatingColumns;
    if (Array.isArray(columns)) total += countFields(columns);
  }
  return total;
}

/** True when `value` has the structure of a saved template. */
export function isFormTemplateShape(value: unknown): value is FormTemplate {
  if (!isRecord(value)) return false;
  if (typeof value.id !== "string" || !value.id) return false;
  if (typeof value.name !== "string" || !value.name.trim()) return false;
  if (value.name.length > 200) return false;
  if (typeof value.createdAt !== "string") return false;
  if (typeof value.updatedAt !== "string") return false;
  if (!Array.isArray(value.codelists)) return false;
  if (value.codelists.length > MAX_CODELISTS_PER_TEMPLATE) return false;
  if (
    !value.codelists.every(
      (c) =>
        isRecord(c) &&
        typeof c.id === "string" &&
        typeof c.name === "string" &&
        Array.isArray(c.options)
    )
  ) {
    return false;
  }

  const form = value.form;
  if (!isRecord(form)) return false;
  if (typeof form.name !== "string" || typeof form.id !== "string") {
    return false;
  }
  if (!Array.isArray(form.sections) || form.sections.length === 0) {
    return false;
  }
  if (form.sections.length > MAX_SECTIONS_PER_TEMPLATE) return false;
  let fieldTotal = 0;
  for (const section of form.sections) {
    if (!isRecord(section)) return false;
    if (typeof section.id !== "string" || typeof section.title !== "string") {
      return false;
    }
    if (!Array.isArray(section.fields)) return false;
    if (!section.fields.every(isFieldShape)) return false;
    fieldTotal += countFields(section.fields);
  }
  if (fieldTotal > MAX_FIELDS_PER_TEMPLATE) return false;
  if (!Array.isArray(form.rules)) return false;
  if (form.rules.length > MAX_RULES_PER_TEMPLATE) return false;
  return form.rules.every(
    (r) =>
      isRecord(r) &&
      typeof r.id === "string" &&
      typeof r.targetFieldId === "string"
  );
}

function isEnvelope(value: unknown): value is FormTemplateEnvelope {
  return (
    isRecord(value) &&
    value.envelopeVersion === FORM_TEMPLATE_FORMAT_VERSION &&
    Array.isArray(value.templates)
  );
}

/**
 * Reads the saved templates, newest first. An absent, unavailable or
 * unreadable store reads as empty; an unreadable payload is copied to
 * {@link FORM_TEMPLATES_CORRUPT_BACKUP_KEY} first. Entries that no longer
 * pass validation are left out.
 */
export function listFormTemplates(storage?: RawStorage): FormTemplate[] {
  const target = resolveLibraryStorage(storage);
  if (!target) return [];
  let raw: string | null;
  try {
    raw = target.getItem(FORM_TEMPLATES_STORAGE_KEY);
  } catch {
    return [];
  }
  if (!raw) return [];
  return parseStoredFormTemplates(raw, target);
}

/** Parses a raw store payload, preserving it when it cannot be read. */
export function parseStoredFormTemplates(
  raw: string,
  target?: RawStorage
): FormTemplate[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }
  if (!isEnvelope(parsed)) {
    try {
      target?.setItem(FORM_TEMPLATES_CORRUPT_BACKUP_KEY, raw);
    } catch {
      // A full store cannot keep the backup; the original stays in place.
    }
    return [];
  }
  return parsed.templates
    .filter(isFormTemplateShape)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function writeAll(
  templates: FormTemplate[],
  storage: RawStorage | undefined
): SaveFormTemplatesResult {
  const target = resolveLibraryStorage(storage);
  if (!target) return { status: "unavailable" };
  const envelope: FormTemplateEnvelope = {
    envelopeVersion: FORM_TEMPLATE_FORMAT_VERSION,
    savedAt: new Date().toISOString(),
    templates,
  };
  try {
    target.setItem(FORM_TEMPLATES_STORAGE_KEY, JSON.stringify(envelope));
    return { status: "saved" };
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message : "Unknown storage error",
    };
  }
}

/** Saves a template, replacing the one with the same id. */
export function saveFormTemplate(
  template: FormTemplate,
  storage?: RawStorage
): SaveFormTemplatesResult {
  const others = listFormTemplates(storage).filter((t) => t.id !== template.id);
  if (others.length >= MAX_FORM_TEMPLATES) {
    return { status: "limit", max: MAX_FORM_TEMPLATES };
  }
  return writeAll([...others, template], storage);
}

/** Removes a template. */
export function deleteFormTemplate(
  id: string,
  storage?: RawStorage
): SaveFormTemplatesResult {
  return writeAll(
    listFormTemplates(storage).filter((t) => t.id !== id),
    storage
  );
}

/** The templates as a JSON package for moving between browsers. */
export function exportFormTemplates(
  templates: readonly FormTemplate[],
  now: Date = new Date()
): string {
  return JSON.stringify(
    {
      packageVersion: FORM_TEMPLATE_FORMAT_VERSION,
      exportedAt: now.toISOString(),
      templates,
    },
    null,
    2
  );
}

/**
 * Validates a package and returns its templates with fresh ids, so importing
 * never replaces a saved template.
 *
 * @throws Error with a message fit to show the user when the package is too
 * large, not JSON, not a template package, or holds no valid template.
 */
export function parseFormTemplatePackage(json: string): {
  templates: FormTemplate[];
  skipped: number;
} {
  if (json.length > MAX_TEMPLATE_PACKAGE_CHARS) {
    throw new Error("That template package is too large to import.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("That file is not a form template package.");
  }
  if (
    !isRecord(parsed) ||
    parsed.packageVersion !== FORM_TEMPLATE_FORMAT_VERSION ||
    !Array.isArray(parsed.templates)
  ) {
    throw new Error("That file is not a form template package.");
  }
  const valid = parsed.templates.filter(isFormTemplateShape);
  if (valid.length === 0) {
    throw new Error("That package holds no valid form templates.");
  }
  return {
    templates: valid.map((template) => ({
      ...cloneDeep(template),
      id: generateEngineId("tpl"),
    })),
    skipped: parsed.templates.length - valid.length,
  };
}

/**
 * Imports a package into the store. Stops at {@link MAX_FORM_TEMPLATES}; the
 * rest count as skipped.
 */
export function importFormTemplates(
  json: string,
  storage?: RawStorage
): { imported: number; skipped: number; result: SaveFormTemplatesResult } {
  const { templates, skipped } = parseFormTemplatePackage(json);
  const existing = listFormTemplates(storage);
  const room = Math.max(0, MAX_FORM_TEMPLATES - existing.length);
  const accepted = templates.slice(0, room);
  if (accepted.length === 0) {
    return {
      imported: 0,
      skipped: skipped + templates.length,
      result: { status: "limit", max: MAX_FORM_TEMPLATES },
    };
  }
  const result = writeAll([...existing, ...accepted], storage);
  return {
    imported: result.status === "saved" ? accepted.length : 0,
    skipped: skipped + (templates.length - accepted.length),
    result,
  };
}

/**
 * An independent copy of the template, ready to add to a study: fresh ids
 * throughout, edit-check references remapped, and CDASH variable names that
 * collide with the study's renamed. `codelists` are only those the study does
 * not already have.
 */
export function instantiateFormTemplate(
  template: FormTemplate,
  study: StudyProtocol
): { form: CRFForm; codelists: CodelistDefinition[] } {
  const existingVariableNames: string[] = [];
  for (const form of study.forms || []) {
    for (const section of form.sections || []) {
      walkFields(section.fields || [], (field) =>
        existingVariableNames.push(field.variableName)
      );
    }
  }
  const content = instantiateContent(
    template.form.sections,
    template.form.rules || [],
    template.codelists,
    {
      existingVariableNames,
      existingCodelistIds: (study.codelists || []).map((c) => c.id),
    }
  );
  const form: CRFForm = {
    ...cloneDeep(template.form),
    id: generateEngineId("form"),
    sections: content.sections,
    rules: content.rules,
  };
  return { form, codelists: content.codelists };
}
