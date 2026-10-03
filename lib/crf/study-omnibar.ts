/**
 * Study Omnibar search model (#544).
 *
 * Builds a categorized, fuzzy-searchable index over the objects of a study
 * (forms, fields, visits) and the studio actions that are actually supported
 * locally: inserting verified starter blocks into the active form, switching
 * studio views and opening the export entry points. Every entry carries the
 * context that owns it (the form and section that hold a field, the visits
 * that collect a form), so a result is unambiguous before it is chosen.
 *
 * The model is pure: it never mutates the study. Insertion entries are only
 * offered after a dry run through the same `StudyProtocolEngine` operations
 * the visible controls use succeeds against the active form.
 */

import type { StudioMode, StudyProtocol, CRFForm } from "./types";
import { StudyProtocolEngine } from "./study-engine";
import {
  ALL_SLASH_COMMANDS,
  type SlashCommandItem,
} from "./smart-blocks-engine";
import { getLevenshteinDistance } from "../search-utils";

/** Result groups shown by the omnibar, in their default display order. */
export type OmnibarCategory =
  "form" | "field" | "visit" | "insert" | "navigate" | "export";

/** Display order of the omnibar groups when nothing ranks them. */
export const OMNIBAR_CATEGORY_ORDER: readonly OmnibarCategory[] = [
  "form",
  "field",
  "visit",
  "insert",
  "navigate",
  "export",
];

/** Human-readable group headings for each omnibar category. */
export const OMNIBAR_CATEGORY_LABELS: Readonly<
  Record<OmnibarCategory, string>
> = {
  form: "Forms",
  field: "Fields",
  visit: "Visits",
  insert: "Insert starter blocks",
  navigate: "Studio views",
  export: "Export",
};

/** What happens when an omnibar entry is chosen. */
export type OmnibarAction =
  | { kind: "open_form"; formId: string }
  | { kind: "open_field"; formId: string; sectionId: string; fieldId: string }
  | { kind: "open_visit"; visitId: string }
  | { kind: "insert"; command: SlashCommandItem; formId: string }
  | { kind: "switch_mode"; mode: StudioMode }
  | { kind: "open_export_document" }
  | { kind: "open_review_package" };

/** One searchable omnibar row. */
export interface OmnibarEntry {
  /** Stable, category-prefixed identifier. */
  id: string;
  category: OmnibarCategory;
  /** Primary label, e.g. a form name or a field label. */
  title: string;
  /**
   * Owning context, e.g. `Demographics (DM) › Subject Information`, or the
   * insertion target for an insert action.
   */
  context: string;
  /** Short secondary detail such as a variable name or a domain. */
  detail?: string;
  /** Extra terms matched by search but not displayed. */
  keywords: string[];
  action: OmnibarAction;
}

/** Where insert actions would land, mirroring the slash palette target. */
export interface OmnibarInsertionTarget {
  formId: string;
  sectionId?: string;
  index?: number;
}

/** Options for {@link buildStudyOmnibarIndex}. */
export interface BuildStudyOmnibarIndexOptions {
  /** Form that insert actions target; insert actions are omitted without it. */
  insertionTarget?: OmnibarInsertionTarget;
}

/** A ranked search hit. */
export interface OmnibarSearchResult {
  entry: OmnibarEntry;
  score: number;
}

/** One rendered group of results. */
export interface OmnibarResultGroup {
  category: OmnibarCategory;
  label: string;
  results: OmnibarSearchResult[];
  /** Matches left out by the per-group limit. */
  hiddenCount: number;
}

const MODE_ENTRIES: ReadonlyArray<{
  mode: StudioMode;
  title: string;
  context: string;
  keywords: string[];
}> = [
  {
    mode: "designer",
    title: "Form Designer",
    context: "Build the open form: add, arrange and configure fields",
    keywords: ["designer", "canvas", "builder"],
  },
  {
    mode: "grid",
    title: "Active Form Grid",
    context: "Edit every field of the open form in one table",
    keywords: ["grid", "table", "spreadsheet"],
  },
  {
    mode: "matrix",
    title: "Visit Matrix (SoA)",
    context:
      "Schedule of Assessments: which forms are collected at which visit",
    keywords: ["matrix", "soa", "schedule", "assessments"],
  },
  {
    mode: "rules",
    title: "Logic & AST Rules",
    context: "Edit checks and show/hide logic, drawn as a graph",
    keywords: ["rules", "logic", "edit checks", "ast", "graph"],
  },
  {
    mode: "edc",
    title: "Live EDC Simulator",
    context: "Enter synthetic test data and see the checks fire",
    keywords: ["edc", "simulator", "data entry", "test"],
  },
  {
    mode: "acrf",
    title: "Annotated aCRF",
    context: "Each question tagged with its SDTM variable",
    keywords: ["acrf", "annotated", "sdtm", "annotations"],
  },
];

const DICTIONARY_LOOKUP_TERMS = ["meddra", "whodrug", "who drug", "who-drug"];

/**
 * True when a query asks for licensed medical dictionary coding (MedDRA,
 * WHODrug). The studio has no dictionary lookup, so the omnibar explains
 * that instead of advertising a capability it does not have.
 *
 * @param query - Raw omnibar query text.
 * @returns Whether the query names an unavailable dictionary lookup.
 */
export function isUnsupportedDictionaryQuery(query: string): boolean {
  const clean = query.trim().toLowerCase();
  if (!clean) return false;
  return DICTIONARY_LOOKUP_TERMS.some(
    (term) =>
      clean.includes(term) || (clean.length >= 4 && term.startsWith(clean))
  );
}

/**
 * Lists the names of the visits that collect a form, across the visit's
 * default assignments, its alternate `formIds` list and per-arm assignments.
 *
 * @param study - The study to read.
 * @param formId - The form to look up.
 * @returns Visit names in schedule order, without duplicates.
 */
export function getVisitNamesForForm(
  study: StudyProtocol,
  formId: string
): string[] {
  const names: string[] = [];
  for (const visit of study.visits ?? []) {
    const ids = new Set<string>([
      ...(visit.assignedFormIds ?? []),
      ...(visit.formIds ?? []),
      ...Object.values(visit.armFormAssignments ?? {}).flat(),
    ]);
    if (ids.has(formId)) names.push(visit.name);
  }
  return names;
}

function describeVisits(visitNames: string[]): string {
  if (visitNames.length === 0) return "Not scheduled at any visit";
  if (visitNames.length <= 2) return `Visits: ${visitNames.join(", ")}`;
  return `Visits: ${visitNames.slice(0, 2).join(", ")} +${visitNames.length - 2} more`;
}

function formLabel(form: CRFForm): string {
  return form.domain ? `${form.name} (${form.domain})` : form.name;
}

function hasUniqueVariableNames(form: CRFForm | undefined): boolean {
  if (!form) return false;
  const seen = new Set<string>();
  for (const section of form.sections) {
    for (const field of section.fields) {
      const name = (field.variableName || "").toUpperCase();
      if (!name) continue;
      if (seen.has(name)) return false;
      seen.add(name);
    }
  }
  return true;
}

/**
 * Resolves where insert actions land, exactly as the slash palette does when
 * opened without an explicit target: directly after the selected field, or
 * else at the end of the form's first section.
 *
 * @param study - The current study.
 * @param formId - The active form, if any.
 * @param selectedFieldId - The selected field, if any.
 * @returns The insertion target, or undefined when the form does not exist.
 */
export function resolveOmnibarInsertionTarget(
  study: StudyProtocol,
  formId: string | undefined,
  selectedFieldId?: string | null
): OmnibarInsertionTarget | undefined {
  const form = study.forms.find((f) => f.id === formId);
  if (!form) return undefined;
  if (selectedFieldId) {
    for (const section of form.sections) {
      const idx = section.fields.findIndex((f) => f.id === selectedFieldId);
      if (idx !== -1) {
        return { formId: form.id, sectionId: section.id, index: idx + 1 };
      }
    }
  }
  return { formId: form.id, sectionId: form.sections[0]?.id };
}

/**
 * Dry-runs a slash command against the target form through the same engine
 * operation the slash palette and canvas controls apply, and reports
 * whether it would produce a valid insertion: no engine error, at least one
 * inserted field, and no duplicate variable names in the resulting form.
 * Section layout commands only need an existing target form.
 *
 * @param study - The current study, left unchanged.
 * @param target - Form, and optionally section and position, to insert at.
 * @param command - The slash command to verify.
 * @returns True when the insertion is safe to offer.
 */
export function verifyStarterInsertion(
  study: StudyProtocol,
  target: OmnibarInsertionTarget,
  command: SlashCommandItem
): boolean {
  const form = study.forms.find((f) => f.id === target.formId);
  if (!form || form.isLocked) return false;
  const options = {
    targetSectionId: target.sectionId,
    targetIndex: target.index,
  };

  try {
    if (command.action === "insert_section") return true;
    if (command.action === "insert_smart_block" && command.smartBlockId) {
      const res = StudyProtocolEngine.insertSmartBlock(
        study,
        form.id,
        command.smartBlockId,
        options
      );
      return (
        !res.error &&
        res.insertedFields.length > 0 &&
        hasUniqueVariableNames(res.study.forms.find((f) => f.id === form.id))
      );
    }
    if (command.action === "insert_field") {
      const res = StudyProtocolEngine.insertAtomicSlashField(
        study,
        form.id,
        command.id,
        options
      );
      return (
        !res.error &&
        Boolean(res.insertedField) &&
        hasUniqueVariableNames(res.study.forms.find((f) => f.id === form.id))
      );
    }
  } catch {
    return false;
  }
  return false;
}

/**
 * Builds the omnibar index for a study.
 *
 * Forms name their domain and the visits that collect them; fields name the
 * form and section that own them; visits name their study day and the forms
 * they collect. Insert actions name the form (and section) they target and
 * are included only when {@link verifyStarterInsertion} passes.
 *
 * @param study - The study to index.
 * @param options - Insertion target for insert actions.
 * @returns Every searchable entry, in default display order.
 */
export function buildStudyOmnibarIndex(
  study: StudyProtocol,
  options: BuildStudyOmnibarIndexOptions = {}
): OmnibarEntry[] {
  const entries: OmnibarEntry[] = [];
  const forms = study.forms ?? [];

  for (const form of forms) {
    const visitNames = getVisitNamesForForm(study, form.id);
    const fieldCount = form.sections.reduce((n, s) => n + s.fields.length, 0);
    entries.push({
      id: `form:${form.id}`,
      category: "form",
      title: form.name,
      context: `${form.domain ? `${form.domain} · ` : ""}${fieldCount} field${fieldCount === 1 ? "" : "s"} · ${describeVisits(visitNames)}`,
      detail: form.domain,
      keywords: [form.domain, form.description, ...visitNames].filter(Boolean),
      action: { kind: "open_form", formId: form.id },
    });
  }

  for (const form of forms) {
    const visitNames = getVisitNamesForForm(study, form.id);
    for (const section of form.sections) {
      for (const field of section.fields) {
        entries.push({
          id: `field:${form.id}:${field.id}`,
          category: "field",
          title: field.label || field.variableName,
          context: `${formLabel(form)} › ${section.title}`,
          detail: field.variableName,
          keywords: [
            field.variableName,
            field.dataType,
            form.domain,
            ...visitNames,
          ].filter(Boolean),
          action: {
            kind: "open_field",
            formId: form.id,
            sectionId: section.id,
            fieldId: field.id,
          },
        });
      }
    }
  }

  for (const visit of study.visits ?? []) {
    const formNames = (visit.assignedFormIds ?? [])
      .map((id) => forms.find((f) => f.id === id)?.name)
      .filter((name): name is string => Boolean(name));
    entries.push({
      id: `visit:${visit.id}`,
      category: "visit",
      title: visit.name,
      context: `Day ${visit.targetDay} · ${
        formNames.length === 0
          ? "No forms assigned"
          : `Forms: ${formNames.slice(0, 2).join(", ")}${formNames.length > 2 ? ` +${formNames.length - 2} more` : ""}`
      }`,
      detail: visit.oid,
      keywords: [visit.oid, visit.visitType, ...formNames].filter(Boolean),
      action: { kind: "open_visit", visitId: visit.id },
    });
  }

  const target = options.insertionTarget;
  const targetForm = target
    ? forms.find((f) => f.id === target.formId)
    : undefined;
  if (target && targetForm) {
    const targetSection = targetForm.sections.find(
      (s) => s.id === target.sectionId
    );
    for (const command of ALL_SLASH_COMMANDS) {
      if (!verifyStarterInsertion(study, target, command)) continue;
      const into =
        command.action === "insert_section" || !targetSection
          ? formLabel(targetForm)
          : `${formLabel(targetForm)} › ${targetSection.title}`;
      entries.push({
        id: `insert:${command.id}`,
        category: "insert",
        title: command.title,
        context: `Insert into ${into}`,
        detail: command.command,
        keywords: [command.command, command.description, ...command.keywords],
        action: { kind: "insert", command, formId: targetForm.id },
      });
    }
  }

  for (const mode of MODE_ENTRIES) {
    entries.push({
      id: `mode:${mode.mode}`,
      category: "navigate",
      title: mode.title,
      context: mode.context,
      keywords: mode.keywords,
      action: { kind: "switch_mode", mode: mode.mode },
    });
  }

  entries.push(
    {
      id: "export:workspace",
      category: "export",
      title: "Open export workspace",
      context: "Download the study as JSON, ODM-XML, SAS, R or FHIR",
      keywords: [
        "export",
        "download",
        "json",
        "odm",
        "xml",
        "sas",
        "r",
        "fhir",
        "define",
      ],
      action: { kind: "switch_mode", mode: "export" },
    },
    {
      id: "export:document",
      category: "export",
      title: "Export Word / PDF documents",
      context: "Protocol book (.docx) and blank or annotated CRF (PDF)",
      keywords: ["export", "word", "docx", "pdf", "print", "acrf", "blank crf"],
      action: { kind: "open_export_document" },
    },
    {
      id: "export:review-package",
      category: "export",
      title: "Build review package",
      context:
        "One zip from one study revision: forms, changes, tests, readiness",
      keywords: [
        "export",
        "review",
        "package",
        "zip",
        "manifest",
        "submission",
      ],
      action: { kind: "open_review_package" },
    }
  );

  return entries;
}

// Subsequence and typo matching only apply to short labels; across long
// descriptions they match almost any query.
const FUZZY_TEXT_MAX_LENGTH = 48;

function scoreToken(token: string, text: string): number {
  if (!text) return 0;
  const hay = text.toLowerCase();
  if (hay === token) return 100;
  if (hay.startsWith(token)) return 80;
  const words = hay.split(/[^a-z0-9]+/).filter(Boolean);
  if (words.some((w) => w.startsWith(token))) return 65;
  const at = hay.indexOf(token);
  if (at !== -1) return 50 - Math.min(at, 20) / 2;
  if (hay.length > FUZZY_TEXT_MAX_LENGTH) return 0;

  // Ordered subsequence ("vsdt" -> "VSDAT"), penalised by the gaps it skips.
  let pos = -1;
  let gaps = 0;
  for (const ch of token) {
    const next = hay.indexOf(ch, pos + 1);
    if (next === -1) {
      pos = -2;
      break;
    }
    if (pos >= 0) gaps += next - pos - 1;
    pos = next;
  }
  if (pos !== -2 && token.length >= 2 && gaps <= token.length * 2) {
    return Math.max(10, 35 - gaps * 2);
  }

  // One typo per word for longer tokens ("demographcs", "vitls").
  if (token.length >= 4) {
    const tolerance = token.length >= 7 ? 2 : 1;
    if (
      words.some(
        (w) =>
          Math.abs(w.length - token.length) <= tolerance &&
          getLevenshteinDistance(token, w) <= tolerance
      )
    ) {
      return 20;
    }
  }
  return 0;
}

/**
 * Scores how well a query matches an entry: every whitespace-separated
 * token must match the title, detail, context or keywords, by prefix,
 * substring, ordered subsequence or a small edit distance. Title matches
 * weigh most. A leading `/` is ignored so slash commands match too.
 *
 * @param query - Raw query text.
 * @param entry - The entry to score.
 * @returns 0 for no match, otherwise a positive relevance score.
 */
export function scoreOmnibarEntry(query: string, entry: OmnibarEntry): number {
  const tokens = query
    .trim()
    .toLowerCase()
    .replace(/^\//, "")
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) return 1;

  let total = 0;
  for (const token of tokens) {
    const best = Math.max(
      scoreToken(token, entry.title) * 3,
      scoreToken(token, (entry.detail ?? "").replace(/^\//, "")) * 2.5,
      scoreToken(token, entry.context),
      ...entry.keywords.map((k) => scoreToken(token, k) * 1.5)
    );
    if (best <= 0) return 0;
    total += best;
  }
  return total;
}

/**
 * Searches the omnibar index, ranked by {@link scoreOmnibarEntry}. An empty
 * query returns every entry (optionally of one category) in index order.
 *
 * @param entries - Index from {@link buildStudyOmnibarIndex}.
 * @param query - Raw query text.
 * @param category - Restrict results to one category.
 * @returns Matching entries, best first.
 */
export function searchStudyOmnibar(
  entries: readonly OmnibarEntry[],
  query: string,
  category?: OmnibarCategory
): OmnibarSearchResult[] {
  const scoped = category
    ? entries.filter((e) => e.category === category)
    : entries;
  const results: OmnibarSearchResult[] = [];
  scoped.forEach((entry) => {
    const score = scoreOmnibarEntry(query, entry);
    if (score > 0) results.push({ entry, score });
  });
  return results
    .map((r, i) => ({ r, i }))
    .sort((a, b) => b.r.score - a.r.score || a.i - b.i)
    .map(({ r }) => r);
}

/**
 * Groups ranked results by category. Groups are ordered by their best match
 * (falling back to {@link OMNIBAR_CATEGORY_ORDER}), and each group keeps at
 * most `perCategoryLimit` rows, reporting the rest as `hiddenCount`.
 *
 * @param results - Output of {@link searchStudyOmnibar}.
 * @param perCategoryLimit - Maximum rows per group.
 * @returns Non-empty groups in display order.
 */
export function groupOmnibarResults(
  results: readonly OmnibarSearchResult[],
  perCategoryLimit = Number.POSITIVE_INFINITY
): OmnibarResultGroup[] {
  const byCategory = new Map<OmnibarCategory, OmnibarSearchResult[]>();
  for (const result of results) {
    const list = byCategory.get(result.entry.category) ?? [];
    list.push(result);
    byCategory.set(result.entry.category, list);
  }
  return OMNIBAR_CATEGORY_ORDER.filter((c) => byCategory.has(c))
    .map((category) => {
      const all = byCategory.get(category) ?? [];
      return {
        category,
        label: OMNIBAR_CATEGORY_LABELS[category],
        results: all.slice(0, perCategoryLimit),
        hiddenCount: Math.max(0, all.length - perCategoryLimit),
      };
    })
    .map((group, order) => ({ group, order }))
    .sort(
      (a, b) =>
        (b.group.results[0]?.score ?? 0) - (a.group.results[0]?.score ?? 0) ||
        a.order - b.order
    )
    .map(({ group }) => group);
}
