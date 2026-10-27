/**
 * In-builder form test harness (#541).
 *
 * Lets an author exercise the form they are designing without leaving the
 * designer, using the same runtime the EDC simulator uses rather than a
 * parallel approximation: the shared calculation evaluator, the four-valued
 * rule engine, and the conditional visibility runtime. A form that behaves one
 * way in the test dock and another way in the simulator would make the dock
 * worse than useless, so all three are composed here rather than reimplemented.
 *
 * Values are addressed by an explicit subject, visit and field triple, so
 * filling or resetting one visit can never disturb another, and the harness
 * itself is pure - it returns new value maps instead of mutating the one it
 * was handed.
 */

import type {
  CRFField,
  CRFForm,
  CodelistDefinition,
  ConditionResult,
  EditCheckRule,
} from "../types";
import {
  explainCalculationDerivation,
  explainRule,
  type DerivationExplanation,
  type RuleExplanation,
} from "./expression-evaluator";
import {
  resolveFormConditionalState,
  getUnsatisfiedRequiredFields,
  type ConditionalFieldValues,
  type FieldConditionalState,
  type FormConditionalState,
} from "./conditional-logic";

/**
 * Identifies which synthetic record a value belongs to. Keeping subject and
 * visit explicit is what allows one form definition to be tested against
 * several records without the results bleeding together.
 */
export interface FormTestScope {
  subjectId: string;
  visitId: string;
}

/** The default synthetic record the dock opens on. */
export const DEFAULT_TEST_SCOPE: FormTestScope = {
  subjectId: "TEST-001",
  visitId: "test_visit",
};

/**
 * Builds the storage key for one field within one scope. This mirrors the key
 * shape the EDC simulator already uses, so values captured in the dock remain
 * legible to the same tooling.
 */
export function buildScopedKey(scope: FormTestScope, fieldId: string): string {
  return `${scope.subjectId}_${scope.visitId}_${fieldId}`;
}

/** Returns every field on a form, flattened across its sections. */
export function flattenFormFields(form: CRFForm): CRFField[] {
  return (form.sections || []).flatMap((section) => section.fields || []);
}

/**
 * Resolves the option codes a coded field can legitimately take, preferring
 * the field's own inline options and falling back to the study codelist it
 * references.
 *
 * Without the codelist lookup a coded field would be filled with a
 * placeholder that is not a member of its own codelist - and, for scored
 * instruments whose codes are numeric, would silently break every calculation
 * downstream of it.
 */
function resolveOptionCodes(
  field: CRFField,
  codelists?: CodelistDefinition[]
): string[] {
  const inline = (field.customOptions || [])
    .map((option) => option.code)
    .filter(Boolean);
  if (inline.length > 0) return inline;

  if (field.codelistId && codelists) {
    const codelist = codelists.find(
      (candidate) => candidate.id === field.codelistId
    );
    const codes = (codelist?.options || [])
      .map((option) => option.code)
      .filter(Boolean);
    if (codes.length > 0) return codes;
  }

  return [];
}

/**
 * Deterministic sample value for one field.
 *
 * Deterministic rather than random on purpose: an author comparing two runs
 * needs the difference to come from their edits, not from the sample data
 * moving underneath them, and a test can assert exact values.
 *
 * Pass `codelists` so coded fields receive a genuine member of their own
 * codelist. Omitting it falls back to a placeholder, which is legible but
 * cannot feed a calculation that expects a coded numeric score.
 */
export function buildSampleValue(
  field: CRFField,
  index: number,
  codelists?: CodelistDefinition[]
): string | number | boolean | null {
  const optionCodes = resolveOptionCodes(field, codelists);
  // Rotate through the codelist rather than always taking the first option, so
  // a filled form exercises more than one branch of a coded rule.
  const codedOption =
    optionCodes.length > 0
      ? optionCodes[index % optionCodes.length]
      : undefined;

  switch (field.dataType) {
    case "number":
    case "integer": {
      const min = typeof field.minValue === "number" ? field.minValue : 1;
      const max =
        typeof field.maxValue === "number" ? field.maxValue : min + 99;
      // Walk deterministically through the permitted range.
      const span = Math.max(1, max - min);
      const value = min + ((index * 7) % (span + 1));
      return field.dataType === "integer" ? Math.round(value) : value;
    }
    case "vas_scale":
      return (index * 13) % 101;
    case "nrs_scale":
      return (index * 3) % 11;
    case "date":
    case "partial_date":
    case "precision_date":
      return `2026-0${(index % 9) + 1}-15`;
    case "time":
      return `${String((index % 12) + 8).padStart(2, "0")}:30`;
    case "datetime":
      return `2026-0${(index % 9) + 1}-15T09:30`;
    case "checkbox":
      return index % 2 === 0;
    case "single_select":
    case "multi_select":
    case "radio":
      return codedOption ?? "OPT1";
    case "textarea":
      return `Sample narrative ${index + 1} for ${field.variableName}.`;
    case "signature":
    case "calculated":
    case "repeating_table":
      // Calculated fields are derived, signatures are ceremonial, and
      // repeating tables need their own row editor. None are filled here.
      return null;
    case "text":
    default:
      return `${field.variableName}-${index + 1}`;
  }
}

/**
 * Fills every fillable field on the form for one scope, leaving every other
 * scope's values exactly as they were.
 *
 * Calculated fields are deliberately skipped so the author sees them derive
 * from the sample inputs rather than being handed a value that was never
 * computed. Pass the study's `codelists` so coded fields are filled with real
 * option codes, which is what allows those derivations to evaluate.
 */
export function fillSampleValues(
  form: CRFForm,
  currentValues: ConditionalFieldValues,
  scope: FormTestScope = DEFAULT_TEST_SCOPE,
  codelists?: CodelistDefinition[]
): ConditionalFieldValues {
  const next: ConditionalFieldValues = { ...currentValues };

  flattenFormFields(form).forEach((field, index) => {
    const sample = buildSampleValue(field, index, codelists);
    if (sample === null) return;
    next[buildScopedKey(scope, field.id)] = sample;
  });

  return next;
}

/**
 * Clears this form's values for one scope only.
 *
 * The scope boundary is the point: resetting the record under test must not
 * touch another subject or visit an author has already set up.
 */
export function resetScopeValues(
  form: CRFForm,
  currentValues: ConditionalFieldValues,
  scope: FormTestScope = DEFAULT_TEST_SCOPE
): ConditionalFieldValues {
  const next: ConditionalFieldValues = { ...currentValues };
  for (const field of flattenFormFields(form)) {
    delete next[buildScopedKey(scope, field.id)];
  }
  return next;
}

/**
 * Projects scoped values into the flat, dual-keyed shape the shared evaluators
 * expect, keyed by both field id and CDASH variable name.
 */
export function projectScopedValues(
  form: CRFForm,
  values: ConditionalFieldValues,
  scope: FormTestScope = DEFAULT_TEST_SCOPE
): ConditionalFieldValues {
  const projected: ConditionalFieldValues = {};
  for (const field of flattenFormFields(form)) {
    const value = values[buildScopedKey(scope, field.id)];
    projected[field.id] = value;
    projected[field.variableName] = value;
  }
  return projected;
}

/** A calculated field's derivation, paired with the field it belongs to. */
export interface CalculationOutcome {
  fieldId: string;
  variableName: string;
  label: string;
  derivation: DerivationExplanation;
}

/** One rule's evaluation against the current synthetic record. */
export interface RuleOutcome {
  ruleId: string;
  ruleName: string;
  actionType: EditCheckRule["actionType"];
  targetFieldId: string;
  result: ConditionResult;
  explanation: RuleExplanation;
  /** True only for a rule that both fires and raises a query. */
  raisesQuery: boolean;
  queryMessage?: string;
}

/**
 * Everything the dock shows for one run, derived in a single pass so the
 * panels cannot disagree with each other.
 */
export interface FormTestReport {
  scope: FormTestScope;
  formId: string;
  conditional: FormConditionalState;
  calculations: CalculationOutcome[];
  rules: RuleOutcome[];
  /** Visible, required and still empty. */
  unsatisfiedRequired: FieldConditionalState[];
  /** Counts for the dock's status strip. */
  summary: {
    fieldsVisible: number;
    fieldsHidden: number;
    rulesFired: number;
    rulesUndecidable: number;
    openQueries: number;
    unsatisfiedRequired: number;
  };
}

/**
 * Runs the form against one synthetic record and explains every outcome.
 *
 * Undecidable results are reported as such rather than collapsed into a
 * failure, so an author testing a half-filled form can tell "this rule is
 * waiting on an input" apart from "this rule evaluated and did not fire".
 */
export function runFormTest(
  form: CRFForm,
  values: ConditionalFieldValues,
  scope: FormTestScope = DEFAULT_TEST_SCOPE
): FormTestReport {
  const fields = flattenFormFields(form);
  const projected = projectScopedValues(form, values, scope);

  // Calculations run first, and their results are written back before rules
  // and visibility are resolved. The EDC simulator persists derived values
  // into the record for exactly this reason, so a rule that reads a
  // calculated field (a total score gating a query, say) must see the derived
  // number here too - otherwise the dock would report "waiting on input" for
  // a rule that fires perfectly well in the simulator, which is precisely the
  // divergence this harness exists to prevent.
  const calculations: CalculationOutcome[] = fields
    .filter(
      (field) => field.dataType === "calculated" && field.calculationFormula
    )
    .map((field) => ({
      fieldId: field.id,
      variableName: field.variableName,
      label: field.label,
      derivation: explainCalculationDerivation(
        field.calculationFormula as string,
        projected,
        fields,
        field
      ),
    }));

  const enriched: ConditionalFieldValues = { ...projected };
  for (const calculation of calculations) {
    if (
      calculation.derivation.status === "success" &&
      calculation.derivation.result !== null
    ) {
      enriched[calculation.fieldId] = calculation.derivation.result;
      enriched[calculation.variableName] = calculation.derivation.result;
    }
  }

  const conditional = resolveFormConditionalState(
    fields,
    form.rules || [],
    enriched
  );

  const rules: RuleOutcome[] = (form.rules || []).map((rule) => {
    const explanation = explainRule(rule, enriched, fields);
    const fired = explanation.result === "true";
    return {
      ruleId: rule.id,
      ruleName: rule.name,
      actionType: rule.actionType,
      targetFieldId: rule.targetFieldId,
      result: explanation.result,
      explanation,
      raisesQuery: fired && rule.actionType === "raise_query",
      queryMessage: rule.queryMessage,
    };
  });

  const unsatisfiedRequired = getUnsatisfiedRequiredFields(conditional);
  const states = Object.values(conditional.fields);

  return {
    scope,
    formId: form.id,
    conditional,
    calculations,
    rules,
    unsatisfiedRequired,
    summary: {
      fieldsVisible: states.filter((state) => state.visible).length,
      fieldsHidden: states.filter((state) => !state.visible).length,
      rulesFired: rules.filter((rule) => rule.result === "true").length,
      rulesUndecidable: rules.filter(
        (rule) => rule.result === "missing" || rule.result === "incompatible"
      ).length,
      openQueries: rules.filter((rule) => rule.raisesQuery).length,
      unsatisfiedRequired: unsatisfiedRequired.length,
    },
  };
}

/**
 * Sets one field's value within a scope, returning a new map.
 */
export function setScopedValue(
  values: ConditionalFieldValues,
  scope: FormTestScope,
  fieldId: string,
  value: string | number | boolean | null
): ConditionalFieldValues {
  return { ...values, [buildScopedKey(scope, fieldId)]: value };
}

/**
 * Reads one field's value within a scope.
 */
export function getScopedValue(
  values: ConditionalFieldValues,
  scope: FormTestScope,
  fieldId: string
): string | number | boolean | null | undefined {
  return values[buildScopedKey(scope, fieldId)];
}
