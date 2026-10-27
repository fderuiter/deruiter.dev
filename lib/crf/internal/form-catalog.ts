/**
 * One catalog of the ready-made content an author can add to a study
 * (#2927 item 11): CDASH domain forms, the forms the study presets ship,
 * the author's saved form templates, and the clinical smart blocks. The
 * studio's single "Add form" surface lists these entries, so each source is
 * reached the same way instead of through its own panel or modal.
 *
 * Forms go into a visit as a new form. Blocks go into the open form, after
 * the selected field, through the same command the slash palette runs.
 */
import { CDASH_DOMAIN_CATALOG } from "./study-engine";
import { scaffoldCdashDomain } from "./cdash-domain-templates";
import {
  captureFormTemplate,
  instantiateFormTemplate,
  type FormTemplate,
} from "./form-templates";
import { STUDY_PRESETS } from "../presets";
import {
  ALL_SLASH_COMMANDS,
  CLINICAL_SMART_BLOCKS,
  type SlashCommandItem,
} from "./smart-blocks-engine";
import type {
  CodelistDefinition,
  CRFField,
  CRFForm,
  StudyProtocol,
} from "../types";

/** Where a catalog entry comes from. */
export type FormCatalogSource = "cdash" | "preset" | "saved" | "block";

/** One ready-made form or block in the catalog. */
export interface FormCatalogEntry {
  /** Stable within a catalog: the source followed by the source's own key. */
  id: string;
  source: FormCatalogSource;
  title: string;
  description: string;
  /** The CDASH or SDTM domain code the entry collects, when it has one. */
  domain?: string;
  fieldCount: number;
  /** Where the entry was found, e.g. "CDASHIG domain" or a preset's name. */
  origin: string;
  /** Forms are added to a visit; blocks are inserted into the open form. */
  target: "visit" | "form";
}

/** Display order and labels for the catalog's source filters. */
export const FORM_CATALOG_SOURCES: readonly {
  source: FormCatalogSource;
  label: string;
}[] = [
  { source: "cdash", label: "CDASH domains" },
  { source: "preset", label: "From example studies" },
  { source: "saved", label: "My templates" },
  { source: "block", label: "Blocks" },
];

type CdashCode = Parameters<typeof scaffoldCdashDomain>[0];

function countFields(fields: readonly CRFField[]): number {
  let total = 0;
  for (const field of fields) {
    total += 1;
    if (field.repeatingColumns) total += countFields(field.repeatingColumns);
  }
  return total;
}

function formFieldCount(form: CRFForm): number {
  return (form.sections || []).reduce(
    (sum, section) => sum + countFields(section.fields || []),
    0
  );
}

/**
 * Forms from the example studies, once each by name. The blank study is
 * left out, and so is any form whose name a CDASH domain entry already
 * offers.
 */
function presetForms() {
  const seen = new Set(
    CDASH_DOMAIN_CATALOG.map((domain) => domain.label.toLowerCase())
  );
  const forms: { presetName: string; form: CRFForm; study: StudyProtocol }[] =
    [];
  for (const preset of STUDY_PRESETS) {
    if (preset.id === "custom_blank") continue;
    for (const form of preset.study.forms) {
      const key = form.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      forms.push({ presetName: preset.name, form, study: preset.study });
    }
  }
  return forms;
}

const PRESET_FORMS = presetForms();

function presetEntryId(form: CRFForm) {
  return `preset:${form.id}`;
}

/**
 * Every catalog entry, in source order: CDASH domains, example-study forms,
 * the author's saved templates, then blocks.
 */
export function buildFormCatalog(
  savedTemplates: readonly FormTemplate[] = []
): FormCatalogEntry[] {
  const cdash = CDASH_DOMAIN_CATALOG.map((domain): FormCatalogEntry => ({
    id: `cdash:${domain.code}`,
    source: "cdash",
    title: domain.label,
    description: domain.description,
    domain: domain.code,
    fieldCount: domain.variableCount,
    origin: "CDASHIG domain",
    target: "visit",
  }));
  const presets = PRESET_FORMS.map(
    ({ presetName, form }): FormCatalogEntry => ({
      id: presetEntryId(form),
      source: "preset",
      title: form.name,
      description: form.description || `A form from ${presetName}.`,
      domain: form.domain,
      fieldCount: formFieldCount(form),
      origin: presetName,
      target: "visit",
    })
  );
  const saved = savedTemplates.map((template): FormCatalogEntry => ({
    id: `saved:${template.id}`,
    source: "saved",
    title: template.name,
    description:
      template.description ||
      `${template.form.sections.length} sections, saved on this device.`,
    domain: template.form.domain,
    fieldCount: formFieldCount(template.form),
    origin: "Saved on this device",
    target: "visit",
  }));
  const blocks = CLINICAL_SMART_BLOCKS.map((block): FormCatalogEntry => ({
    id: `block:${block.id}`,
    source: "block",
    title: block.title,
    description: block.description,
    domain: block.cdashDomain,
    fieldCount: block.variableCount,
    origin: `Smart block ${block.command}`,
    target: "form",
  }));
  return [...cdash, ...presets, ...saved, ...blocks];
}

/**
 * Entries matching every word of the query against the title, description,
 * domain and origin, optionally limited to one source.
 */
export function searchFormCatalog(
  entries: readonly FormCatalogEntry[],
  query: string,
  source?: FormCatalogSource
): FormCatalogEntry[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return entries.filter((entry) => {
    if (source && entry.source !== source) return false;
    const haystack = [
      entry.title,
      entry.description,
      entry.domain,
      entry.origin,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
}

/**
 * An independent copy of a form entry, ready to add to `study`: fresh ids,
 * colliding CDASH variable names renamed, and only the codelists the study
 * lacks. Returns null for a block entry or an id the catalog does not hold.
 */
export function instantiateCatalogForm(
  entryId: string,
  study: StudyProtocol,
  savedTemplates: readonly FormTemplate[] = []
): { form: CRFForm; codelists: CodelistDefinition[] } | null {
  const [source, ...rest] = entryId.split(":");
  const key = rest.join(":");
  if (source === "cdash") {
    if (!CDASH_DOMAIN_CATALOG.some((domain) => domain.code === key)) {
      return null;
    }
    return { form: scaffoldCdashDomain(key as CdashCode), codelists: [] };
  }
  if (source === "preset") {
    const match = PRESET_FORMS.find(
      ({ form }) => presetEntryId(form) === entryId
    );
    if (!match) return null;
    const template = captureFormTemplate({
      form: match.form,
      codelists: match.study.codelists || [],
    });
    return instantiateFormTemplate(template, study);
  }
  if (source === "saved") {
    const template = savedTemplates.find((t) => t.id === key);
    return template ? instantiateFormTemplate(template, study) : null;
  }
  return null;
}

/** The slash command a block entry runs, or null for a form entry. */
export function catalogBlockCommand(entryId: string): SlashCommandItem | null {
  if (!entryId.startsWith("block:")) return null;
  const id = entryId.slice("block:".length);
  return (
    ALL_SLASH_COMMANDS.find(
      (command) => command.id === id && command.action === "insert_smart_block"
    ) ?? null
  );
}
