/**
 * Amendment impact on saved test scenarios (#679).
 *
 * A scenario's run evidence (#677) used to carry a single fingerprint of its
 * whole form, which answered "did anything on this form change?" but not
 * "which change affects which saved test, and why?". This module answers the
 * second question.
 *
 * At run time it walks the scenario's actual dependencies (the fields its
 * expectations read, the calculation formulas and rule conditions those
 * fields depend on, the codelists that code them, and the visits the record
 * and any cross-visit comparison sit at) and records one fingerprint per
 * dependency aspect. After an amendment, the same walk is repeated against
 * the current study and each aspect is compared, so a stale result carries a
 * reason naming the object that changed.
 *
 * Fingerprints cover semantic material only. Labels, help text, codelist
 * decodes, rule names and visit display names do not participate, so a
 * wording-only edit never invalidates computational evidence.
 *
 * Evidence recorded before this module existed has no per-dependency
 * snapshot. It is never reported as current: when its form fingerprint still
 * matches it is reported as `unknown` (fields and rules unchanged, codelist
 * and visit changes unverifiable), and otherwise as `stale`.
 */

import type {
  CRFField,
  CRFForm,
  CodelistDefinition,
  EditCheckRule,
  ScenarioDependencySnapshot,
  ScenarioExpectation,
  StudyProtocol,
  StudyVisit,
  TestScenario,
} from "./types";
import {
  flattenFormFields,
  type FormTestReport,
  type FormTestScope,
} from "./form-test-harness";
import { KNOWN_MATH_FUNCTIONS, tokenizeWithSpans } from "./formula-linter";
import {
  createScenario,
  fingerprintForm,
  runScenario,
  upsertScenario,
} from "./test-scenarios";

export type { ScenarioDependencySnapshot };

/**
 * Version of the dependency fingerprint material. Bump it whenever the
 * material below changes shape, so older snapshots read as unverifiable
 * rather than as silently current or silently stale.
 */
export const SCENARIO_DEPENDENCY_VERSION = 1;

/** Kinds of study object a scenario's outcome can depend on. */
export type ScenarioDependencyKind =
  "form" | "field" | "rule" | "codelist" | "visit";

/**
 * One study object a scenario depends on. `id` is the reference as the study
 * spells it, which may name an object that no longer (or does not yet) exist.
 */
export interface ScenarioDependencyRef {
  kind: ScenarioDependencyKind;
  id: string;
  /** Stable `kind:id` key. */
  key: string;
}

/**
 * Freshness of a scenario's evidence against the current study.
 *
 * Only `current` evidence may be presented as verification. `unknown` is
 * evidence recorded before per-dependency tracking whose form is unchanged:
 * honest about not knowing, and never shown as a pass.
 */
export type ScenarioFreshness = "never_run" | "current" | "stale" | "unknown";

/**
 * Standing combining freshness with the last result. `passing` and `failing`
 * are only ever reported for current evidence.
 */
export type ScenarioImpactStanding =
  "never_run" | "stale" | "unknown" | "passing" | "failing";

/** How a dependency changed between the run and now. */
export type ScenarioDependencyChange = "changed" | "removed" | "added";

/** Where the studio should take an author to inspect a changed object. */
export interface ScenarioImpactNavigationTarget {
  mode: "designer" | "rules" | "matrix";
  formId?: string;
  fieldId?: string;
  visitId?: string;
}

/** One reason a scenario's evidence is stale. */
export interface ScenarioStaleReason {
  dependency: ScenarioDependencyRef;
  change: ScenarioDependencyChange;
  /** Aspects that changed, e.g. `formula` or `codes`. Empty for added/removed. */
  aspects: string[];
  /** Display name of the object (its current label, or its id when gone). */
  objectLabel: string;
  /** One sentence suitable for a stale label or an export package. */
  message: string;
  navigation: ScenarioImpactNavigationTarget;
}

/** Freshness of one scenario, with the reasons behind it. */
export interface ScenarioFreshnessAssessment {
  scenarioId: string;
  scenarioName: string;
  formId: string;
  freshness: ScenarioFreshness;
  standing: ScenarioImpactStanding;
  reasons: ScenarioStaleReason[];
  /** Short human label, e.g. "Stale: calculation formula of BMI changed". */
  label: string;
  /** False when the scenario's form no longer exists, so it cannot be rerun. */
  rerunnable: boolean;
  /** When the evidence was produced, if it exists. Never implies currency. */
  lastRanAt?: string;
}

/** A changed study object and the saved scenarios it affects. */
export interface AmendedObjectImpact {
  dependency: ScenarioDependencyRef;
  objectLabel: string;
  change: ScenarioDependencyChange;
  aspects: string[];
  affectedScenarioIds: string[];
  navigation: ScenarioImpactNavigationTarget;
}

/** Study-wide answer to "which saved tests does this amendment affect?". */
export interface ScenarioImpactReport {
  assessments: ScenarioFreshnessAssessment[];
  /** Scenarios whose evidence is stale or unverifiable: candidates to rerun. */
  affected: ScenarioFreshnessAssessment[];
  changedObjects: AmendedObjectImpact[];
  counts: Record<ScenarioFreshness, number>;
}

// --- Fingerprint material ---------------------------------------------------

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`)
    .join(",")}}`;
}

function hashMaterial(value: unknown): string {
  const material = stableStringify(value);
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < material.length; i++) {
    const code = material.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 0x01000193) >>> 0;
    h2 = Math.imul(h2 + code + i, 0x85ebca6b) >>> 0;
  }
  return `${h1.toString(16).padStart(8, "0")}${h2.toString(16).padStart(8, "0")}`;
}

const ABSENT = "absent";
const PRESENT = "present";

function sortedCodes(options: { code: string }[] | undefined): string[] {
  return (options || []).map((option) => String(option.code)).sort();
}

/**
 * Semantic aspects of a field. Label, help text and layout are excluded, and
 * so are range limits, which no scenario expectation can observe.
 * Requiredness is included only when the scenario asserts requiredness.
 */
function fieldAspects(
  field: CRFField,
  includeRequirement: boolean
): Record<string, unknown> {
  const aspects: Record<string, unknown> = {
    // Formulas and conditions may address a field by variable name, so a
    // rename of the variable is semantic even though a relabel is not.
    identity: { variableName: field.variableName },
    type: { dataType: field.dataType, unit: field.unit },
    formula: { calculationFormula: field.calculationFormula },
    coding: {
      codelistId: field.codelistId,
      customCodes: sortedCodes(field.customOptions),
    },
  };
  if (includeRequirement) aspects.requirement = { required: field.required };
  return aspects;
}

/** Semantic aspects of a rule. Name, description and query wording are excluded. */
function ruleAspects(rule: EditCheckRule): Record<string, unknown> {
  return {
    action: { actionType: rule.actionType, targetFieldId: rule.targetFieldId },
    logic: {
      conditions: rule.conditions,
      logicalOperator: rule.logicalOperator,
      conditionGroups: rule.conditionGroups,
      groupLogicalOperator: rule.groupLogicalOperator,
      formulaExpression: rule.formulaExpression,
      unsupportedExpression: rule.unsupportedExpression,
    },
  };
}

/** Semantic aspects of a codelist: its codes. Decodes and names are excluded. */
function codelistAspects(
  codelist: CodelistDefinition
): Record<string, unknown> {
  return { codes: sortedCodes(codelist.options) };
}

function visitCollectsForm(visit: StudyVisit, formId: string): boolean {
  if ((visit.assignedFormIds || []).includes(formId)) return true;
  if ((visit.formIds || []).includes(formId)) return true;
  return Object.values(visit.armFormAssignments || {}).some((ids) =>
    (ids || []).includes(formId)
  );
}

/**
 * Semantic aspects of a visit, relative to the scenario's form. The visit's
 * display name and OID are excluded.
 */
function visitAspects(
  visit: StudyVisit,
  formId: string
): Record<string, unknown> {
  return {
    assignment: { collectsForm: visitCollectsForm(visit, formId) },
    timing: {
      targetDay: visit.targetDay,
      timepointDays: visit.timepointDays,
      windowBefore: visit.windowBefore,
      windowAfter: visit.windowAfter,
    },
    repetition: {
      visitType: visit.visitType,
      isRepeating: visit.isRepeating,
      repeatMax: visit.repeatMax,
    },
  };
}

// --- Dependency resolution --------------------------------------------------

function findField(fields: CRFField[], ref: string): CRFField | undefined {
  const lower = ref.toLowerCase();
  return (
    fields.find((field) => field.id === ref) ||
    fields.find((field) => field.id.toLowerCase() === lower) ||
    fields.find((field) => (field.variableName || "").toLowerCase() === lower)
  );
}

function formulaIdentifiers(formula: string | undefined): string[] {
  if (!formula || typeof formula !== "string") return [];
  return tokenizeWithSpans(formula)
    .filter((token) => token.type === "IDENTIFIER")
    .map((token) => token.value)
    .filter((name) => !KNOWN_MATH_FUNCTIONS.has(name.toLowerCase()));
}

function ruleTargets(rule: EditCheckRule, field: CRFField): boolean {
  return (
    rule.targetFieldId === field.id || rule.targetFieldId === field.variableName
  );
}

const STATE_ACTIONS = new Set(["show_field", "hide_field", "require_field"]);

function ruleConditionRefs(rule: EditCheckRule): {
  fieldRefs: string[];
  visitRefs: string[];
} {
  const conditions = [
    ...(rule.conditions || []),
    ...(rule.conditionGroups || []).flatMap((group) => group.conditions || []),
  ];
  const fieldRefs: string[] = [];
  const visitRefs: string[] = [];
  for (const condition of conditions) {
    if (condition.fieldId) fieldRefs.push(condition.fieldId);
    if (condition.compareFieldId) fieldRefs.push(condition.compareFieldId);
    if (condition.crossVisitId) visitRefs.push(condition.crossVisitId);
  }
  fieldRefs.push(...formulaIdentifiers(rule.formulaExpression));
  return { fieldRefs, visitRefs };
}

/** Internal dependency set: field refs are normalized to resolved ids where possible. */
interface DependencySet {
  form: string;
  fields: Set<string>;
  /** Fields whose requiredness an expectation asserts. */
  requiredFields: Set<string>;
  rules: Set<string>;
  codelists: Set<string>;
  visits: Set<string>;
  /** Codelist id -> a field that uses it, for navigation. */
  codelistUsers: Map<string, string>;
}

function resolveDependencySet(
  scenario: TestScenario,
  form: CRFForm | undefined
): DependencySet {
  const deps: DependencySet = {
    form: scenario.formId,
    fields: new Set(),
    requiredFields: new Set(),
    rules: new Set(),
    codelists: new Set(),
    visits: new Set([scenario.scope.visitId]),
    codelistUsers: new Map(),
  };
  const fields = form ? flattenFormFields(form) : [];
  const rules = form?.rules || [];

  const visitedFieldRefs = new Set<string>();
  const visitedRules = new Set<string>();

  // Value closure: a field and, if it is derived, everything its formula reads.
  const addFieldValue = (ref: string) => {
    if (visitedFieldRefs.has(ref)) return;
    visitedFieldRefs.add(ref);
    const field = findField(fields, ref);
    const id = field ? field.id : ref;
    deps.fields.add(id);
    if (!field) return;
    if (field.codelistId) {
      deps.codelists.add(field.codelistId);
      if (!deps.codelistUsers.has(field.codelistId)) {
        deps.codelistUsers.set(field.codelistId, field.id);
      }
    }
    if (field.dataType === "calculated") {
      formulaIdentifiers(field.calculationFormula).forEach(addFieldValue);
    }
  };

  const addRule = (rule: EditCheckRule) => {
    if (visitedRules.has(rule.id)) return;
    visitedRules.add(rule.id);
    deps.rules.add(rule.id);
    const { fieldRefs, visitRefs } = ruleConditionRefs(rule);
    fieldRefs.forEach(addFieldValue);
    visitRefs.forEach((visitId) => deps.visits.add(visitId));
  };

  // State closure: a field's visibility or requiredness also depends on every
  // visibility/requiredness rule aimed at it.
  const addFieldState = (ref: string) => {
    addFieldValue(ref);
    const field = findField(fields, ref);
    if (!field) return;
    rules
      .filter((rule) => STATE_ACTIONS.has(rule.actionType))
      .filter((rule) => ruleTargets(rule, field))
      .forEach(addRule);
  };

  for (const expectation of scenario.expectations) {
    switch (expectation.kind) {
      case "field_visible":
        addFieldState(expectation.fieldId);
        break;
      case "field_required": {
        addFieldState(expectation.fieldId);
        const field = findField(fields, expectation.fieldId);
        deps.requiredFields.add(field ? field.id : expectation.fieldId);
        break;
      }
      case "calculation":
        addFieldValue(expectation.fieldId);
        break;
      case "rule_result": {
        const rule = rules.find(
          (candidate) => candidate.id === expectation.ruleId
        );
        if (rule) addRule(rule);
        else deps.rules.add(expectation.ruleId);
        break;
      }
    }
  }

  return deps;
}

function aspectFingerprints(
  prefix: string,
  aspects: Record<string, unknown> | null,
  out: Record<string, string>
): void {
  out[`${prefix}/presence`] = aspects ? PRESENT : ABSENT;
  if (!aspects) return;
  for (const [aspect, material] of Object.entries(aspects)) {
    out[`${prefix}/${aspect}`] = hashMaterial(material);
  }
}

function subjectFingerprints(
  ref: ScenarioDependencyRef,
  study: StudyProtocol,
  formId: string,
  includeRequirement = true
): Record<string, string> {
  const out: Record<string, string> = {};
  const form = (study.forms || []).find((candidate) => candidate.id === formId);
  switch (ref.kind) {
    case "form":
      aspectFingerprints(ref.key, form ? {} : null, out);
      break;
    case "field": {
      const field = form
        ? findField(flattenFormFields(form), ref.id)
        : undefined;
      aspectFingerprints(
        ref.key,
        field ? fieldAspects(field, includeRequirement) : null,
        out
      );
      break;
    }
    case "rule": {
      const rule = (form?.rules || []).find(
        (candidate) => candidate.id === ref.id
      );
      aspectFingerprints(ref.key, rule ? ruleAspects(rule) : null, out);
      break;
    }
    case "codelist": {
      const codelist = (study.codelists || []).find(
        (candidate) => candidate.id === ref.id
      );
      aspectFingerprints(
        ref.key,
        codelist ? codelistAspects(codelist) : null,
        out
      );
      break;
    }
    case "visit": {
      const visit = (study.visits || []).find(
        (candidate) => candidate.id === ref.id
      );
      aspectFingerprints(
        ref.key,
        visit ? visitAspects(visit, formId) : null,
        out
      );
      break;
    }
  }
  return out;
}

function makeRef(
  kind: ScenarioDependencyKind,
  id: string
): ScenarioDependencyRef {
  return { kind, id, key: `${kind}:${id}` };
}

function parseKey(
  key: string
): { ref: ScenarioDependencyRef; aspect: string } | null {
  const slash = key.lastIndexOf("/");
  const colon = key.indexOf(":");
  if (slash < 0 || colon < 0 || colon > slash) return null;
  const kind = key.slice(0, colon) as ScenarioDependencyKind;
  if (!["form", "field", "rule", "codelist", "visit"].includes(kind))
    return null;
  return {
    ref: makeRef(kind, key.slice(colon + 1, slash)),
    aspect: key.slice(slash + 1),
  };
}

/**
 * Lists the study objects a scenario's outcome depends on, derived from its
 * expectations: the fields it reads, the formulas and rule conditions behind
 * them, their codelists, the visit its record sits at and any cross-visit
 * comparison visits. Pure; the study is not modified.
 */
export function collectScenarioDependencies(
  scenario: TestScenario,
  study: StudyProtocol
): ScenarioDependencyRef[] {
  return refsFor(scenario, study).refs;
}

function refsFor(
  scenario: TestScenario,
  study: StudyProtocol
): { refs: ScenarioDependencyRef[]; deps: DependencySet } {
  const form = (study.forms || []).find(
    (candidate) => candidate.id === scenario.formId
  );
  const deps = resolveDependencySet(scenario, form);
  const refs = [
    makeRef("form", deps.form),
    ...[...deps.fields].sort().map((id) => makeRef("field", id)),
    ...[...deps.rules].sort().map((id) => makeRef("rule", id)),
    ...[...deps.codelists].sort().map((id) => makeRef("codelist", id)),
    ...[...deps.visits].sort().map((id) => makeRef("visit", id)),
  ];
  return { refs, deps };
}

/**
 * Fingerprints every dependency aspect of a scenario against a study,
 * keyed `kind:id/aspect`. Only semantic material participates, so label-only
 * edits leave every fingerprint unchanged.
 */
export function fingerprintScenarioDependencies(
  scenario: TestScenario,
  study: StudyProtocol
): ScenarioDependencySnapshot {
  const fingerprints: Record<string, string> = {};
  const { refs, deps } = refsFor(scenario, study);
  for (const ref of refs) {
    Object.assign(
      fingerprints,
      subjectFingerprints(
        ref,
        study,
        scenario.formId,
        ref.kind !== "field" || deps.requiredFields.has(ref.id)
      )
    );
  }
  return { version: SCENARIO_DEPENDENCY_VERSION, fingerprints };
}

// --- Assessment ---------------------------------------------------------------

const ASPECT_PHRASES: Record<string, string> = {
  identity: "variable name",
  type: "data type or unit",
  requirement: "requiredness",
  formula: "calculation formula",
  coding: "codelist or option codes",
  action: "action or target",
  logic: "conditions",
  codes: "option codes",
  assignment: "form assignment",
  timing: "timing window",
  repetition: "visit type or repetition",
};

const KIND_NOUNS: Record<ScenarioDependencyKind, string> = {
  form: "form",
  field: "field",
  rule: "rule",
  codelist: "codelist",
  visit: "visit",
};

function objectLabelFor(
  ref: ScenarioDependencyRef,
  study: StudyProtocol,
  formId: string
): string {
  const form = (study.forms || []).find((candidate) => candidate.id === formId);
  switch (ref.kind) {
    case "form":
      return form?.name || ref.id;
    case "field": {
      const field = form
        ? findField(flattenFormFields(form), ref.id)
        : undefined;
      return field?.label || field?.variableName || ref.id;
    }
    case "rule":
      return (
        (form?.rules || []).find((rule) => rule.id === ref.id)?.name || ref.id
      );
    case "codelist":
      return (
        (study.codelists || []).find((cl) => cl.id === ref.id)?.name || ref.id
      );
    case "visit":
      return (
        (study.visits || []).find((visit) => visit.id === ref.id)?.name ||
        ref.id
      );
  }
}

function navigationFor(
  ref: ScenarioDependencyRef,
  study: StudyProtocol,
  formId: string,
  codelistUsers: Map<string, string>
): ScenarioImpactNavigationTarget {
  const formExists = (study.forms || []).some((form) => form.id === formId);
  const formTarget = formExists ? { formId } : {};
  switch (ref.kind) {
    case "field": {
      const form = (study.forms || []).find(
        (candidate) => candidate.id === formId
      );
      const field = form
        ? findField(flattenFormFields(form), ref.id)
        : undefined;
      return field
        ? { mode: "designer", ...formTarget, fieldId: field.id }
        : { mode: "designer", ...formTarget };
    }
    case "rule":
      return { mode: "rules", ...formTarget };
    case "codelist": {
      const fieldId = codelistUsers.get(ref.id);
      return fieldId
        ? { mode: "designer", ...formTarget, fieldId }
        : { mode: "designer", ...formTarget };
    }
    case "visit":
      return (study.visits || []).some((visit) => visit.id === ref.id)
        ? { mode: "matrix", visitId: ref.id }
        : { mode: "matrix" };
    case "form":
    default:
      return { mode: "designer", ...formTarget };
  }
}

function describeReason(
  ref: ScenarioDependencyRef,
  change: ScenarioDependencyChange,
  aspects: string[],
  objectLabel: string
): string {
  const noun = KIND_NOUNS[ref.kind];
  if (change === "removed") return `The ${noun} ${objectLabel} was removed.`;
  if (change === "added")
    return `The ${noun} ${objectLabel} now affects this test.`;
  const phrases = aspects.map((aspect) => ASPECT_PHRASES[aspect] || aspect);
  return `The ${phrases.join(" and ")} of ${noun} ${objectLabel} changed.`;
}

function freshnessLabel(
  freshness: ScenarioFreshness,
  standing: ScenarioImpactStanding,
  reasons: ScenarioStaleReason[]
): string {
  switch (freshness) {
    case "never_run":
      return "Never run";
    case "unknown":
      return "Unverified: recorded before dependency tracking; rerun to confirm";
    case "stale": {
      const first = reasons[0]?.message.replace(/\.$/, "") ?? "Study changed";
      const more = reasons.length > 1 ? ` (+${reasons.length - 1} more)` : "";
      return `Stale: ${first}${more}`;
    }
    case "current":
    default:
      return standing === "passing" ? "Current: passing" : "Current: failing";
  }
}

/**
 * Assesses whether a scenario's saved evidence still describes the current
 * study, and if not, why. This is the single source of truth for presenting
 * saved test results: anything other than `current` must not be shown as
 * verification.
 *
 * @param scenario - A saved scenario, with or without evidence.
 * @param study - The current study the scenario belongs to.
 * @returns The scenario's freshness, standing, reasons and a short label.
 */
export function assessScenarioFreshness(
  scenario: TestScenario,
  study: StudyProtocol
): ScenarioFreshnessAssessment {
  const form = (study.forms || []).find(
    (candidate) => candidate.id === scenario.formId
  );
  const base = {
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    formId: scenario.formId,
    rerunnable: Boolean(form),
    lastRanAt: scenario.lastRun?.ranAt,
  };
  const deps = resolveDependencySet(scenario, form);

  const finish = (
    freshness: ScenarioFreshness,
    reasons: ScenarioStaleReason[]
  ): ScenarioFreshnessAssessment => {
    const standing: ScenarioImpactStanding =
      freshness !== "current"
        ? freshness
        : scenario.lastRun?.failed === 0
          ? "passing"
          : "failing";
    return {
      ...base,
      freshness,
      standing,
      reasons,
      label: freshnessLabel(freshness, standing, reasons),
    };
  };

  const formRef = makeRef("form", scenario.formId);
  const formRemovedReason = (): ScenarioStaleReason => {
    const objectLabel = scenario.formId;
    return {
      dependency: formRef,
      change: "removed",
      aspects: [],
      objectLabel,
      message: describeReason(formRef, "removed", [], objectLabel),
      navigation: { mode: "designer" },
    };
  };

  if (!scenario.lastRun) return finish("never_run", []);
  if (!form) return finish("stale", [formRemovedReason()]);

  const snapshot = scenario.lastRun.dependencies;
  if (!snapshot || snapshot.version !== SCENARIO_DEPENDENCY_VERSION) {
    // Legacy or foreign evidence: fall back to the whole-form fingerprint it
    // does carry. A mismatch is definitely stale; a match only proves fields
    // and rules are unchanged, so it is reported as unverifiable.
    if (scenario.lastRun.formFingerprint !== fingerprintForm(form)) {
      const objectLabel = form.name || form.id;
      return finish("stale", [
        {
          dependency: formRef,
          change: "changed",
          aspects: ["fields or rules"],
          objectLabel,
          message: `Fields or rules on form ${objectLabel} changed since this run, which predates per-dependency tracking, so the specific change cannot be named.`,
          navigation: { mode: "designer", formId: form.id },
        },
      ]);
    }
    return finish("unknown", []);
  }

  const current = fingerprintScenarioDependencies(scenario, study).fingerprints;
  const stored = snapshot.fingerprints;

  // Group aspect differences by subject.
  const bySubject = new Map<
    string,
    {
      ref: ScenarioDependencyRef;
      aspects: string[];
      change: ScenarioDependencyChange;
    }
  >();
  const keys = new Set([...Object.keys(stored), ...Object.keys(current)]);

  // Subjects present in the stored snapshot but no longer a dependency still
  // need comparing against their current state.
  const currentFor = (key: string, ref: ScenarioDependencyRef): string => {
    if (key in current) return current[key];
    return subjectFingerprints(ref, study, scenario.formId)[key] ?? ABSENT;
  };

  for (const key of [...keys].sort()) {
    const parsed = parseKey(key);
    if (!parsed) continue;
    const { ref, aspect } = parsed;
    const before = key in stored ? stored[key] : undefined;
    const after = currentFor(key, ref);
    if (before === after) continue;

    const entry = bySubject.get(ref.key) || {
      ref,
      aspects: [],
      change: "changed",
    };
    if (aspect === "presence") {
      // An unresolved reference that was never recorded has nothing to report.
      if (before === undefined && after === ABSENT) continue;
      if (before === undefined) {
        // Not a dependency at run time; it has become one since.
        entry.change = "added";
      } else {
        entry.change = after === ABSENT ? "removed" : "added";
      }
    } else if (before === undefined) {
      // A subject that became a dependency after the run: its aspects are new
      // material, already reported by its presence key.
      if (entry.change !== "removed") entry.change = "added";
    } else if (after !== ABSENT) {
      entry.aspects.push(aspect);
    }
    bySubject.set(ref.key, entry);
  }

  const reasons: ScenarioStaleReason[] = [...bySubject.values()]
    .filter((entry) => entry.change !== "changed" || entry.aspects.length > 0)
    .map((entry) => {
      const aspects = entry.change === "changed" ? entry.aspects : [];
      const objectLabel = objectLabelFor(entry.ref, study, scenario.formId);
      return {
        dependency: entry.ref,
        change: entry.change,
        aspects,
        objectLabel,
        message: describeReason(entry.ref, entry.change, aspects, objectLabel),
        navigation: navigationFor(
          entry.ref,
          study,
          scenario.formId,
          deps.codelistUsers
        ),
      };
    });

  return finish(reasons.length > 0 ? "stale" : "current", reasons);
}

/**
 * Assesses every saved scenario on a study and indexes the changed objects,
 * so an author can see which saved tests an amendment affects, navigate to the
 * object that changed, and select the affected tests to rerun.
 */
export function analyzeScenarioImpact(
  study: StudyProtocol
): ScenarioImpactReport {
  const assessments = [...(study.testScenarios || [])]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((scenario) => assessScenarioFreshness(scenario, study));

  const counts: Record<ScenarioFreshness, number> = {
    never_run: 0,
    current: 0,
    stale: 0,
    unknown: 0,
  };
  const objects = new Map<string, AmendedObjectImpact>();
  for (const assessment of assessments) {
    counts[assessment.freshness] += 1;
    for (const reason of assessment.reasons) {
      const key = `${reason.dependency.key}|${assessment.formId}|${reason.change}`;
      const existing = objects.get(key);
      if (existing) {
        existing.affectedScenarioIds.push(assessment.scenarioId);
        for (const aspect of reason.aspects) {
          if (!existing.aspects.includes(aspect)) existing.aspects.push(aspect);
        }
      } else {
        objects.set(key, {
          dependency: reason.dependency,
          objectLabel: reason.objectLabel,
          change: reason.change,
          aspects: [...reason.aspects],
          affectedScenarioIds: [assessment.scenarioId],
          navigation: reason.navigation,
        });
      }
    }
  }

  return {
    assessments,
    affected: assessments.filter(
      (assessment) =>
        assessment.freshness === "stale" || assessment.freshness === "unknown"
    ),
    changedObjects: [...objects.values()],
    counts,
  };
}

// --- Running ------------------------------------------------------------------

/**
 * Runs one scenario against its form and records per-dependency fingerprints
 * with the evidence, so later amendments can be attributed. Returns the
 * scenario with fresh evidence; the study is not modified.
 */
export function runScenarioWithDependencies(
  scenario: TestScenario,
  study: StudyProtocol,
  now?: Date
): { scenario: TestScenario; report: FormTestReport } {
  const form = (study.forms || []).find(
    (candidate) => candidate.id === scenario.formId
  );
  if (!form) {
    throw new Error(
      `Cannot run scenario "${scenario.name}": form "${scenario.formId}" is not part of study "${study.id}".`
    );
  }
  const { scenario: ran, report } = runScenario(scenario, form, now);
  const dependencies = fingerprintScenarioDependencies(scenario, study);
  return {
    scenario: ran.lastRun
      ? { ...ran, lastRun: { ...ran.lastRun, dependencies } }
      : ran,
    report,
  };
}

/** Outcome of rerunning one selected scenario. */
export interface ScenarioRerunSummary {
  scenarioId: string;
  name: string;
  standing: ScenarioImpactStanding;
  passed: number;
  failed: number;
}

/**
 * Reruns the selected scenarios (typically the affected ones) and returns the
 * updated study. Scenarios whose form no longer exists, or whose id is not on
 * the study, are reported as skipped rather than throwing.
 */
export function rerunScenarios(
  study: StudyProtocol,
  scenarioIds: readonly string[],
  now?: Date
): {
  study: StudyProtocol;
  summaries: ScenarioRerunSummary[];
  skipped: Array<{ scenarioId: string; reason: string }>;
} {
  let nextStudy = study;
  const summaries: ScenarioRerunSummary[] = [];
  const skipped: Array<{ scenarioId: string; reason: string }> = [];
  const wanted = new Set(scenarioIds);

  for (const scenarioId of wanted) {
    const scenario = (study.testScenarios || []).find(
      (s) => s.id === scenarioId
    );
    if (!scenario) {
      skipped.push({ scenarioId, reason: "No saved test with this id." });
      continue;
    }
    if (!(study.forms || []).some((form) => form.id === scenario.formId)) {
      skipped.push({
        scenarioId,
        reason: `Form ${scenario.formId} no longer exists.`,
      });
      continue;
    }
    const { scenario: ran } = runScenarioWithDependencies(scenario, study, now);
    nextStudy = upsertScenario(nextStudy, ran);
    const assessment = assessScenarioFreshness(ran, nextStudy);
    summaries.push({
      scenarioId,
      name: ran.name,
      standing: assessment.standing,
      passed: ran.lastRun?.passed ?? 0,
      failed: ran.lastRun?.failed ?? 0,
    });
  }

  return { study: nextStudy, summaries, skipped };
}

/**
 * Derives expectations from a test run, pinning every calculation's outcome,
 * every rule's result, and the visibility of every rule-targeted field. Used
 * to save what the author has just observed as a regression scenario.
 */
export function snapshotExpectationsFromReport(
  report: FormTestReport,
  form: CRFForm
): ScenarioExpectation[] {
  const expectations: ScenarioExpectation[] = [];
  for (const calculation of report.calculations) {
    expectations.push({
      kind: "calculation",
      fieldId: calculation.fieldId,
      expectedStatus: calculation.derivation.status,
      expectedValue:
        calculation.derivation.status === "success"
          ? calculation.derivation.result
          : undefined,
    });
  }
  for (const rule of report.rules) {
    expectations.push({
      kind: "rule_result",
      ruleId: rule.ruleId,
      expected: rule.result,
    });
  }
  const fields = flattenFormFields(form);
  const targeted = new Set<string>();
  for (const rule of form.rules || []) {
    if (!STATE_ACTIONS.has(rule.actionType)) continue;
    const field = findField(fields, rule.targetFieldId);
    if (field) targeted.add(field.id);
  }
  for (const fieldId of [...targeted].sort()) {
    const state = report.conditional.fields[fieldId];
    if (!state) continue;
    expectations.push({
      kind: "field_visible",
      fieldId,
      expected: state.visible,
    });
  }
  return expectations;
}

/**
 * Saves a test run as a named scenario on the study and records its evidence
 * with dependency fingerprints, so it immediately reads as current.
 *
 * @param study - The study to add the scenario to.
 * @param options - The form, the run report, the field-keyed inputs and the scope.
 * @returns The updated study and the saved scenario.
 */
export function saveScenarioFromReport(
  study: StudyProtocol,
  options: {
    name: string;
    form: CRFForm;
    report: FormTestReport;
    inputs: Record<string, string | number | boolean | null>;
    scope: FormTestScope;
    now?: Date;
  }
): { study: StudyProtocol; scenario: TestScenario } {
  const scenario = createScenario({
    name: options.name,
    formId: options.form.id,
    scope: options.scope,
    inputs: options.inputs,
    expectations: snapshotExpectationsFromReport(options.report, options.form),
    now: options.now,
  });
  const withScenario = upsertScenario(study, scenario);
  const { scenario: ran } = runScenarioWithDependencies(
    scenario,
    withScenario,
    options.now
  );
  return { study: upsertScenario(withScenario, ran), scenario: ran };
}
