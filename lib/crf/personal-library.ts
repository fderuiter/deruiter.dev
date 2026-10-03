/**
 * Versioned personal block library for the CRF Studio (#678).
 *
 * Authors can capture a section of a form - together with the rules and
 * codelists it actually depends on - into a locally persisted library, then
 * insert independent copies of it into any study.
 *
 * Two properties make the library trustworthy, and both are enforced here
 * rather than left to callers:
 *
 * Insertions are independent of the library. Every insertion deep-clones the
 * stored content and allocates fresh identities, so editing a library entry
 * afterwards never reaches back into studies that already used it, and two
 * insertions of the same entry never share identity.
 *
 * Insertions are independent of each other. Identity allocation and CDASH
 * variable remapping run per insertion against the target study's current
 * names, so customizing one copy leaves the others untouched.
 *
 * Persistence follows the same versioned-envelope discipline as the study
 * draft store: a corrupt payload is preserved for recovery rather than
 * silently discarded, and an unavailable store degrades to a reported status
 * instead of throwing.
 */

import type {
  CRFField,
  CRFForm,
  CRFSection,
  CodelistDefinition,
  EditCheckRule,
  StudyProtocol,
} from "./types";
import { generateEngineId, generateCdashVariableName } from "./precision-date";
import { cloneDeep } from "../utils";
import {
  safeIsAvailable,
  safeRawStorage,
  type RawStorage,
} from "../safe-storage";

/** localStorage key holding the author's personal block library. */
export const PERSONAL_LIBRARY_STORAGE_KEY = "crf_studio_personal_library_v1";

/** Backup key an unreadable library is copied to before the primary is reset. */
export const PERSONAL_LIBRARY_CORRUPT_BACKUP_KEY =
  "crf_studio_personal_library_v1_corrupt";

/** Current envelope format version. Bump when the envelope shape changes. */
export const PERSONAL_LIBRARY_ENVELOPE_VERSION = 1;

/**
 * Where a library entry came from, captured at save time so an author can
 * later tell which study and form a block was lifted out of.
 */
export interface LibraryEntryProvenance {
  sourceStudyId: string;
  sourceStudyName: string;
  sourceFormId: string;
  sourceFormName: string;
  sourceSectionId: string;
  capturedAt: string;
}

/**
 * One saved block. `version` increments on every edit, and an insertion
 * records the version it was taken from.
 */
export interface PersonalLibraryEntry {
  id: string;
  name: string;
  description?: string;
  /** Monotonic version, incremented by each successful update. */
  version: number;
  /**
   * Free-text notes the author wants carried with the block - protocol
   * assumptions, units, populations it is valid for.
   */
  assumptions?: string;
  provenance: LibraryEntryProvenance;
  section: CRFSection;
  rules: EditCheckRule[];
  codelists: CodelistDefinition[];
  createdAt: string;
  updatedAt: string;
  /**
   * Content of every earlier version, oldest first (#681). Written by
   * {@link updateLibraryEntry} so a study that used an older version can be
   * compared three ways against the newest one. Entries saved before this
   * field existed simply have no history; their earlier versions are unknown.
   */
  revisions?: PersonalLibraryEntryRevision[];
}

/**
 * The content of one earlier version of a library entry, kept so an upgrade
 * can compare what a study used with what the library holds now.
 */
export interface PersonalLibraryEntryRevision {
  version: number;
  name: string;
  description?: string;
  assumptions?: string;
  section: CRFSection;
  rules: EditCheckRule[];
  codelists: CodelistDefinition[];
  updatedAt: string;
}

export interface PersonalLibraryEnvelope {
  envelopeVersion: number;
  savedAt: string;
  entries: PersonalLibraryEntry[];
}

export type SaveLibraryResult =
  | { status: "saved"; savedAt: string }
  | { status: "unavailable" }
  | { status: "error"; message: string };

export type LoadLibraryResult =
  | { status: "loaded"; entries: PersonalLibraryEntry[]; savedAt: string }
  | { status: "empty" }
  | { status: "corrupt" };

/**
 * Marks content that came from the library, so an inserted block can name its
 * source entry and the exact version it was taken from.
 */
export interface LibrarySourceRef {
  entryId: string;
  entryName: string;
  entryVersion: number;
  insertedAt: string;
}

/**
 * A condition that would affect an insertion. Nothing here blocks the
 * insertion; conflicts are resolved automatically by remapping, and are
 * reported so the author can see what will change before committing.
 */
export interface LibraryInsertionConflict {
  kind: "variable_name" | "codelist_id" | "section_title";
  /** The colliding value as stored in the library entry. */
  existing: string;
  /** What it will become in the target study, when remapping applies. */
  resolution: string;
  detail: string;
}

export interface LibraryInsertionPreview {
  entryId: string;
  entryVersion: number;
  fieldCount: number;
  ruleCount: number;
  codelistCount: number;
  /** Variable names that will be carried across unchanged. */
  variableNames: string[];
  conflicts: LibraryInsertionConflict[];
}

export interface InstantiatedLibraryEntry {
  section: CRFSection;
  rules: EditCheckRule[];
  /** Codelists that must be merged into the target study. */
  codelists: CodelistDefinition[];
  variableMap: Record<string, string>;
  idMap: Record<string, string>;
  source: LibrarySourceRef;
}

export interface InstantiateLibraryEntryOptions {
  existingVariableNames?: Iterable<string>;
  existingCodelistIds?: Iterable<string>;
}

function deepClone<T>(value: T): T {
  return cloneDeep(value);
}

function isLibraryEntryShape(value: unknown): value is PersonalLibraryEntry {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.version === "number" &&
    typeof candidate.section === "object" &&
    candidate.section !== null &&
    Array.isArray(candidate.rules) &&
    Array.isArray(candidate.codelists)
  );
}

function isLibraryEnvelopeShape(
  value: unknown
): value is PersonalLibraryEnvelope {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.envelopeVersion === "number" &&
    typeof candidate.savedAt === "string" &&
    Array.isArray(candidate.entries) &&
    candidate.entries.every(isLibraryEntryShape)
  );
}

/**
 * Resolves a usable Storage, defensively checking that the browser actually
 * exposes working accessors rather than assuming `window.localStorage` is
 * present and functional.
 */
export function resolveLibraryStorage(
  storage?: RawStorage
): RawStorage | undefined {
  if (storage) return storage;
  return safeIsAvailable() ? safeRawStorage : undefined;
}

/**
 * Collects the rules a section depends on: those targeting one of its fields,
 * and those whose conditions read one of its fields.
 */
function collectDependentRules(
  section: CRFSection,
  rules: EditCheckRule[]
): EditCheckRule[] {
  const ids = new Set<string>();
  for (const field of section.fields) {
    ids.add(field.id);
    ids.add(field.variableName);
  }

  return rules.filter((rule) => {
    if (ids.has(rule.targetFieldId)) return true;
    if ((rule.triggerFieldIds || []).some((id) => ids.has(id))) return true;

    const everyCondition = [
      ...(rule.conditions || []),
      ...(rule.conditionGroups || []).flatMap(
        (group) => group.conditions || []
      ),
    ];
    return everyCondition.some(
      (condition) =>
        ids.has(condition.fieldId) ||
        (condition.compareFieldId ? ids.has(condition.compareFieldId) : false)
    );
  });
}

/**
 * Collects the codelists a section's fields reference, so an inserted block
 * arrives with the vocabularies it needs rather than dangling references.
 */
function collectDependentCodelists(
  section: CRFSection,
  codelists: CodelistDefinition[]
): CodelistDefinition[] {
  const referenced = new Set<string>();
  const walk = (fields: CRFField[]) => {
    for (const field of fields) {
      if (field.codelistId) referenced.add(field.codelistId);
      if (field.repeatingColumns) walk(field.repeatingColumns);
    }
  };
  walk(section.fields);

  return codelists.filter((codelist) => referenced.has(codelist.id));
}

/**
 * Captures a section of a form into a new library entry, pulling in the rules
 * and codelists it depends on and recording where it came from.
 *
 * The returned entry owns deep copies, so later edits to the source study
 * cannot mutate the saved block.
 */
export function captureLibraryEntry(options: {
  study: StudyProtocol;
  form: CRFForm;
  sectionId: string;
  name?: string;
  description?: string;
  assumptions?: string;
  now?: Date;
}): PersonalLibraryEntry {
  const { study, form, sectionId } = options;
  const section = form.sections.find((candidate) => candidate.id === sectionId);
  if (!section) {
    throw new Error(
      `Cannot capture library entry: section "${sectionId}" is not part of form "${form.id}".`
    );
  }

  const timestamp = (options.now || new Date()).toISOString();

  return {
    id: generateEngineId("libentry"),
    name: options.name?.trim() || section.title,
    description: options.description,
    version: 1,
    assumptions: options.assumptions,
    provenance: {
      sourceStudyId: study.id,
      sourceStudyName: study.studyName,
      sourceFormId: form.id,
      sourceFormName: form.name,
      sourceSectionId: section.id,
      capturedAt: timestamp,
    },
    section: deepClone(section),
    rules: deepClone(collectDependentRules(section, form.rules || [])),
    codelists: deepClone(
      collectDependentCodelists(section, study.codelists || [])
    ),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

/**
 * Reads the personal library. A present-but-unreadable payload is copied to
 * {@link PERSONAL_LIBRARY_CORRUPT_BACKUP_KEY} for manual recovery rather than
 * being silently overwritten.
 */
export function loadPersonalLibrary(storage?: RawStorage): LoadLibraryResult {
  const target = resolveLibraryStorage(storage);
  if (!target) return { status: "empty" };

  // A store that throws on access reads as empty, never as a crash (#1632).
  let raw: string | null;
  try {
    raw = target.getItem(PERSONAL_LIBRARY_STORAGE_KEY);
  } catch {
    return { status: "empty" };
  }
  if (!raw) return { status: "empty" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    preserveCorruptLibrary(target, raw);
    return { status: "corrupt" };
  }

  if (
    !isLibraryEnvelopeShape(parsed) ||
    parsed.envelopeVersion !== PERSONAL_LIBRARY_ENVELOPE_VERSION
  ) {
    preserveCorruptLibrary(target, raw);
    return { status: "corrupt" };
  }

  return {
    status: "loaded",
    entries: parsed.entries,
    savedAt: parsed.savedAt,
  };
}

function preserveCorruptLibrary(target: RawStorage, raw: string): void {
  try {
    target.setItem(PERSONAL_LIBRARY_CORRUPT_BACKUP_KEY, raw);
  } catch {
    // A full or unavailable store cannot preserve the backup. The original
    // entry is deliberately left in place rather than cleared.
  }
}

/**
 * Writes the whole library. Never throws; a full or unavailable store reports
 * a status so the caller can keep working in memory.
 */
export function savePersonalLibrary(
  entries: PersonalLibraryEntry[],
  storage?: RawStorage,
  now?: Date
): SaveLibraryResult {
  const target = resolveLibraryStorage(storage);
  if (!target) return { status: "unavailable" };

  const savedAt = (now || new Date()).toISOString();
  const envelope: PersonalLibraryEnvelope = {
    envelopeVersion: PERSONAL_LIBRARY_ENVELOPE_VERSION,
    savedAt,
    entries,
  };

  try {
    target.setItem(PERSONAL_LIBRARY_STORAGE_KEY, JSON.stringify(envelope));
    return { status: "saved", savedAt };
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message : "Unknown storage error",
    };
  }
}

/**
 * Lists saved entries, newest first. A corrupt or absent library reads as an
 * empty list so callers can render without special-casing.
 */
export function listLibraryEntries(
  storage?: RawStorage
): PersonalLibraryEntry[] {
  const result = loadPersonalLibrary(storage);
  if (result.status !== "loaded") return [];
  return [...result.entries].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt)
  );
}

/**
 * Adds an entry to the library, replacing any entry with the same id.
 */
export function upsertLibraryEntry(
  entry: PersonalLibraryEntry,
  storage?: RawStorage
): SaveLibraryResult {
  const existing = listLibraryEntries(storage);
  const next = existing.filter((candidate) => candidate.id !== entry.id);
  next.push(entry);
  return savePersonalLibrary(next, storage);
}

/**
 * Applies an edit to a stored entry and increments its version.
 *
 * Content already inserted into a study is unaffected, because insertions hold
 * their own deep copies with their own identities.
 */
export function updateLibraryEntry(
  entryId: string,
  changes: Partial<
    Pick<
      PersonalLibraryEntry,
      "name" | "description" | "assumptions" | "section" | "rules" | "codelists"
    >
  >,
  storage?: RawStorage,
  now?: Date
): { status: "updated"; entry: PersonalLibraryEntry } | { status: "missing" } {
  const entries = listLibraryEntries(storage);
  const current = entries.find((candidate) => candidate.id === entryId);
  if (!current) return { status: "missing" };

  const updated: PersonalLibraryEntry = {
    ...current,
    ...changes,
    version: current.version + 1,
    updatedAt: (now || new Date()).toISOString(),
    // The outgoing version is kept, so studies that used it can still be
    // compared against the new one (#681).
    revisions: [...(current.revisions || []), snapshotRevision(current)],
  };

  upsertLibraryEntry(updated, storage);
  return { status: "updated", entry: updated };
}

function snapshotRevision(
  entry: PersonalLibraryEntry
): PersonalLibraryEntryRevision {
  return deepClone({
    version: entry.version,
    name: entry.name,
    description: entry.description,
    assumptions: entry.assumptions,
    section: entry.section,
    rules: entry.rules,
    codelists: entry.codelists,
    updatedAt: entry.updatedAt,
  });
}

/**
 * Returns the content of one version of an entry: the entry itself when the
 * version is current, an earlier revision when one was kept, and `undefined`
 * when that version's content is not known.
 */
export function getLibraryEntryRevision(
  entry: PersonalLibraryEntry,
  version: number
): PersonalLibraryEntryRevision | undefined {
  if (version === entry.version) return snapshotRevision(entry);
  const revision = (entry.revisions || []).find(
    (candidate) => candidate.version === version
  );
  return revision ? deepClone(revision) : undefined;
}

/**
 * Removes an entry. Studies that already inserted it keep their copies.
 */
export function deleteLibraryEntry(
  entryId: string,
  storage?: RawStorage
): SaveLibraryResult {
  const remaining = listLibraryEntries(storage).filter(
    (candidate) => candidate.id !== entryId
  );
  return savePersonalLibrary(remaining, storage);
}

function collectStudyVariableNames(study: StudyProtocol): Set<string> {
  const names = new Set<string>();
  const walk = (fields: CRFField[]) => {
    for (const field of fields) {
      names.add(field.variableName.toUpperCase());
      if (field.repeatingColumns) walk(field.repeatingColumns);
    }
  };
  for (const form of study.forms || []) {
    for (const section of form.sections || []) walk(section.fields);
  }
  return names;
}

/**
 * Describes what inserting an entry into a study would do, before anything is
 * committed: how much content arrives, and which names or ids collide.
 *
 * Collisions are not errors. They are resolved by remapping at insertion time,
 * and are surfaced here so the author sees the remapping in advance.
 */
export function previewLibraryInsertion(
  entry: PersonalLibraryEntry,
  study: StudyProtocol
): LibraryInsertionPreview {
  const existingVars = collectStudyVariableNames(study);
  const existingCodelistIds = new Set(
    (study.codelists || []).map((codelist) => codelist.id)
  );
  const existingTitles = new Set(
    (study.forms || []).flatMap((form) =>
      (form.sections || []).map((section) => section.title)
    )
  );

  const conflicts: LibraryInsertionConflict[] = [];
  // Simulate allocation against a working copy so the preview reports the same
  // names the insertion will actually produce.
  const projected = new Set(existingVars);
  const variableNames: string[] = [];

  for (const field of entry.section.fields) {
    const original = field.variableName.toUpperCase();
    if (projected.has(original)) {
      const resolution = generateCdashVariableName(original, projected);
      projected.add(resolution);
      variableNames.push(resolution);
      conflicts.push({
        kind: "variable_name",
        existing: original,
        resolution,
        detail: `Variable "${original}" already exists in this study and will be inserted as "${resolution}".`,
      });
    } else {
      projected.add(original);
      variableNames.push(original);
    }
  }

  for (const codelist of entry.codelists) {
    if (existingCodelistIds.has(codelist.id)) {
      conflicts.push({
        kind: "codelist_id",
        existing: codelist.id,
        resolution: codelist.id,
        detail: `Codelist "${codelist.name}" already exists in this study and the existing definition will be kept.`,
      });
    }
  }

  if (existingTitles.has(entry.section.title)) {
    conflicts.push({
      kind: "section_title",
      existing: entry.section.title,
      resolution: entry.section.title,
      detail: `A section titled "${entry.section.title}" already exists. Titles are not required to be unique, so both will be present.`,
    });
  }

  return {
    entryId: entry.id,
    entryVersion: entry.version,
    fieldCount: entry.section.fields.length,
    ruleCount: entry.rules.length,
    codelistCount: entry.codelists.length,
    variableNames,
    conflicts,
  };
}

/**
 * Produces an independent copy of a library entry, ready to insert.
 *
 * Every identity is freshly allocated and every internal reference remapped -
 * rule targets, trigger lists, condition operands including grouped and
 * field-to-field comparisons, calculation formulas and codelist references -
 * so the copy shares nothing with the library entry or with any previous
 * insertion of it.
 */
export function instantiateLibraryEntry(
  entry: PersonalLibraryEntry,
  options?: InstantiateLibraryEntryOptions,
  now?: Date
): InstantiatedLibraryEntry {
  const section: CRFSection = deepClone(entry.section);
  const rules: EditCheckRule[] = deepClone(entry.rules);
  const codelists: CodelistDefinition[] = deepClone(entry.codelists);

  const variableMap: Record<string, string> = {};
  const idMap: Record<string, string> = {};

  const existingVars = new Set(
    Array.from(options?.existingVariableNames || []).map((name) =>
      name.toUpperCase()
    )
  );
  const existingCodelistIds = new Set(options?.existingCodelistIds || []);

  const newSectionId = generateEngineId("sec");
  idMap[section.id] = newSectionId;
  section.id = newSectionId;

  const remapFields = (fields: CRFField[]) => {
    for (const field of fields) {
      const previousId = field.id;
      const nextId = generateEngineId("fld");
      idMap[previousId] = nextId;
      field.id = nextId;

      const original = field.variableName.toUpperCase();
      if (existingVars.has(original)) {
        const next = generateCdashVariableName(original, existingVars);
        variableMap[original] = next;
        field.variableName = next;
        existingVars.add(next);
      } else {
        variableMap[original] = original;
        existingVars.add(original);
      }

      if (field.repeatingColumns) remapFields(field.repeatingColumns);
    }
  };
  remapFields(section.fields);

  // Calculation formulas reference variable names, so they follow the rename.
  const remapFormulas = (fields: CRFField[]) => {
    for (const field of fields) {
      if (field.calculationFormula) {
        let formula = field.calculationFormula;
        for (const [previous, next] of Object.entries(variableMap)) {
          if (previous !== next) {
            formula = formula.replace(
              new RegExp(`\\b${previous}\\b`, "g"),
              next
            );
          }
        }
        field.calculationFormula = formula;
      }
      if (field.repeatingColumns) remapFormulas(field.repeatingColumns);
    }
  };
  remapFormulas(section.fields);

  // Codelists keep their identity when the study already has them, so an
  // insertion reuses the study's existing vocabulary rather than duplicating
  // it. Only genuinely new codelists are carried in.
  const carriedCodelists: CodelistDefinition[] = [];
  for (const codelist of codelists) {
    if (!existingCodelistIds.has(codelist.id)) {
      carriedCodelists.push(codelist);
    }
  }

  for (const rule of rules) {
    const nextRuleId = generateEngineId("rule");
    idMap[rule.id] = nextRuleId;
    rule.id = nextRuleId;

    if (idMap[rule.targetFieldId]) {
      rule.targetFieldId = idMap[rule.targetFieldId];
    }
    rule.triggerFieldIds = (rule.triggerFieldIds || []).map(
      (id) => idMap[id] || id
    );

    const allConditions = [
      ...(rule.conditions || []),
      ...(rule.conditionGroups || []).flatMap(
        (group) => group.conditions || []
      ),
    ];
    for (const condition of allConditions) {
      if (idMap[condition.fieldId]) {
        condition.fieldId = idMap[condition.fieldId];
      }
      if (condition.compareFieldId && idMap[condition.compareFieldId]) {
        condition.compareFieldId = idMap[condition.compareFieldId];
      }
    }
  }

  return {
    section,
    rules,
    codelists: carriedCodelists,
    variableMap,
    idMap,
    source: {
      entryId: entry.id,
      entryName: entry.name,
      entryVersion: entry.version,
      insertedAt: (now || new Date()).toISOString(),
    },
  };
}

/**
 * Inserts an entry into a form of a study, returning a new study rather than
 * mutating the one passed in.
 *
 * The inserted section, its rules and any genuinely new codelists are added
 * together, so a caller commits the whole insertion or none of it.
 */
export function insertLibraryEntryIntoStudy(
  entry: PersonalLibraryEntry,
  study: StudyProtocol,
  formId: string,
  now?: Date
): { study: StudyProtocol; instantiated: InstantiatedLibraryEntry } {
  const targetForm = (study.forms || []).find((form) => form.id === formId);
  if (!targetForm) {
    throw new Error(
      `Cannot insert library entry: form "${formId}" is not part of study "${study.id}".`
    );
  }

  const instantiated = instantiateLibraryEntry(
    entry,
    {
      existingVariableNames: collectStudyVariableNames(study),
      existingCodelistIds: (study.codelists || []).map(
        (codelist) => codelist.id
      ),
    },
    now
  );

  const nextStudy: StudyProtocol = {
    ...study,
    codelists: [...(study.codelists || []), ...instantiated.codelists],
    forms: (study.forms || []).map((form) =>
      form.id === formId
        ? {
            ...form,
            sections: [...(form.sections || []), instantiated.section],
            rules: [...(form.rules || []), ...instantiated.rules],
          }
        : form
    ),
  };

  return { study: nextStudy, instantiated };
}
