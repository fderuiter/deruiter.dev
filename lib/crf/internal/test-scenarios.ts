/**
 * Named test scenarios and their run evidence (#677).
 *
 * A scenario pairs synthetic inputs with the outcomes an author expects, so a
 * study specification can be re-checked after an amendment instead of being
 * re-tested from memory.
 *
 * Two distinctions carry most of the weight here.
 *
 * A scenario **definition** is separate from its **run evidence**. The
 * definition is what the author wrote and is durable; the evidence is what
 * happened the last time it ran, and is only meaningful against the form
 * revision it ran on. Conflating them would let a green result from three
 * amendments ago read as a current pass.
 *
 * Evidence therefore records a fingerprint of the form it ran against, and
 * goes **stale** the moment that form changes. Stale is deliberately distinct
 * from failed: it means nobody knows yet, which is a different thing to tell
 * an author than "this broke".
 *
 * Scenarios live on the study document itself rather than in browser storage,
 * so they survive native export and reopen along with everything else the
 * study carries.
 */

import type {
  CalculationStatus,
  CRFForm,
  ConditionResult,
  ScenarioExpectation,
  ScenarioExpectationResult,
  ScenarioRunEvidence,
  StudyProtocol,
  TestScenario,
} from "../types";
import type { ConditionalFieldValues } from "./conditional-logic";
import { generateEngineId } from "./precision-date";
import {
  runFormTest,
  type FormTestReport,
  type FormTestScope,
} from "./form-test-harness";

export type {
  CalculationStatus,
  ScenarioExpectation,
  ScenarioRunEvidence,
  TestScenario,
};

/** One expectation checked against one run, in a form an author can read. */
export type ExpectationResult = ScenarioExpectationResult;

/**
 * Stable, order-independent serialization used for fingerprinting. Key order
 * must not affect the result, or an unrelated reserialization of the study
 * would read as an amendment.
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return `{${entries
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`)
    .join(",")}}`;
}

/**
 * Fingerprints the parts of a form a scenario's outcome can depend on: its
 * fields and its rules.
 *
 * Scoped to the form rather than the whole study on purpose. Editing an
 * unrelated form should not mark this scenario's evidence stale, or staleness
 * becomes noise an author learns to ignore.
 */
export function fingerprintForm(form: CRFForm): string {
  const material = stableStringify({
    fields: (form.sections || []).flatMap((section) =>
      (section.fields || []).map((field) => ({
        id: field.id,
        variableName: field.variableName,
        dataType: field.dataType,
        required: field.required,
        calculationFormula: field.calculationFormula,
        codelistId: field.codelistId,
        minValue: field.minValue,
        maxValue: field.maxValue,
      }))
    ),
    rules: (form.rules || []).map((rule) => ({
      id: rule.id,
      actionType: rule.actionType,
      targetFieldId: rule.targetFieldId,
      logicalOperator: rule.logicalOperator,
      groupLogicalOperator: rule.groupLogicalOperator,
      conditions: rule.conditions,
      conditionGroups: rule.conditionGroups,
      formulaExpression: rule.formulaExpression,
    })),
  });

  // Small, dependency-free content hash. This only needs to detect change,
  // not resist an adversary.
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < material.length; i++) {
    const code = material.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 0x01000193) >>> 0;
    h2 = Math.imul(h2 + code + i, 0x85ebca6b) >>> 0;
  }
  return `${h1.toString(16).padStart(8, "0")}${h2.toString(16).padStart(8, "0")}`;
}

/** Creates a scenario definition. It carries no evidence until it is run. */
export function createScenario(options: {
  name: string;
  formId: string;
  scope: FormTestScope;
  inputs?: Record<string, string | number | boolean | null>;
  expectations?: ScenarioExpectation[];
  description?: string;
  now?: Date;
}): TestScenario {
  const timestamp = (options.now || new Date()).toISOString();
  return {
    id: generateEngineId("scenario"),
    name: options.name,
    description: options.description,
    formId: options.formId,
    scope: options.scope,
    inputs: options.inputs || {},
    expectations: options.expectations || [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

/**
 * Applies an edit to a scenario definition.
 *
 * Editing the inputs or expectations invalidates any evidence attached to it:
 * the evidence answered a different question. Renaming or re-describing does
 * not, because the assertions are unchanged.
 */
export function updateScenario(
  scenario: TestScenario,
  changes: Partial<
    Pick<
      TestScenario,
      "name" | "description" | "inputs" | "expectations" | "scope"
    >
  >,
  now?: Date
): TestScenario {
  const invalidatesEvidence =
    changes.inputs !== undefined ||
    changes.expectations !== undefined ||
    changes.scope !== undefined;

  return {
    ...scenario,
    ...changes,
    lastRun: invalidatesEvidence ? undefined : scenario.lastRun,
    updatedAt: (now || new Date()).toISOString(),
  };
}

/** Clears a scenario's evidence without touching its definition. */
export function resetScenarioEvidence(scenario: TestScenario): TestScenario {
  return { ...scenario, lastRun: undefined };
}

function describeConditionResult(result: ConditionResult): string {
  switch (result) {
    case "true":
      return "fires";
    case "false":
      return "does not fire";
    case "missing":
      return "cannot be decided (waiting on input)";
    default:
      return "cannot be evaluated";
  }
}

function checkExpectation(
  expectation: ScenarioExpectation,
  report: FormTestReport
): ExpectationResult {
  switch (expectation.kind) {
    case "field_visible": {
      const state = report.conditional.fields[expectation.fieldId];
      const actual = state?.visible;
      return {
        expectation,
        satisfied: actual === expectation.expected,
        expectedLabel: expectation.expected ? "visible" : "hidden",
        actualLabel:
          actual === undefined
            ? "not present on this form"
            : actual
              ? "visible"
              : "hidden",
        subjectId: expectation.fieldId,
        subjectKind: "field",
      };
    }
    case "field_required": {
      const state = report.conditional.fields[expectation.fieldId];
      const actual = state?.required;
      return {
        expectation,
        satisfied: actual === expectation.expected,
        expectedLabel: expectation.expected ? "required" : "optional",
        actualLabel:
          actual === undefined
            ? "not present on this form"
            : actual
              ? "required"
              : "optional",
        subjectId: expectation.fieldId,
        subjectKind: "field",
      };
    }
    case "calculation": {
      const outcome = report.calculations.find(
        (candidate) => candidate.fieldId === expectation.fieldId
      );
      const status = outcome?.derivation.status;
      const value = outcome?.derivation.result ?? null;

      const statusMatches = status === expectation.expectedStatus;
      const valueMatters =
        expectation.expectedStatus === "success" &&
        expectation.expectedValue !== undefined;
      const valueMatches = !valueMatters || value === expectation.expectedValue;

      return {
        expectation,
        satisfied: statusMatches && valueMatches,
        expectedLabel: valueMatters
          ? `${expectation.expectedStatus} with value ${expectation.expectedValue}`
          : expectation.expectedStatus,
        actualLabel:
          status === undefined
            ? "no calculated field with this id"
            : status === "success"
              ? `success with value ${value}`
              : status,
        subjectId: expectation.fieldId,
        subjectKind: "field",
      };
    }
    case "rule_result":
    default: {
      const outcome = report.rules.find(
        (candidate) => candidate.ruleId === expectation.ruleId
      );
      return {
        expectation,
        satisfied: outcome?.result === expectation.expected,
        expectedLabel: describeConditionResult(expectation.expected),
        actualLabel:
          outcome === undefined
            ? "no rule with this id"
            : describeConditionResult(outcome.result),
        subjectId: expectation.ruleId,
        subjectKind: "rule",
      };
    }
  }
}

/**
 * Projects a scenario's field-keyed inputs into the scoped shape the harness
 * expects. Storing inputs unscoped keeps a scenario portable: it can be
 * replayed under a different synthetic subject without rewriting its data.
 */
export function projectScenarioInputs(
  scenario: TestScenario
): ConditionalFieldValues {
  const values: ConditionalFieldValues = {};
  for (const [fieldId, value] of Object.entries(scenario.inputs)) {
    values[`${scenario.scope.subjectId}_${scenario.scope.visitId}_${fieldId}`] =
      value;
  }
  return values;
}

/**
 * Runs a scenario against a form and returns the scenario with fresh evidence
 * attached. The definition is untouched.
 */
export function runScenario(
  scenario: TestScenario,
  form: CRFForm,
  now?: Date
): { scenario: TestScenario; report: FormTestReport } {
  const report = runFormTest(
    form,
    projectScenarioInputs(scenario),
    scenario.scope
  );
  const results = scenario.expectations.map((expectation) =>
    checkExpectation(expectation, report)
  );
  const passed = results.filter((result) => result.satisfied).length;

  const evidence: ScenarioRunEvidence = {
    ranAt: (now || new Date()).toISOString(),
    formFingerprint: fingerprintForm(form),
    results,
    passed,
    failed: results.length - passed,
  };

  return { scenario: { ...scenario, lastRun: evidence }, report };
}

/**
 * Whether a scenario's evidence still describes the current form.
 *
 * Evidence with no run, or produced against a different form revision, is
 * stale. Stale is not failure: it means the answer is unknown until the
 * scenario is run again.
 */
export function isEvidenceStale(
  scenario: TestScenario,
  form: CRFForm
): boolean {
  if (!scenario.lastRun) return true;
  return scenario.lastRun.formFingerprint !== fingerprintForm(form);
}

/** A short sentence describing one expectation-versus-actual result. */
export function describeExpectationResult(result: ExpectationResult): string {
  const subject =
    result.subjectKind === "field"
      ? `Field ${result.subjectId}`
      : `Rule ${result.subjectId}`;
  return result.satisfied
    ? `${subject}: ${result.actualLabel}, as expected.`
    : `${subject}: expected ${result.expectedLabel}, got ${result.actualLabel}.`;
}

/**
 * Overall standing of a scenario against the current form, combining evidence
 * with staleness so a caller never has to derive it and risk disagreeing.
 */
export type ScenarioStanding = "never_run" | "stale" | "passing" | "failing";

export function getScenarioStanding(
  scenario: TestScenario,
  form: CRFForm
): ScenarioStanding {
  if (!scenario.lastRun) return "never_run";
  if (isEvidenceStale(scenario, form)) return "stale";
  return scenario.lastRun.failed === 0 ? "passing" : "failing";
}

// --- Study document integration -------------------------------------------

/** Returns the scenarios saved on a study, newest edit first. */
export function listScenarios(study: StudyProtocol): TestScenario[] {
  return [...(study.testScenarios || [])].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt)
  );
}

/** Returns the scenarios targeting one form. */
export function getScenariosForForm(
  study: StudyProtocol,
  formId: string
): TestScenario[] {
  return listScenarios(study).filter((scenario) => scenario.formId === formId);
}

/**
 * Adds or replaces a scenario on the study, returning a new study rather than
 * mutating the one passed in.
 */
export function upsertScenario(
  study: StudyProtocol,
  scenario: TestScenario
): StudyProtocol {
  const existing = study.testScenarios || [];
  const next = existing.filter((candidate) => candidate.id !== scenario.id);
  next.push(scenario);
  return { ...study, testScenarios: next };
}

/** Removes a scenario from the study. */
export function removeScenario(
  study: StudyProtocol,
  scenarioId: string
): StudyProtocol {
  return {
    ...study,
    testScenarios: (study.testScenarios || []).filter(
      (scenario) => scenario.id !== scenarioId
    ),
  };
}

/**
 * Runs every scenario targeting one form and returns the updated study plus a
 * per-scenario summary, so an author can re-check a form after an amendment in
 * one action.
 */
export function runScenariosForForm(
  study: StudyProtocol,
  formId: string,
  now?: Date
): {
  study: StudyProtocol;
  summaries: Array<{
    scenarioId: string;
    name: string;
    standing: ScenarioStanding;
    passed: number;
    failed: number;
  }>;
} {
  const form = (study.forms || []).find((candidate) => candidate.id === formId);
  if (!form) {
    throw new Error(
      `Cannot run scenarios: form "${formId}" is not part of study "${study.id}".`
    );
  }

  let nextStudy = study;
  const summaries = getScenariosForForm(study, formId).map((scenario) => {
    const { scenario: ran } = runScenario(scenario, form, now);
    nextStudy = upsertScenario(nextStudy, ran);
    return {
      scenarioId: ran.id,
      name: ran.name,
      standing: getScenarioStanding(ran, form),
      passed: ran.lastRun?.passed ?? 0,
      failed: ran.lastRun?.failed ?? 0,
    };
  });

  return { study: nextStudy, summaries };
}
