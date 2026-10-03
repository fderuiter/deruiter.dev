/**
 * Preview and apply a personal-library upgrade (#681).
 *
 * A study that inserted a library block records its lineage in
 * `StudyProtocol.libraryUses`: the entry, the version it was taken from, and
 * how library identities map onto the study's. When the library later holds
 * a newer version, this module compares three versions of the block:
 *
 * - source: the library version the study's copy is based on,
 * - current: the study's copy, possibly customized by the author,
 * - incoming: the newest library version.
 *
 * Every comparison runs in the library's namespace. The current copy is
 * translated back through the lineage maps, so a field the study renamed at
 * insertion only to avoid a collision is not mistaken for a customization.
 *
 * The module is pure. Nothing here reads or writes storage, and nothing
 * changes a study except {@link applyLibraryUpgrade}, which returns a new
 * study and refuses to run while any conflict lacks an explicit resolution
 * or while the study or library no longer match the preview that was shown.
 * There is no background path: a library update never reaches a study until
 * an author applies it.
 *
 * Scope is known personal-library lineage only. Blocks inserted without a
 * lineage record, and library entries whose earlier versions were not kept,
 * are reported rather than guessed at.
 */

import type {
  CRFField,
  CRFSection,
  CodelistDefinition,
  EditCheckRule,
  StudyLibraryUpgradeRecord,
  StudyLibraryUse,
  StudyProtocol,
} from "./types";
import {
  getLibraryEntryRevision,
  insertLibraryEntryIntoStudy,
  type PersonalLibraryEntry,
  type PersonalLibraryEntryRevision,
} from "./personal-library";
import { generateCdashVariableName, generateEngineId } from "./precision-date";
import { cloneDeep } from "../utils";

/** The kind of block element a change belongs to. */
export type LibraryUpgradeScope = "section" | "field" | "rule" | "codelist";

/**
 * How a change arose.
 *
 * - `incoming`: only the library changed it; the upgrade takes the library's value.
 * - `local`: only the study changed it; the customization is kept.
 * - `converged`: both made the same change; nothing to decide.
 * - `conflict`: both changed it differently; the author must choose.
 */
export type LibraryUpgradeChangeKind =
  "incoming" | "local" | "converged" | "conflict";

/** What happens to the element. */
export type LibraryUpgradeAction = "add" | "remove" | "modify";

/** An author's resolution of one conflict. */
export type LibraryConflictChoice = "current" | "incoming";

/** One difference between the source, current and incoming versions. */
export interface LibraryUpgradeChange {
  /** Stable identifier, used as the key for a conflict resolution. */
  id: string;
  scope: LibraryUpgradeScope;
  /** Library identity of the element (`"section"` for the section itself). */
  elementId: string;
  /** Study identity of the element, when the study holds it. */
  studyElementId?: string;
  /** Readable name of the element. */
  label: string;
  /** The property that differs; absent when the element is added or removed. */
  property?: string;
  action: LibraryUpgradeAction;
  kind: LibraryUpgradeChangeKind;
  /** Display value in each version; `undefined` means absent. */
  source?: string;
  current?: string;
  incoming?: string;
  summary: string;
}

/** Something in the study, outside the block, that a change reaches. */
export interface LibraryAffectedReference {
  changeId: string;
  kind: "rule" | "calculation" | "codelist_use";
  formId: string;
  formName: string;
  /** Study identity of the referring rule or field. */
  elementId: string;
  label: string;
  detail: string;
}

/** Whether a library use in a study can be upgraded. */
export type LibraryUpgradeStatus =
  | "up_to_date"
  | "available"
  | "entry_missing"
  | "source_unavailable"
  | "target_missing";

export interface LibraryUpgradeAvailability {
  use: StudyLibraryUse;
  status: LibraryUpgradeStatus;
  /** The library's newest version, when the entry still exists. */
  latestVersion?: number;
  /** Readable status for display. */
  message: string;
}

export interface LibraryUpgradeCounts {
  incoming: number;
  local: number;
  converged: number;
  conflict: number;
}

export interface LibraryUpgradePreview {
  useId: string;
  entryId: string;
  entryName: string;
  formId: string;
  sectionId: string;
  fromVersion: number;
  toVersion: number;
  changes: LibraryUpgradeChange[];
  /** The changes that need an explicit resolution. */
  conflicts: LibraryUpgradeChange[];
  affectedReferences: LibraryAffectedReference[];
  counts: LibraryUpgradeCounts;
  /**
   * Digest of the study and library content the preview was computed from.
   * {@link applyLibraryUpgrade} refuses to apply when it no longer matches.
   */
  fingerprint: string;
}

export type PreviewLibraryUpgradeResult =
  | { status: "ready"; preview: LibraryUpgradePreview }
  | { status: "use_missing" }
  | { status: Exclude<LibraryUpgradeStatus, "available">; message: string };

export type ApplyLibraryUpgradeResult =
  | {
      status: "applied";
      study: StudyProtocol;
      use: StudyLibraryUse;
      record: StudyLibraryUpgradeRecord;
    }
  | { status: "unresolved"; unresolvedChangeIds: string[] }
  | { status: "stale"; message: string }
  | { status: "unavailable"; message: string };

type Json = Record<string, unknown>;

interface BlockElement {
  id: string;
  label: string;
  value: Json;
}

interface BlockModel {
  section: Json;
  fields: Map<string, BlockElement>;
  fieldOrder: string[];
  rules: Map<string, BlockElement>;
  codelists: Map<string, BlockElement>;
}

const SECTION_KEY = "section";

function stableStringify(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const record = value as Json;
  const keys = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

function digest(text: string): string {
  // djb2: a cheap, deterministic digest; collisions only weaken a staleness
  // check, they cannot corrupt a study.
  let hash = 5381;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) + hash + text.charCodeAt(index)) | 0;
  }
  return (hash >>> 0).toString(16);
}

function display(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "string") return value;
  return stableStringify(value);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function renameVariables(
  formula: string,
  renames: Array<[string, string]>
): string {
  // Two-phase replacement so a swap (A->B, B->A) cannot cascade.
  let next = formula;
  const placeholders: Array<[string, string]> = [];
  renames.forEach(([from, to], index) => {
    if (from === to) return;
    const token = `\u0000${index}\u0000`;
    next = next.replace(new RegExp(`\\b${escapeRegExp(from)}\\b`, "g"), token);
    placeholders.push([token, to]);
  });
  for (const [token, to] of placeholders) next = next.split(token).join(to);
  return next;
}

function fieldLabel(field: CRFField): string {
  return field.label
    ? `${field.label} (${field.variableName})`
    : field.variableName;
}

function sectionProps(section: CRFSection): Json {
  const props: Json = { ...section };
  delete props.id;
  delete props.fields;
  return props;
}

function walkFields(fields: CRFField[], visit: (field: CRFField) => void) {
  for (const field of fields) {
    visit(field);
    if (field.repeatingColumns) walkFields(field.repeatingColumns, visit);
  }
}

/** Builds the library-namespace model of a stored library version. */
function modelFromRevision(revision: PersonalLibraryEntryRevision): BlockModel {
  const fields = new Map<string, BlockElement>();
  for (const field of revision.section.fields) {
    const value: Json = { ...cloneDeep(field) };
    delete value.id;
    fields.set(field.id, { id: field.id, label: fieldLabel(field), value });
  }
  const rules = new Map<string, BlockElement>();
  for (const rule of revision.rules) {
    const value: Json = { ...cloneDeep(rule) };
    delete value.id;
    rules.set(rule.id, { id: rule.id, label: rule.name || rule.id, value });
  }
  const codelists = new Map<string, BlockElement>();
  for (const codelist of revision.codelists) {
    codelists.set(codelist.id, {
      id: codelist.id,
      label: codelist.name || codelist.id,
      value: { ...cloneDeep(codelist) },
    });
  }
  return {
    section: cloneDeep(sectionProps(revision.section)),
    fields,
    fieldOrder: revision.section.fields.map((field) => field.id),
    rules,
    codelists,
  };
}

function invert(map: Record<string, string>): Map<string, string> {
  const inverse = new Map<string, string>();
  for (const [key, value] of Object.entries(map)) inverse.set(value, key);
  return inverse;
}

interface StudyBlock {
  formIndex: number;
  sectionIndex: number;
  section: CRFSection;
}

function locateBlock(
  study: StudyProtocol,
  use: StudyLibraryUse
): StudyBlock | undefined {
  const formIndex = (study.forms || []).findIndex(
    (form) => form.id === use.formId
  );
  if (formIndex < 0) return undefined;
  const sections = study.forms[formIndex].sections || [];
  const sectionIndex = sections.findIndex(
    (section) => section.id === use.sectionId
  );
  if (sectionIndex < 0) return undefined;
  return { formIndex, sectionIndex, section: sections[sectionIndex] };
}

/**
 * Translates the study's copy of a block back into the library namespace,
 * using the source version to tell inherited names from customized ones.
 */
function modelFromStudy(
  study: StudyProtocol,
  use: StudyLibraryUse,
  block: StudyBlock,
  source: BlockModel
): BlockModel {
  const reverseIds = invert(use.idMap);
  const variableMap = Object.fromEntries(
    Object.entries(use.variableMap).map(([lib, std]) => [
      lib.toUpperCase(),
      std,
    ])
  );
  const reverseVars: Array<[string, string]> = Object.entries(variableMap).map(
    ([lib, std]) => [std, lib]
  );

  const toLibraryId = (id: string) => reverseIds.get(id) || id;
  const toLibraryVar = (name: string, libraryName?: string) => {
    if (!libraryName) return name;
    const inherited = variableMap[libraryName.toUpperCase()];
    return inherited && inherited.toUpperCase() === name.toUpperCase()
      ? libraryName
      : name;
  };

  const sourceVarsById = new Map<string, string>();
  const collectSourceVars = (fields: unknown) => {
    if (!Array.isArray(fields)) return;
    for (const field of fields as CRFField[]) {
      sourceVarsById.set(field.id, field.variableName);
      collectSourceVars(field.repeatingColumns);
    }
  };
  for (const [id, element] of source.fields) {
    sourceVarsById.set(id, String(element.value.variableName ?? ""));
    collectSourceVars(element.value.repeatingColumns);
  }

  const normalizeField = (field: CRFField): CRFField => {
    const copy = cloneDeep(field);
    const libraryId = toLibraryId(field.id);
    copy.id = libraryId;
    copy.variableName = toLibraryVar(
      field.variableName,
      sourceVarsById.get(libraryId)
    );
    if (copy.calculationFormula) {
      copy.calculationFormula = renameVariables(
        copy.calculationFormula,
        reverseVars
      );
    }
    if (copy.repeatingColumns) {
      copy.repeatingColumns = copy.repeatingColumns.map(normalizeField);
    }
    return copy;
  };

  const fields = new Map<string, BlockElement>();
  const fieldOrder: string[] = [];
  for (const field of block.section.fields) {
    const libraryId = reverseIds.get(field.id);
    if (!libraryId) continue; // A local addition: not part of the comparison.
    const normalized = normalizeField(field);
    const value: Json = { ...normalized };
    delete value.id;
    fields.set(libraryId, {
      id: libraryId,
      label: fieldLabel(field),
      value,
    });
    fieldOrder.push(libraryId);
  }

  const rules = new Map<string, BlockElement>();
  for (const rule of study.forms[block.formIndex].rules || []) {
    const libraryId = reverseIds.get(rule.id);
    if (!libraryId) continue;
    const copy = cloneDeep(rule);
    copy.targetFieldId = toLibraryId(copy.targetFieldId);
    copy.triggerFieldIds = (copy.triggerFieldIds || []).map(toLibraryId);
    const conditions = [
      ...(copy.conditions || []),
      ...(copy.conditionGroups || []).flatMap(
        (group) => group.conditions || []
      ),
    ];
    for (const condition of conditions) {
      condition.fieldId = toLibraryId(condition.fieldId);
      if (condition.compareFieldId) {
        condition.compareFieldId = toLibraryId(condition.compareFieldId);
      }
    }
    const value: Json = { ...copy };
    delete value.id;
    rules.set(libraryId, { id: libraryId, label: rule.name || rule.id, value });
  }

  const codelists = new Map<string, BlockElement>();
  for (const codelist of study.codelists || []) {
    codelists.set(codelist.id, {
      id: codelist.id,
      label: codelist.name || codelist.id,
      value: { ...cloneDeep(codelist) },
    });
  }

  return {
    section: cloneDeep(sectionProps(block.section)),
    fields,
    fieldOrder,
    rules,
    codelists,
  };
}

function classify(
  source: string,
  current: string,
  incoming: string
): LibraryUpgradeChangeKind | null {
  if (current === incoming) return current === source ? null : "converged";
  if (source === current) return "incoming";
  if (source === incoming) return "local";
  return "conflict";
}

function compareProps(
  scope: LibraryUpgradeScope,
  elementId: string,
  studyElementId: string | undefined,
  label: string,
  source: Json | undefined,
  current: Json,
  incoming: Json,
  out: LibraryUpgradeChange[]
): void {
  const keys = new Set([
    ...Object.keys(source || {}),
    ...Object.keys(current),
    ...Object.keys(incoming),
  ]);
  for (const property of [...keys].sort()) {
    const s = source ? stableStringify(source[property]) : undefined;
    const c = stableStringify(current[property]);
    const i = stableStringify(incoming[property]);
    // Without a common ancestor, any disagreement is a decision for the author.
    const kind =
      s === undefined ? (c === i ? null : "conflict") : classify(s, c, i);
    if (!kind) continue;
    out.push({
      id: `${scope}:${elementId}:${property}`,
      scope,
      elementId,
      studyElementId,
      label,
      property,
      action: "modify",
      kind,
      source: source ? display(source[property]) : undefined,
      current: display(current[property]),
      incoming: display(incoming[property]),
      summary: describeChange(kind, label, property),
    });
  }
}

function describeChange(
  kind: LibraryUpgradeChangeKind,
  label: string,
  property?: string,
  action: LibraryUpgradeAction = "modify"
): string {
  const what = property ? `${property} of ${label}` : label;
  if (action === "add") {
    return kind === "conflict"
      ? `${label} exists in both the study and the library with different content.`
      : `The library adds ${label}.`;
  }
  if (action === "remove") {
    switch (kind) {
      case "incoming":
        return `The library removes ${label}.`;
      case "local":
        return `You removed ${label}; the library left it unchanged, so it stays removed.`;
      case "converged":
        return `${label} was removed in both the study and the library.`;
      default:
        return `${label} was removed on one side and changed on the other.`;
    }
  }
  switch (kind) {
    case "incoming":
      return `The library changes ${what}.`;
    case "local":
      return `Your customization of ${what} is kept.`;
    case "converged":
      return `The study and the library made the same change to ${what}.`;
    default:
      return `Both the study and the library changed ${what}.`;
  }
}

function compareCollection(
  scope: Exclude<LibraryUpgradeScope, "section">,
  source: Map<string, BlockElement>,
  current: Map<string, BlockElement>,
  incoming: Map<string, BlockElement>,
  keys: string[],
  studyIdOf: (libraryId: string) => string | undefined,
  out: LibraryUpgradeChange[]
): void {
  for (const id of keys) {
    const s = source.get(id);
    const c = current.get(id);
    const i = incoming.get(id);
    const label = (i || c || s)?.label || id;
    const studyElementId = c ? studyIdOf(id) : undefined;
    const base = {
      id: `${scope}:${id}`,
      scope,
      elementId: id,
      studyElementId,
      label,
      source: s ? stableStringify(s.value) : undefined,
      current: c ? stableStringify(c.value) : undefined,
      incoming: i ? stableStringify(i.value) : undefined,
    };

    if (!s) {
      if (!i) continue; // Present only in the study: not library content.
      if (!c) {
        out.push({
          ...base,
          action: "add",
          kind: "incoming",
          summary: describeChange("incoming", label, undefined, "add"),
        });
        continue;
      }
      compareProps(
        scope,
        id,
        studyElementId,
        label,
        undefined,
        c.value,
        i.value,
        out
      );
      continue;
    }

    if (!c && !i) {
      out.push({
        ...base,
        action: "remove",
        kind: "converged",
        summary: describeChange("converged", label, undefined, "remove"),
      });
      continue;
    }
    if (!c && i) {
      const unchanged = stableStringify(s.value) === stableStringify(i.value);
      const kind = unchanged ? "local" : "conflict";
      out.push({
        ...base,
        action: "remove",
        kind,
        summary: describeChange(kind, label, undefined, "remove"),
      });
      continue;
    }
    if (c && !i) {
      const unchanged = stableStringify(s.value) === stableStringify(c.value);
      const kind = unchanged ? "incoming" : "conflict";
      out.push({
        ...base,
        action: "remove",
        kind,
        summary: describeChange(kind, label, undefined, "remove"),
      });
      continue;
    }
    compareProps(
      scope,
      id,
      studyElementId,
      label,
      s.value,
      c!.value,
      i!.value,
      out
    );
  }
}

function unionKeys(...maps: Array<Map<string, unknown>>): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const map of maps) {
    for (const key of map.keys()) {
      if (!seen.has(key)) {
        seen.add(key);
        ordered.push(key);
      }
    }
  }
  return ordered;
}

interface Comparison {
  source: BlockModel;
  current: BlockModel;
  incoming: BlockModel;
  changes: LibraryUpgradeChange[];
}

function compareBlocks(
  use: StudyLibraryUse,
  source: BlockModel,
  current: BlockModel,
  incoming: BlockModel
): Comparison {
  const changes: LibraryUpgradeChange[] = [];
  const studyIdOf = (libraryId: string) => use.idMap[libraryId];

  compareProps(
    "section",
    SECTION_KEY,
    use.sectionId,
    `Section "${String(current.section.title ?? incoming.section.title ?? "")}"`,
    source.section,
    current.section,
    incoming.section,
    changes
  );
  compareCollection(
    "field",
    source.fields,
    current.fields,
    incoming.fields,
    unionKeys(source.fields, incoming.fields),
    studyIdOf,
    changes
  );
  compareCollection(
    "rule",
    source.rules,
    current.rules,
    incoming.rules,
    unionKeys(source.rules, incoming.rules),
    studyIdOf,
    changes
  );
  // Codelists keep their identity across insertion, so the study's catalog is
  // the current side. Only codelists the library version uses are compared.
  compareCollection(
    "codelist",
    source.codelists,
    current.codelists,
    incoming.codelists,
    unionKeys(source.codelists, incoming.codelists),
    (id) => (current.codelists.has(id) ? id : undefined),
    changes
  );

  return { source, current, incoming, changes };
}

function countChanges(changes: LibraryUpgradeChange[]): LibraryUpgradeCounts {
  const counts: LibraryUpgradeCounts = {
    incoming: 0,
    local: 0,
    converged: 0,
    conflict: 0,
  };
  for (const change of changes) counts[change.kind] += 1;
  return counts;
}

function collectAffectedReferences(
  study: StudyProtocol,
  use: StudyLibraryUse,
  changes: LibraryUpgradeChange[]
): LibraryAffectedReference[] {
  const blockStudyIds = new Set(Object.values(use.idMap));
  const block = locateBlock(study, use);
  const blockFields = new Map<string, CRFField>();
  if (block) walkFields(block.section.fields, (f) => blockFields.set(f.id, f));

  const references: LibraryAffectedReference[] = [];
  const reaching = changes.filter(
    (change) => change.kind === "incoming" || change.kind === "conflict"
  );

  for (const change of reaching) {
    if (change.scope === "field" && change.studyElementId) {
      const target = blockFields.get(change.studyElementId);
      if (!target) continue;
      const variable = target.variableName;
      const variablePattern = new RegExp(`\\b${escapeRegExp(variable)}\\b`);
      for (const form of study.forms || []) {
        for (const rule of [...(form.rules || [])]) {
          if (blockStudyIds.has(rule.id)) continue;
          const operands = [
            rule.targetFieldId,
            ...(rule.triggerFieldIds || []),
            ...[
              ...(rule.conditions || []),
              ...(rule.conditionGroups || []).flatMap(
                (g) => g.conditions || []
              ),
            ].flatMap((condition) => [
              condition.fieldId,
              condition.compareFieldId || "",
            ]),
          ];
          if (operands.includes(target.id) || operands.includes(variable)) {
            references.push({
              changeId: change.id,
              kind: "rule",
              formId: form.id,
              formName: form.name,
              elementId: rule.id,
              label: rule.name || rule.id,
              detail: `Rule "${rule.name || rule.id}" reads ${variable}.`,
            });
          }
        }
        for (const section of form.sections || []) {
          walkFields(section.fields, (field) => {
            if (blockFields.has(field.id) && blockStudyIds.has(field.id))
              return;
            if (
              field.calculationFormula &&
              variablePattern.test(field.calculationFormula)
            ) {
              references.push({
                changeId: change.id,
                kind: "calculation",
                formId: form.id,
                formName: form.name,
                elementId: field.id,
                label: fieldLabel(field),
                detail: `Calculation of ${field.variableName} uses ${variable}.`,
              });
            }
          });
        }
      }
    }
    if (change.scope === "codelist") {
      for (const form of study.forms || []) {
        for (const section of form.sections || []) {
          walkFields(section.fields, (field) => {
            if (field.codelistId !== change.elementId) return;
            if (blockStudyIds.has(field.id)) return;
            references.push({
              changeId: change.id,
              kind: "codelist_use",
              formId: form.id,
              formName: form.name,
              elementId: field.id,
              label: fieldLabel(field),
              detail: `${field.variableName} outside this block uses codelist "${change.label}".`,
            });
          });
        }
      }
    }
  }

  // One row per (change, element), even if several operands match.
  const unique = new Map<string, LibraryAffectedReference>();
  for (const reference of references) {
    unique.set(`${reference.changeId}|${reference.elementId}`, reference);
  }
  return [...unique.values()];
}

/** Lists the personal-library blocks a study records lineage for. */
export function listStudyLibraryUses(study: StudyProtocol): StudyLibraryUse[] {
  return [...(study.libraryUses || [])];
}

/**
 * Inserts a library entry into a form and records its lineage, so the block
 * can later be compared with newer library versions. Returns a new study; the
 * one passed in is not mutated.
 */
export function insertLibraryEntryWithLineage(
  entry: PersonalLibraryEntry,
  study: StudyProtocol,
  formId: string,
  now?: Date
): { study: StudyProtocol; use: StudyLibraryUse } {
  const inserted = insertLibraryEntryIntoStudy(entry, study, formId, now);
  const { instantiated } = inserted;
  const use: StudyLibraryUse = {
    id: generateEngineId("libuse"),
    entryId: instantiated.source.entryId,
    entryName: instantiated.source.entryName,
    entryVersion: instantiated.source.entryVersion,
    insertedAt: instantiated.source.insertedAt,
    formId,
    sectionId: instantiated.section.id,
    idMap: { ...instantiated.idMap },
    variableMap: { ...instantiated.variableMap },
  };
  return {
    study: {
      ...inserted.study,
      libraryUses: [...(inserted.study.libraryUses || []), use],
    },
    use,
  };
}

function availabilityOf(
  study: StudyProtocol,
  use: StudyLibraryUse,
  entries: PersonalLibraryEntry[]
): LibraryUpgradeAvailability {
  const entry = entries.find((candidate) => candidate.id === use.entryId);
  if (!entry) {
    return {
      use,
      status: "entry_missing",
      message: `"${use.entryName}" is no longer in your personal library.`,
    };
  }
  if (!locateBlock(study, use)) {
    return {
      use,
      status: "target_missing",
      latestVersion: entry.version,
      message: `The section that held "${use.entryName}" is no longer in this study.`,
    };
  }
  if (entry.version <= use.entryVersion) {
    return {
      use,
      status: "up_to_date",
      latestVersion: entry.version,
      message: `Up to date with library version ${entry.version}.`,
    };
  }
  if (!getLibraryEntryRevision(entry, use.entryVersion)) {
    return {
      use,
      status: "source_unavailable",
      latestVersion: entry.version,
      message: `Version ${use.entryVersion}, which this study used, was not kept in the library, so local customizations cannot be told apart from library changes.`,
    };
  }
  return {
    use,
    status: "available",
    latestVersion: entry.version,
    message: `Version ${entry.version} is available (study uses version ${use.entryVersion}).`,
  };
}

/**
 * Reports, without changing anything, which library blocks in a study have a
 * newer library version. Detection never applies an update.
 */
export function detectLibraryUpgrades(
  study: StudyProtocol,
  entries: PersonalLibraryEntry[]
): LibraryUpgradeAvailability[] {
  return listStudyLibraryUses(study).map((use) =>
    availabilityOf(study, use, entries)
  );
}

interface PreparedUpgrade {
  use: StudyLibraryUse;
  entry: PersonalLibraryEntry;
  block: StudyBlock;
  comparison: Comparison;
  preview: LibraryUpgradePreview;
}

function prepare(
  study: StudyProtocol,
  useId: string,
  entries: PersonalLibraryEntry[]
): PreparedUpgrade | PreviewLibraryUpgradeResult {
  const use = (study.libraryUses || []).find(
    (candidate) => candidate.id === useId
  );
  if (!use) return { status: "use_missing" };

  const availability = availabilityOf(study, use, entries);
  if (availability.status !== "available") {
    return { status: availability.status, message: availability.message };
  }

  const entry = entries.find((candidate) => candidate.id === use.entryId)!;
  const sourceRevision = getLibraryEntryRevision(entry, use.entryVersion)!;
  const incomingRevision = getLibraryEntryRevision(entry, entry.version)!;
  const block = locateBlock(study, use)!;

  const source = modelFromRevision(sourceRevision);
  const incoming = modelFromRevision(incomingRevision);
  const current = modelFromStudy(study, use, block, source);
  const comparison = compareBlocks(use, source, current, incoming);
  const { changes } = comparison;

  const fingerprint = digest(
    stableStringify({
      use,
      section: block.section,
      rules: study.forms[block.formIndex].rules || [],
      codelists: study.codelists || [],
      incoming: incomingRevision,
      version: entry.version,
    })
  );

  const preview: LibraryUpgradePreview = {
    useId: use.id,
    entryId: entry.id,
    entryName: entry.name,
    formId: use.formId,
    sectionId: use.sectionId,
    fromVersion: use.entryVersion,
    toVersion: entry.version,
    changes,
    conflicts: changes.filter((change) => change.kind === "conflict"),
    affectedReferences: collectAffectedReferences(study, use, changes),
    counts: countChanges(changes),
    fingerprint,
  };

  return { use, entry, block, comparison, preview };
}

function isPrepared(
  value: PreparedUpgrade | PreviewLibraryUpgradeResult
): value is PreparedUpgrade {
  return "comparison" in value;
}

/**
 * Compares the library version a study block was based on, the study's copy
 * and the newest library version, without changing anything.
 */
export function previewLibraryUpgrade(
  study: StudyProtocol,
  useId: string,
  entries: PersonalLibraryEntry[]
): PreviewLibraryUpgradeResult {
  const prepared = prepare(study, useId, entries);
  if (!isPrepared(prepared)) return prepared;
  return { status: "ready", preview: prepared.preview };
}

/** Picks, per property, the value the merged element takes. */
function mergeElement(
  scope: LibraryUpgradeScope,
  elementId: string,
  source: Json | undefined,
  current: Json | undefined,
  incoming: Json | undefined,
  changesById: Map<string, LibraryUpgradeChange>,
  resolutions: Record<string, LibraryConflictChoice>
): Json | undefined {
  const elementChange = changesById.get(
    scope === "section" ? "" : `${scope}:${elementId}`
  );
  if (elementChange) {
    const take =
      elementChange.kind === "conflict"
        ? resolutions[elementChange.id]
        : elementChange.kind === "incoming"
          ? "incoming"
          : "current";
    return cloneDeep(take === "incoming" ? incoming : current);
  }
  if (!current || !incoming) return cloneDeep(current || incoming);

  const merged: Json = {};
  const keys = new Set([
    ...Object.keys(source || {}),
    ...Object.keys(current),
    ...Object.keys(incoming),
  ]);
  for (const property of keys) {
    const change = changesById.get(`${scope}:${elementId}:${property}`);
    let value: unknown;
    if (!change) value = current[property];
    else if (change.kind === "incoming") value = incoming[property];
    else if (change.kind === "conflict") {
      value =
        resolutions[change.id] === "incoming"
          ? incoming[property]
          : current[property];
    } else value = current[property];
    if (value !== undefined) merged[property] = cloneDeep(value);
  }
  return merged;
}

/**
 * Applies a previewed upgrade, returning a new study. The study passed in is
 * never mutated, so the caller can keep it as the single undo step.
 *
 * Every conflict in the preview needs an explicit entry in `resolutions`;
 * `"current"` keeps the study's version and `"incoming"` takes the
 * library's. The upgrade is refused when the study or library changed since
 * the preview, so what is applied is always what was shown.
 */
export function applyLibraryUpgrade(
  study: StudyProtocol,
  preview: LibraryUpgradePreview,
  entries: PersonalLibraryEntry[],
  resolutions: Record<string, LibraryConflictChoice>,
  now?: Date
): ApplyLibraryUpgradeResult {
  const prepared = prepare(study, preview.useId, entries);
  if (!isPrepared(prepared)) {
    return {
      status: "unavailable",
      message:
        "message" in prepared
          ? prepared.message
          : "This library block is no longer recorded in the study.",
    };
  }
  if (prepared.preview.fingerprint !== preview.fingerprint) {
    return {
      status: "stale",
      message:
        "The study or the library changed after this preview was prepared. Review the upgrade again.",
    };
  }

  const unresolved = prepared.preview.conflicts
    .filter(
      (change) =>
        resolutions[change.id] !== "current" &&
        resolutions[change.id] !== "incoming"
    )
    .map((change) => change.id);
  if (unresolved.length > 0) {
    return { status: "unresolved", unresolvedChangeIds: unresolved };
  }

  const { use, entry, block, comparison } = prepared;
  const { source, current, incoming, changes } = comparison;
  const changesById = new Map<string, LibraryUpgradeChange>();
  for (const change of changes) changesById.set(change.id, change);

  // 1. Merge in the library namespace.
  const mergedSection =
    mergeElement(
      "section",
      SECTION_KEY,
      source.section,
      current.section,
      incoming.section,
      changesById,
      resolutions
    ) || {};
  const mergeAll = (
    scope: Exclude<LibraryUpgradeScope, "section">,
    s: Map<string, BlockElement>,
    c: Map<string, BlockElement>,
    i: Map<string, BlockElement>
  ) => {
    const result = new Map<string, Json>();
    for (const id of unionKeys(s, c, i)) {
      if (!s.has(id) && !i.has(id)) continue;
      const value = mergeElement(
        scope,
        id,
        s.get(id)?.value,
        c.get(id)?.value,
        i.get(id)?.value,
        changesById,
        resolutions
      );
      if (value) result.set(id, value);
    }
    return result;
  };
  const mergedFields = mergeAll(
    "field",
    source.fields,
    current.fields,
    incoming.fields
  );
  const mergedRules = mergeAll(
    "rule",
    source.rules,
    current.rules,
    incoming.rules
  );
  const blockCodelistIds = unionKeys(source.codelists, incoming.codelists);
  const mergedCodelists = new Map<string, Json>();
  for (const id of blockCodelistIds) {
    const value = mergeElement(
      "codelist",
      id,
      source.codelists.get(id)?.value,
      current.codelists.get(id)?.value,
      incoming.codelists.get(id)?.value,
      changesById,
      resolutions
    );
    if (value) mergedCodelists.set(id, value);
  }

  // 2. Translate back into the study namespace.
  const form = study.forms[block.formIndex];
  const nextIdMap: Record<string, string> = {};

  const lineageStudyIds = new Set(Object.values(use.idMap));
  const reservedVars = new Set<string>();
  for (const candidate of study.forms || []) {
    for (const section of candidate.sections || []) {
      walkFields(section.fields, (field) => {
        if (!lineageStudyIds.has(field.id)) {
          reservedVars.add(field.variableName.toUpperCase());
        }
      });
    }
  }

  const variableMap = Object.fromEntries(
    Object.entries(use.variableMap).map(([lib, std]) => [
      lib.toUpperCase(),
      std,
    ])
  );
  const nextVariableMap: Record<string, string> = {};
  const incomingVarsById = new Map<string, string>();
  const collectIncomingVars = (fields: unknown) => {
    if (!Array.isArray(fields)) return;
    for (const field of fields as CRFField[]) {
      incomingVarsById.set(field.id, field.variableName);
      collectIncomingVars(field.repeatingColumns);
    }
  };
  for (const [id, element] of incoming.fields) {
    incomingVarsById.set(id, String(element.value.variableName ?? ""));
    collectIncomingVars(element.value.repeatingColumns);
  }

  const allocateVar = (libraryId: string, libraryName: string): string => {
    const upper = libraryName.toUpperCase();
    const inherited = variableMap[upper];
    let chosen =
      inherited && !reservedVars.has(inherited.toUpperCase())
        ? inherited
        : libraryName;
    if (reservedVars.has(chosen.toUpperCase())) {
      chosen = generateCdashVariableName(chosen, reservedVars);
    }
    reservedVars.add(chosen.toUpperCase());
    const incomingName = incomingVarsById.get(libraryId);
    if (incomingName && incomingName.toUpperCase() === upper) {
      nextVariableMap[upper] = chosen;
    }
    return chosen;
  };

  const toStudyField = (libraryId: string, value: Json): CRFField => {
    const field = { ...cloneDeep(value), id: libraryId } as unknown as CRFField;
    const visit = (target: CRFField) => {
      const libId = target.id;
      const studyId = use.idMap[libId] || generateEngineId("fld");
      nextIdMap[libId] = studyId;
      target.id = studyId;
      target.variableName = allocateVar(libId, target.variableName);
      if (target.repeatingColumns) target.repeatingColumns.forEach(visit);
    };
    visit(field);
    return field;
  };

  const studyFields = new Map<string, CRFField>();
  for (const [libraryId, value] of mergedFields) {
    studyFields.set(libraryId, toStudyField(libraryId, value));
  }

  // Formulas follow every rename between the library and study namespaces.
  const formulaRenames = Object.entries(nextVariableMap);
  for (const field of studyFields.values()) {
    walkFields([field], (target) => {
      if (target.calculationFormula) {
        target.calculationFormula = renameVariables(
          target.calculationFormula,
          formulaRenames
        );
      }
    });
  }

  // Field order: the study's order, with library additions placed after
  // their nearest preceding sibling in the incoming version.
  const reverseIds = invert(use.idMap);
  const ordered: CRFField[] = [];
  const placed = new Set<string>();
  for (const field of block.section.fields) {
    const libraryId = reverseIds.get(field.id);
    if (!libraryId) {
      ordered.push(field);
      continue;
    }
    const merged = studyFields.get(libraryId);
    if (merged) {
      ordered.push(merged);
      placed.add(libraryId);
    }
  }
  let anchor: string | undefined;
  for (const libraryId of incoming.fieldOrder) {
    const merged = studyFields.get(libraryId);
    if (merged && !placed.has(libraryId)) {
      const anchorIndex = anchor
        ? ordered.findIndex(
            (field) => field.id === studyFields.get(anchor!)?.id
          )
        : -1;
      ordered.splice(anchorIndex + 1, 0, merged);
      placed.add(libraryId);
    }
    if (studyFields.has(libraryId)) anchor = libraryId;
  }
  for (const [libraryId, merged] of studyFields) {
    if (!placed.has(libraryId)) ordered.push(merged);
  }

  const toStudyRef = (id: string) => nextIdMap[id] || use.idMap[id] || id;
  const studyRules = new Map<string, EditCheckRule>();
  for (const [libraryId, value] of mergedRules) {
    const rule = { ...cloneDeep(value) } as unknown as EditCheckRule;
    const studyId = use.idMap[libraryId] || generateEngineId("rule");
    nextIdMap[libraryId] = studyId;
    rule.id = studyId;
    rule.targetFieldId = toStudyRef(rule.targetFieldId);
    rule.triggerFieldIds = (rule.triggerFieldIds || []).map(toStudyRef);
    const conditions = [
      ...(rule.conditions || []),
      ...(rule.conditionGroups || []).flatMap((g) => g.conditions || []),
    ];
    for (const condition of conditions) {
      condition.fieldId = toStudyRef(condition.fieldId);
      if (condition.compareFieldId) {
        condition.compareFieldId = toStudyRef(condition.compareFieldId);
      }
    }
    studyRules.set(libraryId, rule);
  }

  const nextRules: EditCheckRule[] = [];
  const placedRules = new Set<string>();
  for (const rule of form.rules || []) {
    const libraryId = reverseIds.get(rule.id);
    if (!libraryId) {
      nextRules.push(rule);
      continue;
    }
    const merged = studyRules.get(libraryId);
    if (merged) {
      nextRules.push(merged);
      placedRules.add(libraryId);
    }
  }
  for (const [libraryId, rule] of studyRules) {
    if (!placedRules.has(libraryId)) nextRules.push(rule);
  }

  const nextSection: CRFSection = {
    ...(mergedSection as unknown as Omit<CRFSection, "id" | "fields">),
    id: block.section.id,
    fields: ordered,
  } as CRFSection;

  const nextForms = study.forms.map((candidate, index) =>
    index === block.formIndex
      ? {
          ...candidate,
          sections: candidate.sections.map((section, sectionIndex) =>
            sectionIndex === block.sectionIndex ? nextSection : section
          ),
          rules: nextRules,
        }
      : candidate
  );

  // Codelists: replace or add merged ones; drop one the merge removed only
  // when no field in the upgraded study still refers to it.
  const referencedCodelists = new Set<string>();
  for (const candidate of nextForms) {
    for (const section of candidate.sections || []) {
      walkFields(section.fields, (field) => {
        if (field.codelistId) referencedCodelists.add(field.codelistId);
      });
    }
  }
  const nextCodelists: CodelistDefinition[] = [];
  const placedCodelists = new Set<string>();
  for (const codelist of study.codelists || []) {
    if (!blockCodelistIds.includes(codelist.id)) {
      nextCodelists.push(codelist);
      continue;
    }
    const merged = mergedCodelists.get(codelist.id);
    placedCodelists.add(codelist.id);
    if (merged) nextCodelists.push(merged as unknown as CodelistDefinition);
    else if (referencedCodelists.has(codelist.id)) nextCodelists.push(codelist);
  }
  for (const [id, merged] of mergedCodelists) {
    if (!placedCodelists.has(id)) {
      nextCodelists.push(merged as unknown as CodelistDefinition);
    }
  }

  const resolutionRecord: Record<string, LibraryConflictChoice> = {};
  for (const conflict of prepared.preview.conflicts) {
    resolutionRecord[conflict.id] = resolutions[conflict.id];
  }
  const record: StudyLibraryUpgradeRecord = {
    fromVersion: use.entryVersion,
    toVersion: entry.version,
    appliedAt: (now || new Date()).toISOString(),
    previousIdMap: { ...use.idMap },
    previousVariableMap: { ...use.variableMap },
    resolutions: resolutionRecord,
    incomingChangeCount: prepared.preview.counts.incoming,
    localCustomizationCount: prepared.preview.counts.local,
    conflictCount: prepared.preview.counts.conflict,
  };

  // The section keeps its library identity in the lineage map.
  const sectionLibraryId = reverseIds.get(use.sectionId);
  if (sectionLibraryId) nextIdMap[sectionLibraryId] = use.sectionId;

  const nextUse: StudyLibraryUse = {
    ...use,
    entryName: entry.name,
    entryVersion: entry.version,
    idMap: nextIdMap,
    variableMap: nextVariableMap,
    upgradeHistory: [...(use.upgradeHistory || []), record],
  };

  return {
    status: "applied",
    study: {
      ...study,
      forms: nextForms,
      codelists: nextCodelists,
      libraryUses: (study.libraryUses || []).map((candidate) =>
        candidate.id === use.id ? nextUse : candidate
      ),
    },
    use: nextUse,
    record,
  };
}
