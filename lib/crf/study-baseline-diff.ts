import type {
  StudyProtocol,
  CRFForm,
  CRFField,
  EditCheckRule,
  StudyVisit,
  StudyArm,
  StudyEpoch,
  StudyCohort,
} from "./types";
import { deterministicStringify } from "./study-draft-storage";

/**
 * The seven areas #676 requires comparisons to cover: fields, rules,
 * formulas (calculationFormula / formulaExpression), codelists, sections,
 * study metadata and schedule relationships (visits, arms, epochs, cohorts).
 */
export type BaselineDiffCategory =
  | "study_metadata"
  | "form"
  | "section"
  | "field"
  | "rule"
  | "formula"
  | "codelist"
  | "schedule";

export type BaselineDiffChangeType = "added" | "removed" | "modified";

export interface BaselineDiffEntry {
  /** Stable identity of the changed object (or a synthetic key for scalar metadata). */
  id: string;
  category: BaselineDiffCategory;
  changeType: BaselineDiffChangeType;
  label: string;
  /** Breadcrumb trail for display, e.g. ["Vitals Signs", "Systolic BP"]. */
  breadcrumb: string[];
  /** Attribute names that differ (only present for "modified" entries). */
  changedFields?: string[];
  oldValue?: unknown;
  newValue?: unknown;
  /**
   * Readable descriptions of dependents (rules, formulas, form assignments)
   * still referencing this object as of the baseline snapshot — preserved
   * even when the object itself was deleted so reviewers keep that context.
   */
  affectedUses?: string[];
  /** Navigation hints so a UI can jump to the changed object. */
  formId?: string;
  sectionId?: string;
  visitId?: string;
  navigationMode?: "designer" | "rules" | "matrix";
}

export interface BaselineDiffCategorySummary {
  added: number;
  removed: number;
  modified: number;
}

export interface BaselineComparisonSummary {
  addedCount: number;
  removedCount: number;
  modifiedCount: number;
  totalChanges: number;
  hasChanges: boolean;
  byCategory: Record<BaselineDiffCategory, BaselineDiffCategorySummary>;
}

export interface BaselineComparisonResult {
  baselineId: string;
  baselineVersionTag: string;
  baselineLabel: string;
  comparedAt: string;
  entries: BaselineDiffEntry[];
  summary: BaselineComparisonSummary;
}

const DIFF_CATEGORIES: BaselineDiffCategory[] = [
  "study_metadata",
  "form",
  "section",
  "field",
  "rule",
  "formula",
  "codelist",
  "schedule",
];

function valuesEqual(a: unknown, b: unknown): boolean {
  return deterministicStringify(a) === deterministicStringify(b);
}

function humanizeKey(key: string): string {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
  return spaced;
}

function norm(value: string | undefined): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

interface MatchResult<T> {
  matched: Array<{ oldItem: T; newItem: T }>;
  removed: T[];
  added: T[];
}

/**
 * Pairs baseline and current items. Items with the same id always pair. In a
 * cross-study comparison, whatever is left over is then paired by the keys
 * `getKeys` returns, strongest key first. A key pairs two items only when it
 * is unique among the leftovers on both sides, so duplicate names never pair
 * by guesswork and the result does not depend on array order.
 */
function matchEntities<T extends { id: string }>(
  baselineItems: readonly T[] | undefined,
  currentItems: readonly T[] | undefined,
  getKeys: (item: T) => string[],
  crossStudy: boolean
): MatchResult<T> {
  const baseline = (baselineItems || []).filter(
    (item) => item && typeof item.id === "string"
  );
  const current = (currentItems || []).filter(
    (item) => item && typeof item.id === "string"
  );

  const currentById = new Map(current.map((item) => [item.id, item]));
  const matched: Array<{ oldItem: T; newItem: T }> = [];
  let unmatchedBaseline: T[] = [];
  for (const oldItem of baseline) {
    const newItem = currentById.get(oldItem.id);
    if (newItem) matched.push({ oldItem, newItem });
    else unmatchedBaseline.push(oldItem);
  }
  const pairedIds = new Set(matched.map((pair) => pair.newItem.id));
  let unmatchedCurrent = current.filter((item) => !pairedIds.has(item.id));

  if (crossStudy) {
    const tiers = Math.max(
      0,
      ...[...unmatchedBaseline, ...unmatchedCurrent].map(
        (item) => getKeys(item).length
      )
    );
    for (let tier = 0; tier < tiers; tier++) {
      const keyOf = (item: T) => getKeys(item)[tier] || "";
      const count = (items: T[]) => {
        const counts = new Map<string, number>();
        for (const item of items) {
          const key = keyOf(item);
          if (key) counts.set(key, (counts.get(key) || 0) + 1);
        }
        return counts;
      };
      const baselineCounts = count(unmatchedBaseline);
      const currentCounts = count(unmatchedCurrent);
      const currentByKey = new Map(
        unmatchedCurrent.map((item) => [keyOf(item), item])
      );
      const usedBaseline = new Set<T>();
      const usedCurrent = new Set<T>();
      for (const oldItem of unmatchedBaseline) {
        const key = keyOf(oldItem);
        if (!key || baselineCounts.get(key) !== 1) continue;
        if (currentCounts.get(key) !== 1) continue;
        const newItem = currentByKey.get(key)!;
        matched.push({ oldItem, newItem });
        usedBaseline.add(oldItem);
        usedCurrent.add(newItem);
      }
      unmatchedBaseline = unmatchedBaseline.filter(
        (item) => !usedBaseline.has(item)
      );
      unmatchedCurrent = unmatchedCurrent.filter(
        (item) => !usedCurrent.has(item)
      );
    }
  }

  return { matched, removed: unmatchedBaseline, added: unmatchedCurrent };
}

/** Properties whose string values are ids of other objects in the same study. */
const REFERENCE_KEYS = new Set([
  "codelistId",
  "targetFieldId",
  "triggerFieldIds",
  "fieldId",
  "compareFieldId",
  "assignedFormIds",
  "formIds",
  "epochId",
  "epochIds",
  "armIds",
]);

/**
 * A copy of the study in which every id reference is replaced by the name of
 * what it points at, so two studies whose ids differ compare by meaning. The
 * `id` properties themselves are left alone: they still identify objects.
 */
function relabelReferences(study: StudyProtocol): StudyProtocol {
  const labels = new Map<string, string>();
  const note = (id: string | undefined, label: string) => {
    if (typeof id === "string" && id) labels.set(id, label);
  };
  for (const codelist of study.codelists || [])
    note(codelist.id, `codelist:${codelist.name}`);
  for (const form of study.forms || []) {
    note(form.id, `form:${form.name}`);
    for (const section of form.sections || []) {
      const walk = (fields: CRFField[]) => {
        for (const field of fields || []) {
          note(field.id, `field:${field.variableName}`);
          walk(field.repeatingColumns || []);
        }
      };
      walk(section.fields || []);
    }
  }
  for (const epoch of study.epochs || []) note(epoch.id, `epoch:${epoch.name}`);
  for (const arm of study.arms || []) note(arm.id, `arm:${arm.name}`);

  const walk = (value: unknown, referenceContext: boolean): unknown => {
    if (typeof value === "string") {
      return referenceContext ? (labels.get(value) ?? value) : value;
    }
    if (Array.isArray(value))
      return value.map((v) => walk(v, referenceContext));
    if (value && typeof value === "object") {
      const out: Record<string, unknown> = {};
      for (const [key, inner] of Object.entries(value)) {
        if (
          key === "armFormAssignments" &&
          inner &&
          typeof inner === "object"
        ) {
          // Keyed by arm id, valued by form ids.
          out[key] = Object.fromEntries(
            Object.entries(inner).map(([armId, formIds]) => [
              labels.get(armId) ?? armId,
              walk(formIds, true),
            ])
          );
        } else {
          out[key] = walk(inner, key !== "id" && REFERENCE_KEYS.has(key));
        }
      }
      return out;
    }
    return value;
  };
  return walk(study, false) as StudyProtocol;
}

function diffKeys<T extends Record<string, unknown>>(
  oldObj: T,
  newObj: T,
  keys: readonly (keyof T & string)[]
): string[] {
  const changed: string[] = [];
  for (const key of keys) {
    if (!valuesEqual(oldObj[key], newObj[key])) changed.push(key);
  }
  return changed;
}

function pickChanged<T extends Record<string, unknown>>(
  obj: T,
  keys: readonly string[]
): Partial<T> {
  const picked: Partial<T> = {};
  for (const key of keys) {
    picked[key as keyof T] = obj[key as keyof T];
  }
  return picked;
}

interface DependencyIndex {
  /** fieldId -> readable labels of rules referencing it */
  fieldToRules: Map<string, Set<string>>;
  /** codelistId -> readable labels of fields using it */
  codelistToFields: Map<string, Set<string>>;
  /** formId -> readable labels of visits assigning it */
  formToVisits: Map<string, Set<string>>;
}

function buildDependencyIndex(study: StudyProtocol): DependencyIndex {
  const fieldToRules = new Map<string, Set<string>>();
  const codelistToFields = new Map<string, Set<string>>();
  const formToVisits = new Map<string, Set<string>>();

  const addTo = (
    map: Map<string, Set<string>>,
    key: string | undefined,
    label: string
  ) => {
    if (!key) return;
    if (!map.has(key)) map.set(key, new Set());
    map.get(key)!.add(label);
  };

  const registerRule = (rule: EditCheckRule) => {
    const label = `rule "${rule.name || rule.id}"`;
    addTo(fieldToRules, rule.targetFieldId, label);
    for (const fid of rule.triggerFieldIds || [])
      addTo(fieldToRules, fid, label);
    for (const cond of rule.conditions || []) {
      addTo(fieldToRules, cond.fieldId, label);
      addTo(fieldToRules, cond.compareFieldId, label);
    }
    for (const group of rule.conditionGroups || []) {
      for (const cond of group.conditions || []) {
        addTo(fieldToRules, cond.fieldId, label);
        addTo(fieldToRules, cond.compareFieldId, label);
      }
    }
  };

  for (const rule of study.rules || []) registerRule(rule);
  for (const form of study.forms || []) {
    for (const rule of form.rules || []) registerRule(rule);
    for (const section of form.sections || []) {
      for (const field of section.fields || []) {
        if (field.codelistId) {
          addTo(
            codelistToFields,
            field.codelistId,
            `field "${field.label || field.variableName}"`
          );
        }
      }
    }
  }

  for (const visit of study.visits || []) {
    const formIds = new Set([
      ...(visit.assignedFormIds || []),
      ...(visit.formIds || []),
    ]);
    for (const formId of formIds) {
      addTo(formToVisits, formId, `visit "${visit.name}"`);
    }
  }

  return { fieldToRules, codelistToFields, formToVisits };
}

const FORM_SCALAR_KEYS = [
  "name",
  "domain",
  "description",
  "version",
  "isLogForm",
  "isLocked",
  "lockedBy",
] as const;

const SECTION_SCALAR_KEYS = [
  "title",
  "description",
  "collapsible",
  "isRepeating",
] as const;

const FIELD_STRUCTURAL_KEYS = [
  "variableName",
  "label",
  "description",
  "dataType",
  "columnSpan",
  "required",
  "readOnly",
  "placeholder",
  "unit",
  "unitOptions",
  "minValue",
  "maxValue",
  "defaultValue",
  "codelistId",
  "customOptions",
  "cdashMetadata",
  "repeatingColumns",
  "scaleMinLabel",
  "scaleMaxLabel",
  "allowPartial",
  "preventFutureDate",
  "allowNullFlavor",
  "requirementTier",
  "requiresSdv",
  "isBlinded",
  "nullFlavorValue",
] as const;

const RULE_STRUCTURAL_KEYS = [
  "name",
  "description",
  "triggerFieldIds",
  "actionType",
  "targetFieldId",
  "conditions",
  "logicalOperator",
  "conditionGroups",
  "groupLogicalOperator",
  "querySeverity",
  "queryMessage",
  "unsupportedExpression",
] as const;

const CODELIST_SCALAR_KEYS = ["name", "nciCodelistCode", "isStandard"] as const;

const VISIT_SCALAR_KEYS = [
  "oid",
  "name",
  "visitType",
  "targetDay",
  "timepointDays",
  "windowBefore",
  "windowAfter",
  "assignedFormIds",
  "formIds",
  "isRepeating",
  "repeatMax",
  "epochId",
  "armIds",
  "armFormAssignments",
] as const;

const ARM_SCALAR_KEYS = ["name", "type", "description", "epochIds"] as const;
const EPOCH_SCALAR_KEYS = [
  "name",
  "sequenceNumber",
  "type",
  "description",
] as const;
const COHORT_SCALAR_KEYS = [
  "name",
  "description",
  "armIds",
  "targetSize",
] as const;

const STUDY_METADATA_KEYS = [
  "protocolNumber",
  "studyName",
  "title",
  "phase",
  "sponsor",
  "therapeuticArea",
  "version",
] as const;

function diffStudyMetadata(
  baseline: StudyProtocol,
  current: StudyProtocol
): BaselineDiffEntry[] {
  const entries: BaselineDiffEntry[] = [];
  for (const key of STUDY_METADATA_KEYS) {
    if (!valuesEqual(baseline[key], current[key])) {
      entries.push({
        id: `study_metadata:${key}`,
        category: "study_metadata",
        changeType: "modified",
        label: humanizeKey(key),
        breadcrumb: ["Study Metadata", humanizeKey(key)],
        changedFields: [key],
        oldValue: baseline[key],
        newValue: current[key],
      });
    }
  }
  return entries;
}

function diffRuleList(
  baselineRules: EditCheckRule[] | undefined,
  currentRules: EditCheckRule[] | undefined,
  breadcrumbPrefix: string[],
  form: CRFForm | undefined,
  depIndex: DependencyIndex,
  crossStudy: boolean = false
): BaselineDiffEntry[] {
  const entries: BaselineDiffEntry[] = [];
  const { matched, removed, added } = matchEntities(
    baselineRules,
    currentRules,
    (rule) => [rule.name ? `name:${norm(rule.name)}` : ""],
    crossStudy
  );

  for (const rule of removed) {
    const id = rule.id;
    const affectedUses = Array.from(depIndex.fieldToRules.entries())
      .filter(([, labels]) => labels.has(`rule "${rule.name || rule.id}"`))
      .map(([fieldId]) => fieldId);
    entries.push({
      id,
      category: "rule",
      changeType: "removed",
      label: rule.name || rule.id,
      breadcrumb: [...breadcrumbPrefix, rule.name || rule.id],
      oldValue: rule,
      affectedUses: affectedUses.length
        ? [`Referenced field id(s): ${affectedUses.join(", ")}`]
        : undefined,
      formId: form?.id,
      navigationMode: "rules",
    });
    if (rule.formulaExpression) {
      entries.push({
        id: `formula:rule:${id}`,
        category: "formula",
        changeType: "removed",
        label: `${rule.name || rule.id}: Formula`,
        breadcrumb: [...breadcrumbPrefix, rule.name || rule.id, "Formula"],
        oldValue: rule.formulaExpression,
        formId: form?.id,
        navigationMode: "rules",
      });
    }
  }

  for (const rule of added) {
    const id = rule.id;
    entries.push({
      id,
      category: "rule",
      changeType: "added",
      label: rule.name || rule.id,
      breadcrumb: [...breadcrumbPrefix, rule.name || rule.id],
      newValue: rule,
      formId: form?.id,
      navigationMode: "rules",
    });
    if (rule.formulaExpression) {
      entries.push({
        id: `formula:rule:${id}`,
        category: "formula",
        changeType: "added",
        label: `${rule.name || rule.id}: Formula`,
        breadcrumb: [...breadcrumbPrefix, rule.name || rule.id, "Formula"],
        newValue: rule.formulaExpression,
        formId: form?.id,
        navigationMode: "rules",
      });
    }
  }

  for (const { oldItem: oldRule, newItem: newRule } of matched) {
    const id = newRule.id;
    const changed = diffKeys(
      oldRule as unknown as Record<string, unknown>,
      newRule as unknown as Record<string, unknown>,
      RULE_STRUCTURAL_KEYS
    );
    if (changed.length) {
      entries.push({
        id,
        category: "rule",
        changeType: "modified",
        label: newRule.name || id,
        breadcrumb: [...breadcrumbPrefix, newRule.name || id],
        changedFields: changed,
        oldValue: pickChanged(
          oldRule as unknown as Record<string, unknown>,
          changed
        ),
        newValue: pickChanged(
          newRule as unknown as Record<string, unknown>,
          changed
        ),
        formId: form?.id,
        navigationMode: "rules",
      });
    }

    if (!valuesEqual(oldRule.formulaExpression, newRule.formulaExpression)) {
      entries.push({
        id: `formula:rule:${id}`,
        category: "formula",
        changeType: "modified",
        label: `${newRule.name || id}: Formula`,
        breadcrumb: [...breadcrumbPrefix, newRule.name || id, "Formula"],
        oldValue: oldRule.formulaExpression,
        newValue: newRule.formulaExpression,
        formId: form?.id,
        navigationMode: "rules",
      });
    }
  }

  return entries;
}

interface FieldOccurrence {
  id: string;
  field: CRFField;
  sectionId: string;
  sectionTitle: string;
}

function collectFieldOccurrences(form: CRFForm): FieldOccurrence[] {
  const list: FieldOccurrence[] = [];
  for (const section of form.sections || []) {
    for (const field of section.fields || []) {
      list.push({
        id: field.id,
        field,
        sectionId: section.id,
        sectionTitle: section.title,
      });
    }
  }
  return list;
}

function diffFieldsWithinForm(
  form: CRFForm,
  baselineFieldsList: FieldOccurrence[],
  currentFieldsList: FieldOccurrence[],
  depIndex: DependencyIndex,
  crossStudy: boolean = false
): BaselineDiffEntry[] {
  const entries: BaselineDiffEntry[] = [];

  const { matched, removed, added } = matchEntities(
    baselineFieldsList,
    currentFieldsList,
    (occ) => [
      occ.field.variableName
        ? `var:${occ.field.variableName.toUpperCase()}`
        : "",
      occ.field.cdashMetadata?.sdtmVariable
        ? `sdtm:${occ.field.cdashMetadata.sdtmVariable.toUpperCase()}`
        : "",
    ],
    crossStudy
  );

  for (const occurrence of removed) {
    const uses = depIndex.fieldToRules.get(occurrence.id);
    entries.push({
      id: occurrence.id,
      category: "field",
      changeType: "removed",
      label: occurrence.field.label || occurrence.field.variableName,
      breadcrumb: [form.name, occurrence.sectionTitle, occurrence.field.label],
      oldValue: occurrence.field,
      affectedUses: uses ? Array.from(uses) : undefined,
      formId: form.id,
      sectionId: occurrence.sectionId,
      navigationMode: "designer",
    });
    if (occurrence.field.calculationFormula) {
      entries.push({
        id: `formula:field:${occurrence.id}`,
        category: "formula",
        changeType: "removed",
        label: `${occurrence.field.label}: Formula`,
        breadcrumb: [
          form.name,
          occurrence.sectionTitle,
          occurrence.field.label,
          "Formula",
        ],
        oldValue: occurrence.field.calculationFormula,
        formId: form.id,
        sectionId: occurrence.sectionId,
        navigationMode: "designer",
      });
    }
  }

  for (const occurrence of added) {
    entries.push({
      id: occurrence.id,
      category: "field",
      changeType: "added",
      label: occurrence.field.label || occurrence.field.variableName,
      breadcrumb: [form.name, occurrence.sectionTitle, occurrence.field.label],
      newValue: occurrence.field,
      formId: form.id,
      sectionId: occurrence.sectionId,
      navigationMode: "designer",
    });
    if (occurrence.field.calculationFormula) {
      entries.push({
        id: `formula:field:${occurrence.id}`,
        category: "formula",
        changeType: "added",
        label: `${occurrence.field.label}: Formula`,
        breadcrumb: [
          form.name,
          occurrence.sectionTitle,
          occurrence.field.label,
          "Formula",
        ],
        newValue: occurrence.field.calculationFormula,
        formId: form.id,
        sectionId: occurrence.sectionId,
        navigationMode: "designer",
      });
    }
  }

  for (const { oldItem: oldOcc, newItem: newOcc } of matched) {
    const id = newOcc.id;
    const changed = diffKeys(
      oldOcc.field as unknown as Record<string, unknown>,
      newOcc.field as unknown as Record<string, unknown>,
      FIELD_STRUCTURAL_KEYS
    );
    // Section ids mean nothing across studies, so compare titles there.
    const moved = crossStudy
      ? norm(oldOcc.sectionTitle) !== norm(newOcc.sectionTitle)
      : oldOcc.sectionId !== newOcc.sectionId;
    if (moved) changed.push("section");

    if (changed.length) {
      const oldValue = pickChanged(
        oldOcc.field as unknown as Record<string, unknown>,
        changed.filter((k) => k !== "section")
      );
      const newValue = pickChanged(
        newOcc.field as unknown as Record<string, unknown>,
        changed.filter((k) => k !== "section")
      );
      if (moved) {
        oldValue.section = oldOcc.sectionTitle;
        newValue.section = newOcc.sectionTitle;
      }

      entries.push({
        id,
        category: "field",
        changeType: "modified",
        label: newOcc.field.label || newOcc.field.variableName,
        breadcrumb: [form.name, newOcc.sectionTitle, newOcc.field.label],
        changedFields: changed,
        oldValue,
        newValue,
        formId: form.id,
        sectionId: newOcc.sectionId,
        navigationMode: "designer",
      });
    }

    if (
      !valuesEqual(
        oldOcc.field.calculationFormula,
        newOcc.field.calculationFormula
      )
    ) {
      entries.push({
        id: `formula:field:${id}`,
        category: "formula",
        changeType: "modified",
        label: `${newOcc.field.label}: Formula`,
        breadcrumb: [
          form.name,
          newOcc.sectionTitle,
          newOcc.field.label,
          "Formula",
        ],
        oldValue: oldOcc.field.calculationFormula,
        newValue: newOcc.field.calculationFormula,
        formId: form.id,
        sectionId: newOcc.sectionId,
        navigationMode: "designer",
      });
    }
  }

  return entries;
}

function diffSectionsWithinForm(
  form: CRFForm,
  baselineForm: CRFForm,
  crossStudy: boolean = false
): BaselineDiffEntry[] {
  const entries: BaselineDiffEntry[] = [];
  const { matched, removed, added } = matchEntities(
    baselineForm.sections,
    form.sections,
    (sec) => [norm(sec.title) ? `title:${norm(sec.title)}` : ""],
    crossStudy
  );

  for (const section of removed) {
    entries.push({
      id: section.id,
      category: "section",
      changeType: "removed",
      label: section.title,
      breadcrumb: [baselineForm.name, section.title],
      oldValue: section,
      formId: baselineForm.id,
      sectionId: section.id,
      navigationMode: "designer",
    });
  }

  for (const section of added) {
    entries.push({
      id: section.id,
      category: "section",
      changeType: "added",
      label: section.title,
      breadcrumb: [form.name, section.title],
      newValue: section,
      formId: form.id,
      sectionId: section.id,
      navigationMode: "designer",
    });
  }

  for (const { oldItem: oldSection, newItem: newSection } of matched) {
    const id = newSection.id;
    const changed = diffKeys(
      oldSection as unknown as Record<string, unknown>,
      newSection as unknown as Record<string, unknown>,
      SECTION_SCALAR_KEYS
    );
    if (changed.length) {
      entries.push({
        id,
        category: "section",
        changeType: "modified",
        label: newSection.title,
        breadcrumb: [form.name, newSection.title],
        changedFields: changed,
        oldValue: pickChanged(
          oldSection as unknown as Record<string, unknown>,
          changed
        ),
        newValue: pickChanged(
          newSection as unknown as Record<string, unknown>,
          changed
        ),
        formId: form.id,
        sectionId: id,
        navigationMode: "designer",
      });
    }
  }

  return entries;
}

function diffForms(
  baseline: StudyProtocol,
  current: StudyProtocol,
  depIndex: DependencyIndex,
  crossStudy: boolean = false
): BaselineDiffEntry[] {
  const entries: BaselineDiffEntry[] = [];
  const { matched, removed, added } = matchEntities(
    baseline.forms,
    current.forms,
    (form) => {
      const oid = (form as unknown as { oid?: string }).oid;
      return [
        oid ? `oid:${oid.toUpperCase()}` : "",
        form.domain && form.name
          ? `domain_name:${form.domain.toUpperCase()}:${norm(form.name)}`
          : "",
        form.name ? `name:${norm(form.name)}` : "",
      ];
    },
    crossStudy
  );

  for (const form of removed) {
    const id = form.id;
    const uses = depIndex.formToVisits.get(id);
    entries.push({
      id,
      category: "form",
      changeType: "removed",
      label: form.name,
      breadcrumb: [form.name],
      oldValue: pickChanged(form as unknown as Record<string, unknown>, [
        ...FORM_SCALAR_KEYS,
      ]),
      affectedUses: uses ? Array.from(uses) : undefined,
      formId: id,
      navigationMode: "designer",
    });
  }

  for (const form of added) {
    const id = form.id;
    entries.push({
      id,
      category: "form",
      changeType: "added",
      label: form.name,
      breadcrumb: [form.name],
      newValue: pickChanged(form as unknown as Record<string, unknown>, [
        ...FORM_SCALAR_KEYS,
      ]),
      formId: id,
      navigationMode: "designer",
    });
  }

  for (const { oldItem: oldForm, newItem: newForm } of matched) {
    const id = newForm.id;
    const changed = diffKeys(
      oldForm as unknown as Record<string, unknown>,
      newForm as unknown as Record<string, unknown>,
      FORM_SCALAR_KEYS
    );
    if (changed.length) {
      entries.push({
        id,
        category: "form",
        changeType: "modified",
        label: newForm.name,
        breadcrumb: [newForm.name],
        changedFields: changed,
        oldValue: pickChanged(
          oldForm as unknown as Record<string, unknown>,
          changed
        ),
        newValue: pickChanged(
          newForm as unknown as Record<string, unknown>,
          changed
        ),
        formId: id,
        navigationMode: "designer",
      });
    }

    entries.push(...diffSectionsWithinForm(newForm, oldForm, crossStudy));

    const baselineFieldOccurrences = collectFieldOccurrences(oldForm);
    const currentFieldOccurrences = collectFieldOccurrences(newForm);
    entries.push(
      ...diffFieldsWithinForm(
        newForm,
        baselineFieldOccurrences,
        currentFieldOccurrences,
        depIndex,
        crossStudy
      )
    );

    entries.push(
      ...diffRuleList(
        oldForm.rules,
        newForm.rules,
        [newForm.name, "Rules"],
        newForm,
        depIndex,
        crossStudy
      )
    );
  }

  return entries;
}

function diffCodelists(
  baseline: StudyProtocol,
  current: StudyProtocol,
  depIndex: DependencyIndex,
  crossStudy: boolean = false
): BaselineDiffEntry[] {
  const entries: BaselineDiffEntry[] = [];
  const { matched, removed, added } = matchEntities(
    baseline.codelists,
    current.codelists,
    (cl) => [
      cl.nciCodelistCode ? `nci:${cl.nciCodelistCode.toUpperCase()}` : "",
      norm(cl.name) ? `name:${norm(cl.name)}` : "",
    ],
    crossStudy
  );

  for (const codelist of removed) {
    const id = codelist.id;
    const uses = depIndex.codelistToFields.get(id);
    entries.push({
      id,
      category: "codelist",
      changeType: "removed",
      label: codelist.name,
      breadcrumb: ["Codelists", codelist.name],
      oldValue: codelist,
      affectedUses: uses ? Array.from(uses) : undefined,
    });
  }

  for (const codelist of added) {
    const id = codelist.id;
    entries.push({
      id,
      category: "codelist",
      changeType: "added",
      label: codelist.name,
      breadcrumb: ["Codelists", codelist.name],
      newValue: codelist,
    });
  }

  for (const { oldItem: oldCodelist, newItem: newCodelist } of matched) {
    const id = newCodelist.id;
    const changed = diffKeys(
      oldCodelist as unknown as Record<string, unknown>,
      newCodelist as unknown as Record<string, unknown>,
      CODELIST_SCALAR_KEYS
    );
    if (!valuesEqual(oldCodelist.options, newCodelist.options)) {
      changed.push("options");
    }
    if (changed.length) {
      entries.push({
        id,
        category: "codelist",
        changeType: "modified",
        label: newCodelist.name,
        breadcrumb: ["Codelists", newCodelist.name],
        changedFields: changed,
        oldValue: pickChanged(
          oldCodelist as unknown as Record<string, unknown>,
          changed
        ),
        newValue: pickChanged(
          newCodelist as unknown as Record<string, unknown>,
          changed
        ),
      });
    }
  }

  return entries;
}

function diffScheduleEntity<T extends { id: string; name: string }>(
  baselineItems: readonly T[] | undefined,
  currentItems: readonly T[] | undefined,
  scalarKeys: readonly (keyof T & string)[],
  breadcrumbLabel: string,
  crossStudy: boolean = false
): BaselineDiffEntry[] {
  const entries: BaselineDiffEntry[] = [];
  const { matched, removed, added } = matchEntities(
    baselineItems,
    currentItems,
    (item) => [
      (item as { oid?: string }).oid
        ? `oid:${(item as { oid?: string }).oid!.toUpperCase()}`
        : "",
      norm(item.name) ? `name:${norm(item.name)}` : "",
    ],
    crossStudy
  );

  for (const item of removed) {
    const id = item.id;
    entries.push({
      id,
      category: "schedule",
      changeType: "removed",
      label: item.name,
      breadcrumb: ["Schedule", breadcrumbLabel, item.name],
      oldValue: item,
      visitId: breadcrumbLabel === "Visits" ? id : undefined,
      navigationMode: "matrix",
    });
  }

  for (const item of added) {
    const id = item.id;
    entries.push({
      id,
      category: "schedule",
      changeType: "added",
      label: item.name,
      breadcrumb: ["Schedule", breadcrumbLabel, item.name],
      newValue: item,
      visitId: breadcrumbLabel === "Visits" ? id : undefined,
      navigationMode: "matrix",
    });
  }

  for (const { oldItem, newItem } of matched) {
    const id = newItem.id;
    const changed = diffKeys(
      oldItem as unknown as Record<string, unknown>,
      newItem as unknown as Record<string, unknown>,
      scalarKeys as readonly string[]
    );
    if (changed.length) {
      entries.push({
        id,
        category: "schedule",
        changeType: "modified",
        label: newItem.name,
        breadcrumb: ["Schedule", breadcrumbLabel, newItem.name],
        changedFields: changed,
        oldValue: pickChanged(
          oldItem as unknown as Record<string, unknown>,
          changed
        ),
        newValue: pickChanged(
          newItem as unknown as Record<string, unknown>,
          changed
        ),
        visitId: breadcrumbLabel === "Visits" ? id : undefined,
        navigationMode: "matrix",
      });
    }
  }

  return entries;
}

function diffSchedule(
  baseline: StudyProtocol,
  current: StudyProtocol,
  crossStudy: boolean = false
): BaselineDiffEntry[] {
  return [
    ...diffScheduleEntity<StudyVisit>(
      baseline.visits,
      current.visits,
      VISIT_SCALAR_KEYS,
      "Visits",
      crossStudy
    ),
    ...diffScheduleEntity<StudyArm>(
      baseline.arms,
      current.arms,
      ARM_SCALAR_KEYS,
      "Arms",
      crossStudy
    ),
    ...diffScheduleEntity<StudyEpoch>(
      baseline.epochs,
      current.epochs,
      EPOCH_SCALAR_KEYS,
      "Epochs",
      crossStudy
    ),
    ...diffScheduleEntity<StudyCohort>(
      baseline.cohorts,
      current.cohorts,
      COHORT_SCALAR_KEYS,
      "Cohorts",
      crossStudy
    ),
  ];
}

function summarize(entries: BaselineDiffEntry[]): BaselineComparisonSummary {
  const byCategory = Object.fromEntries(
    DIFF_CATEGORIES.map((category) => [
      category,
      { added: 0, removed: 0, modified: 0 },
    ])
  ) as Record<BaselineDiffCategory, BaselineDiffCategorySummary>;

  let addedCount = 0;
  let removedCount = 0;
  let modifiedCount = 0;

  for (const entry of entries) {
    byCategory[entry.category][entry.changeType]++;
    if (entry.changeType === "added") addedCount++;
    else if (entry.changeType === "removed") removedCount++;
    else modifiedCount++;
  }

  return {
    addedCount,
    removedCount,
    modifiedCount,
    totalChanges: entries.length,
    hasChanges: entries.length > 0,
    byCategory,
  };
}

/**
 * Compares the current working draft against another study snapshot.
 *
 * Within one study every object is matched by its stable id (never by array
 * position), so reorders never masquerade as adds/removes, and a same-id
 * rename or move is a single "modified" entry. When the two studies have
 * different ids (or `options.crossStudy` is set), ids mean nothing across
 * them, so objects that do not share an id are paired by name instead
 * (form OID, domain and name, variable name, section title, NCI code) when
 * the name is unambiguous, and id references compare by what they point at.
 */
export function compareStudyToBaseline(
  current: StudyProtocol,
  baselineStudy: StudyProtocol,
  baselineMeta: { id: string; versionTag: string; label: string },
  options?: { crossStudy?: boolean }
): BaselineComparisonResult {
  const crossStudy = options?.crossStudy ?? current.id !== baselineStudy.id;
  // Affected-use lookups are by the baseline's own ids.
  const depIndex = buildDependencyIndex(baselineStudy);
  const baselineView = crossStudy
    ? relabelReferences(baselineStudy)
    : baselineStudy;
  const currentView = crossStudy ? relabelReferences(current) : current;

  const entries: BaselineDiffEntry[] = [
    ...diffStudyMetadata(baselineView, currentView),
    ...diffForms(baselineView, currentView, depIndex, crossStudy),
    ...diffCodelists(baselineView, currentView, depIndex, crossStudy),
    ...diffSchedule(baselineView, currentView, crossStudy),
  ];

  return {
    baselineId: baselineMeta.id,
    baselineVersionTag: baselineMeta.versionTag,
    baselineLabel: baselineMeta.label,
    comparedAt: new Date().toISOString(),
    entries,
    summary: summarize(entries),
  };
}

/** Human-readable, color-independent label for a change type (a11y text equivalent). */
export function describeBaselineDiffChangeType(
  changeType: BaselineDiffChangeType
): string {
  switch (changeType) {
    case "added":
      return "Added";
    case "removed":
      return "Removed";
    case "modified":
      return "Modified";
  }
}

/** Human-readable label for a diff category, used in grouped UI headers. */
export function describeBaselineDiffCategory(
  category: BaselineDiffCategory
): string {
  switch (category) {
    case "study_metadata":
      return "Study Metadata";
    case "form":
      return "Forms";
    case "section":
      return "Sections";
    case "field":
      return "Fields";
    case "rule":
      return "Edit Check Rules";
    case "formula":
      return "Formulas";
    case "codelist":
      return "Codelists";
    case "schedule":
      return "Schedule Relationships";
  }
}
