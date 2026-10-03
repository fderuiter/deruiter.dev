/**
 * Explicit variants of a shared form (#675).
 *
 * A form in the study protocol is a single shared definition: every visit
 * (and every arm-specific visit assignment) that lists its id collects the
 * same fields and rules, so an ordinary edit changes all of those uses at
 * once. When one schedule genuinely needs a different form, the author
 * creates an explicit variant: a copy of the form with fresh nested
 * identities, reassigned to the selected uses only.
 *
 * The model is copy-and-reassign. A variant keeps no link to its source,
 * nothing is inherited, and no later edit propagates between the two.
 */

import type {
  AstCondition,
  CRFField,
  CRFForm,
  EditCheckRule,
  StudyProtocol,
  StudyVisit,
} from "./types";
import { generateEngineId } from "./precision-date";
import { cloneDeep } from "../utils";
import { appendProtocolAuditEntry, type ActorContext } from "./study-engine";

/**
 * How a visit schedule reaches a form.
 *
 * - `visit_default`: the visit's own `assignedFormIds` (or legacy `formIds`)
 *   list it. Arms without their own assignment for the visit follow this list.
 * - `arm_override`: the visit's arm-specific assignment for one arm lists it.
 * - `arm_inherited`: an arm applicable to the visit has no arm-specific
 *   assignment there, so it collects the form through the visit default.
 */
export type FormUseKind = "visit_default" | "arm_override" | "arm_inherited";

/** One current use of a form in the schedule of activities. */
export interface FormUse {
  /** Stable selection key, see {@link formUseKey}. */
  key: string;
  kind: FormUseKind;
  visitId: string;
  visitName: string;
  targetDay: number;
  /** Set for arm-scoped uses. */
  armId?: string;
  armName?: string;
}

/** What a variant transaction would do to one current use. */
export type FormUseOutcome = "moves_to_variant" | "stays_on_source";

/** Previewed effect of a variant transaction on one current use. */
export interface FormVariantUseChange {
  use: FormUse;
  outcome: FormUseOutcome;
  /**
   * True when keeping this outcome requires writing a new arm-specific
   * assignment for the visit, because the arm used to follow the visit
   * default and the default is changing differently from the arm.
   */
  createsArmAssignment: boolean;
}

/** Options for previewing or creating a form variant. */
export interface FormVariantOptions {
  /** Keys of the uses to move onto the variant, from {@link getFormUses}. */
  selectedUseKeys: string[];
  /** Name of the variant form. Defaults to the source name plus " (Variant)". */
  variantName?: string;
  /** Who performs the change, recorded on the protocol audit trail. */
  actor?: ActorContext;
}

/** Previewed variant transaction, computed without changing the study. */
export interface FormVariantPreview {
  sourceFormId: string;
  sourceFormName: string;
  variantName: string;
  /** Every current use of the source form. */
  uses: FormUse[];
  /** One entry per current use, in the same order as `uses`. */
  changes: FormVariantUseChange[];
  movedCount: number;
  remainingCount: number;
  /** Set when the transaction cannot be committed as previewed. */
  error?: string;
}

/** Where a rule or formula refers to a field. */
export type FormReferenceLocation =
  | "rule_target"
  | "rule_trigger"
  | "rule_condition"
  | "rule_compare"
  | "rule_formula"
  | "field_formula";

/** A field reference inside a form that does not resolve. */
export interface FormReferenceIssue {
  location: FormReferenceLocation;
  /** The rule or field that holds the reference. */
  ownerId: string;
  /** The unresolved field id or variable name. */
  reference: string;
}

/** Result of {@link createFormVariant}. */
export interface FormVariantResult {
  /** The committed study, or the unchanged input when `error` is set. */
  study: StudyProtocol;
  variant?: CRFForm;
  preview: FormVariantPreview;
  /** Maps every source identity (form, section, field, rule, group) to its variant identity. */
  identityMap?: Record<string, string>;
  /**
   * Reverts this transaction on a later study: removes the variant, prunes
   * any remaining assignment of it, and restores the touched visits'
   * original assignments.
   */
  undo?: (currentStudy: StudyProtocol) => StudyProtocol;
  error?: string;
}

const KEY_SEPARATOR = "::";

/** Builds the selection key for a visit default use or an arm-scoped use. */
export function formUseKey(visitId: string, armId?: string): string {
  return armId ? `${visitId}${KEY_SEPARATOR}${armId}` : visitId;
}

function visitDefaultIncludes(visit: StudyVisit, formId: string): boolean {
  return (
    (visit.assignedFormIds || []).includes(formId) ||
    (visit.formIds || []).includes(formId)
  );
}

function applicableArmIds(study: StudyProtocol, visit: StudyVisit): string[] {
  const studyArmIds = (study.arms || []).map((a) => a.id);
  const ids = new Set<string>(
    visit.armIds && visit.armIds.length > 0 ? visit.armIds : studyArmIds
  );
  for (const armId of Object.keys(visit.armFormAssignments || {})) {
    ids.add(armId);
  }
  return Array.from(ids);
}

/**
 * Lists every current use of a form across the schedule of activities,
 * in visit order: the visit default first, then each arm.
 */
export function getFormUses(study: StudyProtocol, formId: string): FormUse[] {
  const armNames = new Map((study.arms || []).map((a) => [a.id, a.name]));
  const uses: FormUse[] = [];

  for (const visit of study.visits || []) {
    const inDefault = visitDefaultIncludes(visit, formId);
    const base = {
      visitId: visit.id,
      visitName: visit.name,
      targetDay: visit.targetDay,
    };
    if (inDefault) {
      uses.push({ ...base, key: formUseKey(visit.id), kind: "visit_default" });
    }
    for (const armId of applicableArmIds(study, visit)) {
      const override = visit.armFormAssignments?.[armId];
      const armName = armNames.get(armId) || armId;
      if (override) {
        if (override.includes(formId)) {
          uses.push({
            ...base,
            key: formUseKey(visit.id, armId),
            kind: "arm_override",
            armId,
            armName,
          });
        }
      } else if (inDefault) {
        uses.push({
          ...base,
          key: formUseKey(visit.id, armId),
          kind: "arm_inherited",
          armId,
          armName,
        });
      }
    }
  }
  return uses;
}

function computeChanges(
  uses: FormUse[],
  selected: Set<string>
): FormVariantUseChange[] {
  return uses.map((use) => {
    const moves = selected.has(use.key);
    let createsArmAssignment = false;
    if (use.kind === "arm_inherited") {
      const defaultMoves = selected.has(formUseKey(use.visitId));
      createsArmAssignment = moves !== defaultMoves;
    }
    return {
      use,
      outcome: moves ? "moves_to_variant" : "stays_on_source",
      createsArmAssignment,
    };
  });
}

/**
 * Previews a variant transaction: which uses move to the variant, which stay
 * on the shared form, and which need a new arm-specific assignment. Pure.
 */
export function previewFormVariant(
  study: StudyProtocol,
  sourceFormId: string,
  options: FormVariantOptions
): FormVariantPreview {
  const source = study.forms.find((f) => f.id === sourceFormId);
  const uses = source ? getFormUses(study, source.id) : [];
  const selected = new Set(options.selectedUseKeys);
  const changes = computeChanges(uses, selected);
  const movedCount = changes.filter(
    (c) => c.outcome === "moves_to_variant"
  ).length;
  const variantName = (
    options.variantName ?? `${source?.name ?? "Form"} (Variant)`
  ).trim();

  const preview: FormVariantPreview = {
    sourceFormId,
    sourceFormName: source?.name ?? "",
    variantName,
    uses,
    changes,
    movedCount,
    remainingCount: uses.length - movedCount,
  };

  const knownKeys = new Set(uses.map((u) => u.key));
  const unknown = options.selectedUseKeys.filter((k) => !knownKeys.has(k));

  if (!source) {
    preview.error = `Form '${sourceFormId}' not found in protocol.`;
  } else if (uses.length === 0) {
    preview.error = `Form '${source.name}' is not assigned to any visit.`;
  } else if (unknown.length > 0) {
    preview.error = `'${unknown[0]}' is not a current use of '${source.name}'.`;
  } else if (movedCount === 0) {
    preview.error = "Select at least one use to move to the variant.";
  } else if (preview.remainingCount === 0) {
    preview.error =
      "Every use is selected, which would leave the shared form unused. Keep at least one use on it, or duplicate the form instead.";
  } else if (variantName === "") {
    preview.error = "Name the variant.";
  } else if (
    study.forms.some(
      (f) => f.name.trim().toLowerCase() === variantName.toLowerCase()
    )
  ) {
    preview.error = `A form named '${variantName}' already exists.`;
  }

  return preview;
}

function fieldReferenceIndex(form: CRFForm): Set<string> {
  const refs = new Set<string>();
  for (const sec of form.sections) {
    for (const fld of sec.fields) {
      refs.add(fld.id);
      refs.add(fld.variableName);
      for (const rc of fld.repeatingColumns || []) {
        refs.add(rc.id);
        refs.add(rc.variableName);
      }
    }
  }
  return refs;
}

function ruleConditions(rule: EditCheckRule): AstCondition[] {
  return [
    ...(rule.conditions || []),
    ...(rule.conditionGroups || []).flatMap((g) => g.conditions),
  ];
}

/**
 * Lists the field references in a form's rules that resolve to no field of
 * that form or of any other form in the study. Formula strings are not
 * parsed, so only rule targets, triggers and conditions are checked.
 */
export function findFormReferenceIssues(
  study: StudyProtocol,
  form: CRFForm
): FormReferenceIssue[] {
  const local = fieldReferenceIndex(form);
  const elsewhere = new Set<string>();
  for (const other of study.forms) {
    if (other.id === form.id) continue;
    for (const ref of fieldReferenceIndex(other)) elsewhere.add(ref);
  }
  const resolves = (ref: string) => local.has(ref) || elsewhere.has(ref);

  const issues: FormReferenceIssue[] = [];
  for (const rule of form.rules || []) {
    if (rule.targetFieldId && !resolves(rule.targetFieldId)) {
      issues.push({
        location: "rule_target",
        ownerId: rule.id,
        reference: rule.targetFieldId,
      });
    }
    for (const t of rule.triggerFieldIds || []) {
      if (!resolves(t)) {
        issues.push({
          location: "rule_trigger",
          ownerId: rule.id,
          reference: t,
        });
      }
    }
    for (const c of ruleConditions(rule)) {
      if (!resolves(c.fieldId)) {
        issues.push({
          location: "rule_condition",
          ownerId: rule.id,
          reference: c.fieldId,
        });
      }
      if (c.compareFieldId && !resolves(c.compareFieldId)) {
        issues.push({
          location: "rule_compare",
          ownerId: rule.id,
          reference: c.compareFieldId,
        });
      }
    }
  }
  return issues;
}

/** Every identity a form owns: the form, its sections, fields, columns, rules and condition groups. */
export function collectFormIdentities(form: CRFForm): string[] {
  const ids = [form.id];
  for (const sec of form.sections) {
    ids.push(sec.id);
    for (const fld of sec.fields) {
      ids.push(fld.id);
      for (const rc of fld.repeatingColumns || []) ids.push(rc.id);
    }
  }
  for (const rule of form.rules || []) {
    ids.push(rule.id);
    for (const g of rule.conditionGroups || []) ids.push(g.id);
  }
  return ids;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Clones a form with fresh identities for every nested element and rewrites
 * its internal references to the new field ids. Variable names are kept, so
 * the variant collects the same CDASH variables as its source.
 */
function cloneFormWithFreshIdentities(
  source: CRFForm,
  name: string
): { form: CRFForm; identityMap: Map<string, string> } {
  const identityMap = new Map<string, string>();
  const fieldIds = new Map<string, string>();
  const form: CRFForm = cloneDeep(source);

  form.id = generateEngineId(`form_${(form.domain || "crf").toLowerCase()}`);
  identityMap.set(source.id, form.id);
  form.name = name;
  form.isLocked = false;
  delete form.lockedBy;
  delete form.lockedAt;

  const refreshField = (fld: CRFField): CRFField => {
    const id = generateEngineId("fld");
    fieldIds.set(fld.id, id);
    identityMap.set(fld.id, id);
    return {
      ...fld,
      id,
      ...(fld.repeatingColumns
        ? { repeatingColumns: fld.repeatingColumns.map(refreshField) }
        : {}),
    };
  };

  form.sections = form.sections.map((sec) => {
    const id = generateEngineId("sec");
    identityMap.set(sec.id, id);
    return { ...sec, id, fields: sec.fields.map(refreshField) };
  });

  const remapId = (ref: string) => fieldIds.get(ref) ?? ref;
  const idPattern =
    fieldIds.size > 0
      ? new RegExp(
          `(?<![A-Za-z0-9_-])(${Array.from(fieldIds.keys())
            .sort((a, b) => b.length - a.length)
            .map(escapeRegex)
            .join("|")})(?![A-Za-z0-9_-])`,
          "g"
        )
      : null;
  const remapFormula = (formula: string) =>
    idPattern
      ? formula.replace(idPattern, (m) => fieldIds.get(m) ?? m)
      : formula;
  const remapCondition = (c: AstCondition): AstCondition => ({
    ...c,
    fieldId: remapId(c.fieldId),
    ...(c.compareFieldId ? { compareFieldId: remapId(c.compareFieldId) } : {}),
  });

  const remapFieldFormulas = (fld: CRFField) => {
    if (fld.calculationFormula) {
      fld.calculationFormula = remapFormula(fld.calculationFormula);
    }
    fld.repeatingColumns?.forEach(remapFieldFormulas);
  };
  form.sections.forEach((sec) => sec.fields.forEach(remapFieldFormulas));

  form.rules = (form.rules || []).map((rule) => {
    const id = generateEngineId("rule");
    identityMap.set(rule.id, id);
    return {
      ...rule,
      id,
      targetFieldId: remapId(rule.targetFieldId),
      triggerFieldIds: (rule.triggerFieldIds || []).map(remapId),
      conditions: (rule.conditions || []).map(remapCondition),
      ...(rule.conditionGroups
        ? {
            conditionGroups: rule.conditionGroups.map((g) => {
              const gid = generateEngineId("condgrp");
              identityMap.set(g.id, gid);
              return {
                ...g,
                id: gid,
                conditions: g.conditions.map(remapCondition),
              };
            }),
          }
        : {}),
      ...(rule.formulaExpression
        ? { formulaExpression: remapFormula(rule.formulaExpression) }
        : {}),
    };
  });

  return { form, identityMap };
}

function replaceFormId(ids: string[], from: string, to: string): string[] {
  return Array.from(new Set(ids.map((id) => (id === from ? to : id))));
}

type VisitAssignmentSnapshot = Pick<
  StudyVisit,
  "assignedFormIds" | "formIds" | "armFormAssignments"
>;

function snapshotAssignments(visit: StudyVisit): VisitAssignmentSnapshot {
  return cloneDeep({
    assignedFormIds: visit.assignedFormIds,
    formIds: visit.formIds,
    armFormAssignments: visit.armFormAssignments,
  });
}

function withAssignments(
  visit: StudyVisit,
  snapshot: VisitAssignmentSnapshot
): StudyVisit {
  const next: StudyVisit = {
    ...visit,
    assignedFormIds: snapshot.assignedFormIds,
  };
  if (snapshot.formIds) next.formIds = snapshot.formIds;
  else delete next.formIds;
  if (snapshot.armFormAssignments) {
    next.armFormAssignments = snapshot.armFormAssignments;
  } else delete next.armFormAssignments;
  return next;
}

/**
 * Creates an explicit variant of a shared form and reassigns the selected
 * uses to it, as one atomic transaction: either the variant is added and
 * every selected use moves, or the input study is returned unchanged with
 * an `error`. Unselected uses keep the shared form, including arms that
 * followed a changed visit default, which receive an arm-specific
 * assignment that keeps them on the source.
 */
export function createFormVariant(
  study: StudyProtocol,
  sourceFormId: string,
  options: FormVariantOptions
): FormVariantResult {
  const preview = previewFormVariant(study, sourceFormId, options);
  if (preview.error) return { study, preview, error: preview.error };

  const source = study.forms.find((f) => f.id === sourceFormId)!;
  const { form: variant, identityMap } = cloneFormWithFreshIdentities(
    source,
    preview.variantName
  );

  // Identity check: no nested identity of the variant may exist anywhere in the study.
  const existingIds = new Set(study.forms.flatMap(collectFormIdentities));
  const collision = collectFormIdentities(variant).find((id) =>
    existingIds.has(id)
  );
  if (collision) {
    const error = `Variant identity '${collision}' collides with an existing identity.`;
    return { study, preview: { ...preview, error }, error };
  }

  // Reference check: the variant must not point at the source's own fields,
  // and must not introduce references the source did not already leave unresolved.
  const sourceOnlyIds = new Set(
    collectFormIdentities(source).filter((id) => id !== source.id)
  );
  const aliased = (variant.rules || []).find((rule) =>
    [
      rule.targetFieldId,
      ...(rule.triggerFieldIds || []),
      ...ruleConditions(rule).flatMap((c) => [c.fieldId, c.compareFieldId]),
    ].some((ref) => ref !== undefined && sourceOnlyIds.has(ref))
  );
  const withVariant: StudyProtocol = {
    ...study,
    forms: [...study.forms, variant],
  };
  const newIssues =
    findFormReferenceIssues(withVariant, variant).length -
    findFormReferenceIssues(study, source).length;
  if (aliased || newIssues > 0) {
    const error = `Variant rule '${aliased?.name ?? "reference"}' would not resolve to the variant's own fields.`;
    return { study, preview: { ...preview, error }, error };
  }

  const selected = new Set(options.selectedUseKeys);
  const touched = new Map<string, VisitAssignmentSnapshot>();

  const visits = study.visits.map((visit) => {
    const changes = preview.changes.filter((c) => c.use.visitId === visit.id);
    const affected = changes.some(
      (c) => c.outcome === "moves_to_variant" || c.createsArmAssignment
    );
    if (!affected) return visit;
    touched.set(visit.id, snapshotAssignments(visit));

    const defaultMoves = selected.has(formUseKey(visit.id));
    const originalDefault = visit.assignedFormIds || [];
    const next: StudyVisit = { ...visit };
    if (defaultMoves) {
      next.assignedFormIds = replaceFormId(
        originalDefault,
        source.id,
        variant.id
      );
      if (visit.formIds) {
        next.formIds = replaceFormId(visit.formIds, source.id, variant.id);
      }
    }

    const armAssignments = { ...(visit.armFormAssignments || {}) };
    let armChanged = false;
    for (const change of changes) {
      const { use } = change;
      if (!use.armId) continue;
      if (
        use.kind === "arm_override" &&
        change.outcome === "moves_to_variant"
      ) {
        armAssignments[use.armId] = replaceFormId(
          armAssignments[use.armId] || [],
          source.id,
          variant.id
        );
        armChanged = true;
      } else if (use.kind === "arm_inherited" && change.createsArmAssignment) {
        // The arm followed the visit default; pin it to the outcome chosen for it.
        armAssignments[use.armId] =
          change.outcome === "moves_to_variant"
            ? replaceFormId(originalDefault, source.id, variant.id)
            : [...originalDefault];
        armChanged = true;
      }
    }
    if (armChanged) next.armFormAssignments = armAssignments;
    return next;
  });

  const committed = appendProtocolAuditEntry(
    {
      ...study,
      lastModified: new Date().toISOString(),
      forms: [...study.forms, variant],
      visits,
    },
    {
      actionType: "FORM_VARIANT_CREATE",
      targetId: variant.id,
      formId: variant.id,
      previousValue: { sourceFormId: source.id, uses: preview.uses.length },
      newValue: {
        variantFormId: variant.id,
        movedUseKeys: preview.changes
          .filter((c) => c.outcome === "moves_to_variant")
          .map((c) => c.use.key),
      },
      actor: options.actor,
      reasonForChange: `Created variant '${variant.name}' of '${source.name}' for ${preview.movedCount} of ${preview.uses.length} uses`,
    }
  );

  const variantId = variant.id;
  const undo = (currentStudy: StudyProtocol): StudyProtocol => ({
    ...currentStudy,
    lastModified: new Date().toISOString(),
    forms: currentStudy.forms.filter((f) => f.id !== variantId),
    visits: currentStudy.visits.map((visit) => {
      const snapshot = touched.get(visit.id);
      if (snapshot) return withAssignments(visit, cloneDeep(snapshot));
      const prune = (ids: string[]) => ids.filter((id) => id !== variantId);
      if (
        !visitDefaultIncludes(visit, variantId) &&
        !Object.values(visit.armFormAssignments || {}).some((ids) =>
          ids.includes(variantId)
        )
      ) {
        return visit;
      }
      return {
        ...visit,
        assignedFormIds: prune(visit.assignedFormIds || []),
        ...(visit.formIds ? { formIds: prune(visit.formIds) } : {}),
        ...(visit.armFormAssignments
          ? {
              armFormAssignments: Object.fromEntries(
                Object.entries(visit.armFormAssignments).map(([k, v]) => [
                  k,
                  prune(v),
                ])
              ),
            }
          : {}),
      };
    }),
  });

  return {
    study: committed,
    variant,
    preview,
    identityMap: Object.fromEntries(identityMap),
    undo,
  };
}
