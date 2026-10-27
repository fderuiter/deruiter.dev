/**
 * Conditional visibility and requiredness runtime for sentence rules (#670).
 *
 * The authoring surface has long been able to declare `show_field`,
 * `hide_field` and `require_field` actions, but nothing applied them when a
 * form was actually filled in: the EDC simulator only ever acted on
 * `raise_query`. This module closes that gap by resolving a form's rules into
 * one explicit per-field state that validation and rendering both read, so the
 * two can never disagree about whether a control is on screen or mandatory.
 *
 * It is deliberately pure. It reads values and returns state, and it never
 * mutates, clears or deletes a field value - a hidden field keeps whatever was
 * captured before it was hidden, and says so through `retainsHiddenValue`.
 *
 * Evaluation reuses the four-valued discrepancy engine from #540 rather than
 * collapsing to a boolean, which is what lets an undecidable rule be reported
 * as undecidable instead of silently behaving like a rule that did not fire.
 */

import type {
  CRFField,
  CRFForm,
  ConditionResult,
  EditCheckRule,
} from "../types";
import { evaluateRuleResult, explainRule } from "./expression-evaluator";

/**
 * The rule actions this runtime resolves. `raise_query` and `set_value` are
 * deliberately excluded: they do not participate in visibility or
 * requiredness, and the simulator already handles queries separately.
 */
export type ConditionalActionType =
  "show_field" | "hide_field" | "require_field";

const CONDITIONAL_ACTIONS: ReadonlySet<string> = new Set([
  "show_field",
  "hide_field",
  "require_field",
]);

/**
 * Field values as captured by the form runtime.
 */
export type ConditionalFieldValues = Record<
  string,
  string | number | boolean | null | undefined
>;

/**
 * Why a field ended up visible, hidden or required - the specific rule
 * responsible, and the sentence explaining how it evaluated.
 */
export interface RuleAttribution {
  ruleId: string;
  ruleName: string;
  actionType: ConditionalActionType;
  /** Four-valued outcome of the rule's conditions. */
  result: ConditionResult;
  /** Human-readable explanation drawn from the shared rule explainer. */
  summary: string;
}

/**
 * A rule that fired but did not get its way, recorded so an author can see
 * that two rules disagreed rather than silently losing one of them.
 */
export interface ConditionalConflict {
  fieldId: string;
  /** The attribution that took effect. */
  winner: RuleAttribution;
  /** Attributions that fired for the same field but were overridden. */
  overridden: RuleAttribution[];
  reason: string;
}

/**
 * Resolved conditional state for a single field.
 */
export interface FieldConditionalState {
  fieldId: string;
  /** The field's CDASH variable name, for callers that key values by name. */
  variableName: string;
  visible: boolean;
  required: boolean;
  /** The field's authored `required` flag, before any rule was applied. */
  declaredRequired: boolean;
  /** Rule that decided visibility, or null when the declared default stands. */
  visibilitySource: RuleAttribution | null;
  /** Rule that decided requiredness, or null when the declared default stands. */
  requirednessSource: RuleAttribution | null;
  /**
   * Rules targeting this field whose conditions could not be decided, because
   * an operand was missing or the comparison was incompatible. These never
   * change state; they are surfaced so the indeterminacy stays visible.
   */
  indeterminate: RuleAttribution[];
  /**
   * Whether the field currently holds a captured value, resolved once using
   * the same key precedence the rule evaluator uses, so callers never have to
   * guess whether values are keyed by id, variable name or visit scope.
   */
  hasValue: boolean;
  /**
   * True when the field is hidden and still holds a captured value. Hidden
   * values are retained, never cleared, so this is the signal a caller needs
   * to decide how to treat them at validation or export time.
   */
  retainsHiddenValue: boolean;
}

/**
 * Resolved conditional state for a whole form.
 */
export interface FormConditionalState {
  fields: Record<string, FieldConditionalState>;
  conflicts: ConditionalConflict[];
}

/**
 * Precedence, stated once so both the runtime and its tests agree.
 *
 * - Hide beats show. When a `hide_field` rule and a `show_field` rule both
 *   fire for the same field, the field is hidden. Concealment is the
 *   protocol-preserving outcome: a rule written to withhold a question should
 *   not be defeated by a broader rule written to reveal it.
 * - Hidden implies not required. A mandatory control the investigator cannot
 *   see would make the form unsubmittable with no way to resolve it, so
 *   requiredness is suppressed while hidden. The authored flag is preserved in
 *   `declaredRequired` and returns intact if the field becomes visible again.
 * - Require is additive. A firing `require_field` can make an optional field
 *   mandatory; nothing in this module makes an authored-required field
 *   optional except being hidden.
 * - Only a `true` result acts. A `false`, `missing` or `incompatible` result
 *   leaves the field's declared defaults alone. Undecidable rules are reported
 *   through `indeterminate` rather than being treated as confident negatives.
 */
export const CONDITIONAL_PRECEDENCE_NOTES = [
  "hide_field overrides show_field when both fire for the same field",
  "a hidden field is never required, and its declared requiredness is preserved",
  "require_field only adds requiredness; it never removes it",
  "only a true result applies an action; false, missing and incompatible do not",
  "values on hidden fields are retained, never cleared",
] as const;

function isConditionalRule(
  rule: EditCheckRule
): rule is EditCheckRule & { actionType: ConditionalActionType } {
  return CONDITIONAL_ACTIONS.has(rule.actionType);
}

function hasCapturedValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/**
 * Reads a field's captured value using the same key precedence as the rule
 * evaluator: visit-scoped keys first when a visit is in context, then the
 * field id, then the CDASH variable name. Keeping this aligned means a form
 * whose values are keyed by variable name resolves identically to one keyed
 * by id.
 */
function readCapturedValue(
  field: CRFField,
  fieldValues: ConditionalFieldValues,
  visitContext?: string
): string | number | boolean | null | undefined {
  if (visitContext) {
    const scopedById = fieldValues[`${visitContext}_${field.id}`];
    if (scopedById !== undefined) return scopedById;
    const scopedByName = fieldValues[`${visitContext}_${field.variableName}`];
    if (scopedByName !== undefined) return scopedByName;
  }
  const byId = fieldValues[field.id];
  if (byId !== undefined) return byId;
  return fieldValues[field.variableName];
}

function matchesTarget(rule: EditCheckRule, field: CRFField): boolean {
  return (
    rule.targetFieldId === field.id || rule.targetFieldId === field.variableName
  );
}

/**
 * Resolves every field's visibility and requiredness for one form, given the
 * values captured so far.
 *
 * Callers should treat the returned state as the single source of truth:
 * render a field only when `visible`, and enforce requiredness only when
 * `required`. Because both come from the same pass, an accessible control and
 * the validator cannot drift apart.
 *
 * @param fields - Fields to resolve, normally a form's flattened field list.
 * @param rules - Candidate rules. Non-conditional actions are ignored.
 * @param fieldValues - Values captured so far, keyed as the evaluator expects.
 * @param visitContext - Optional visit id for cross-visit comparators.
 */
export function resolveFormConditionalState(
  fields: CRFField[],
  rules: EditCheckRule[],
  fieldValues: ConditionalFieldValues,
  visitContext?: string
): FormConditionalState {
  const conditionalRules = (rules || []).filter(isConditionalRule);
  const fieldStates: Record<string, FieldConditionalState> = {};
  const conflicts: ConditionalConflict[] = [];

  for (const field of fields) {
    const key = field.id;
    const declaredRequired = Boolean(field.required);
    const fieldHasValue = hasCapturedValue(
      readCapturedValue(field, fieldValues, visitContext)
    );

    const shows: RuleAttribution[] = [];
    const hides: RuleAttribution[] = [];
    const requires: RuleAttribution[] = [];
    const indeterminate: RuleAttribution[] = [];

    for (const rule of conditionalRules) {
      if (!matchesTarget(rule, field)) continue;

      const result = evaluateRuleResult(
        rule,
        fieldValues,
        fields,
        visitContext
      );

      const attribution: RuleAttribution = {
        ruleId: rule.id,
        ruleName: rule.name,
        actionType: rule.actionType,
        result,
        summary: explainRule(rule, fieldValues, fields, visitContext).summary,
      };

      if (result === "missing" || result === "incompatible") {
        indeterminate.push(attribution);
        continue;
      }
      if (result !== "true") continue;

      if (rule.actionType === "show_field") shows.push(attribution);
      else if (rule.actionType === "hide_field") hides.push(attribution);
      else requires.push(attribution);
    }

    // Visibility. A field with no firing visibility rule keeps the default of
    // being on screen; an explicit show rule is recorded even though it agrees
    // with that default, so the author can see what is holding the field open.
    let visible = true;
    let visibilitySource: RuleAttribution | null = null;

    if (hides.length > 0) {
      visible = false;
      visibilitySource = hides[0];
      if (shows.length > 0) {
        conflicts.push({
          fieldId: key,
          winner: hides[0],
          overridden: shows,
          reason:
            "hide_field takes precedence over show_field when both fire for the same field",
        });
      }
    } else if (shows.length > 0) {
      visible = true;
      visibilitySource = shows[0];
    }

    // Requiredness. Suppressed entirely while hidden so the form stays
    // submittable, but the declared flag is preserved for restoration.
    let required = declaredRequired;
    let requirednessSource: RuleAttribution | null = null;

    if (requires.length > 0) {
      required = true;
      requirednessSource = requires[0];
    }

    if (!visible && required) {
      required = false;
      if (requires.length > 0) {
        conflicts.push({
          fieldId: key,
          winner: visibilitySource as RuleAttribution,
          overridden: requires,
          reason:
            "a hidden field cannot be required, so requiredness is suppressed while it is off screen",
        });
      }
      requirednessSource = null;
    }

    fieldStates[key] = {
      fieldId: key,
      variableName: field.variableName,
      visible,
      required,
      declaredRequired,
      visibilitySource,
      requirednessSource,
      indeterminate,
      hasValue: fieldHasValue,
      retainsHiddenValue: !visible && fieldHasValue,
    };
  }

  return { fields: fieldStates, conflicts };
}

/**
 * Convenience wrapper that resolves conditional state directly from a form,
 * flattening its sections and using the form's own rule list.
 */
export function resolveFormConditionalStateForForm(
  form: CRFForm,
  fieldValues: ConditionalFieldValues,
  visitContext?: string
): FormConditionalState {
  const fields = (form.sections || []).flatMap((section) => section.fields);
  return resolveFormConditionalState(
    fields,
    form.rules || [],
    fieldValues,
    visitContext
  );
}

/**
 * Returns the fields a validator should treat as mandatory: visible, resolved
 * as required, and currently empty.
 *
 * Using this keeps validation aligned with what is actually on screen, which
 * is the agreement the conditional runtime exists to guarantee.
 */
export function getUnsatisfiedRequiredFields(
  state: FormConditionalState
): FieldConditionalState[] {
  return Object.values(state.fields).filter(
    (field) => field.visible && field.required && !field.hasValue
  );
}

/**
 * Returns hidden fields that still hold captured values.
 *
 * Nothing in this module deletes them. Surfacing them lets a caller decide
 * explicitly - prompt the investigator, exclude them from an export, or leave
 * them in place - rather than discovering the values were dropped silently.
 */
export function getRetainedHiddenValues(
  state: FormConditionalState
): FieldConditionalState[] {
  return Object.values(state.fields).filter(
    (field) => field.retainsHiddenValue
  );
}

/**
 * Builds a short sentence explaining why a field is in its current state,
 * suitable for an inspector panel or an accessible description.
 */
export function describeFieldConditionalState(
  state: FieldConditionalState
): string {
  const parts: string[] = [];

  if (state.visibilitySource) {
    parts.push(
      state.visible
        ? `Shown by "${state.visibilitySource.ruleName}"`
        : `Hidden by "${state.visibilitySource.ruleName}"`
    );
  } else {
    parts.push(state.visible ? "Shown by default" : "Hidden");
  }

  if (!state.visible && state.declaredRequired) {
    parts.push("requiredness suppressed while hidden");
  } else if (state.requirednessSource) {
    parts.push(`required by "${state.requirednessSource.ruleName}"`);
  } else if (state.required) {
    parts.push("required by field definition");
  } else {
    parts.push("optional");
  }

  if (state.retainsHiddenValue) {
    parts.push("previously captured value retained");
  }

  if (state.indeterminate.length > 0) {
    const names = state.indeterminate
      .map((attribution) => `"${attribution.ruleName}"`)
      .join(", ");
    parts.push(`could not evaluate ${names}`);
  }

  return `${parts.join("; ")}.`;
}
