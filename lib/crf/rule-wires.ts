/**
 * Visual-wire projection of sentence rules (#674).
 *
 * The natural-language rule editor (the sentence view in the Logic tab) and
 * the optional visual-wire editor are two views over ONE representation: the
 * `EditCheckRule` objects on a form. This module never introduces a second
 * rule model. It projects rules into source-to-target connections for
 * drawing and listing, and it offers pure edit operations that write straight
 * back onto `EditCheckRule`, so whichever view an author uses, the other one
 * reads exactly what was written.
 *
 * Nothing is simplified away. Condition groups, legacy flat conditions,
 * cross-visit comparators, field-to-field comparisons and preserved
 * unsupported expressions all survive the projection. Anything the wire view
 * cannot edit safely is still projected, marked read-only and given a reason
 * the author can read, and `rulesFromWireGraph` rebuilds the original rules
 * from a projection, which is how the round trip is demonstrated.
 */

import type {
  AstCondition,
  AstOperator,
  CRFField,
  ConditionGroup,
  EditCheckRule,
} from "./types";

/** The rule actions the wire view can create and configure. */
export type WireActionType = EditCheckRule["actionType"];

/** Every action the wire view supports, in display order. */
export const WIRE_ACTION_TYPES: readonly WireActionType[] = [
  "raise_query",
  "show_field",
  "hide_field",
  "require_field",
  "set_value",
];

/** Short author-facing names for each supported action. */
export const WIRE_ACTION_LABELS: Readonly<Record<WireActionType, string>> = {
  raise_query: "Raise query",
  show_field: "Show field",
  hide_field: "Hide field",
  require_field: "Make mandatory",
  set_value: "Derive value",
};

/**
 * Operators the wire configuration surface edits. `in` is projected and
 * preserved, but its list value is shown read-only.
 */
export const WIRE_EDITABLE_OPERATORS: readonly AstOperator[] = [
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "contains",
  "is_empty",
  "is_not_empty",
];

const OPERATOR_PHRASES: Readonly<Record<AstOperator, string>> = {
  eq: "equals",
  neq: "does not equal",
  gt: "is greater than",
  gte: "is greater than or equal to",
  lt: "is less than",
  lte: "is less than or equal to",
  in: "is one of",
  contains: "contains",
  is_empty: "is empty",
  is_not_empty: "is not empty",
};

/** What a wire represents within its rule. */
export type RuleWireRole = "condition" | "comparison" | "trigger";

/** One drawable, listable source-to-target connection. */
export interface RuleWire {
  /**
   * Derived only from the rule id, the group id and the condition's position
   * in that group, never from layout or selection, so a wire keeps its id
   * when the canvas is resized or a different field is selected.
   */
  id: string;
  ruleId: string;
  role: RuleWireRole;
  /** Field id (or variable name) exactly as the rule references it. */
  sourceFieldId: string;
  targetFieldId: string;
  actionType: string;
  /** Present for condition and comparison wires. */
  groupId?: string;
  groupIndex?: number;
  conditionIndex?: number;
  /** A copy of the condition this wire carries, for condition wires. */
  condition?: AstCondition;
  editable: boolean;
  /** Why this wire is read-only, when it is. */
  readOnlyReason?: string;
  /** A complete sentence describing the connection, for lists and screen readers. */
  description: string;
}

/** One condition group as the wire view sees it. */
export interface RuleWireGroup {
  id: string;
  logicalOperator: "AND" | "OR";
  /** Ids of the condition wires in this group, in condition order. */
  conditionWireIds: string[];
}

/** One rule projected into wires. */
export interface RuleWireRuleView {
  ruleId: string;
  ruleName: string;
  actionType: string;
  targetFieldId: string;
  /** False when the whole rule must be shown read-only. */
  supported: boolean;
  readOnlyReason?: string;
  /** The natural-language rendering, identical to describeRuleLogic. */
  sentence: string;
  /** "grouped" when the rule carries explicit conditionGroups. */
  representation: "legacy" | "grouped";
  groups: RuleWireGroup[];
  groupLogicalOperator?: "AND" | "OR";
  triggerFieldIds: string[];
  wires: RuleWire[];
  /**
   * Everything the wire view does not own (name, query text, formula,
   * preserved unsupported expressions, and the legacy flat mirror of a
   * grouped rule), carried through untouched.
   */
  passthrough: Partial<EditCheckRule>;
  /** Which wire-owned keys were present on the rule, so absent stays absent. */
  ownedKeys: Array<keyof EditCheckRule>;
}

/** The whole form's rules as wires. */
export interface RuleWireGraph {
  rules: RuleWireRuleView[];
  wires: RuleWire[];
  /** Distinct source references, in first-seen order. */
  sourceFieldIds: string[];
  /** Distinct target references, in first-seen order. */
  targetFieldIds: string[];
}

const OWNED_KEYS: ReadonlyArray<keyof EditCheckRule> = [
  "actionType",
  "targetFieldId",
  "triggerFieldIds",
  "conditions",
  "logicalOperator",
  "conditionGroups",
  "groupLogicalOperator",
];

function fieldName(ref: string, fields: CRFField[]): string {
  const field = fields.find((f) => f.id === ref || f.variableName === ref);
  return field ? field.variableName : ref || "(no field)";
}

function isSupportedAction(action: string): action is WireActionType {
  return (WIRE_ACTION_TYPES as readonly string[]).includes(action);
}

function hasGroups(rule: EditCheckRule): boolean {
  return Array.isArray(rule.conditionGroups) && rule.conditionGroups.length > 0;
}

/**
 * The groups a rule evaluates with, using the same precedence as the
 * evaluator: explicit groups when present, otherwise the legacy flat
 * conditions as one implicit group.
 */
function groupsOf(rule: EditCheckRule): ConditionGroup[] {
  if (hasGroups(rule)) return rule.conditionGroups as ConditionGroup[];
  return [
    {
      id: "legacy",
      logicalOperator: rule.logicalOperator === "OR" ? "OR" : "AND",
      conditions: Array.isArray(rule.conditions) ? rule.conditions : [],
    },
  ];
}

/** Why a rule cannot be edited from the wire view, or undefined when it can. */
export function getRuleWireReadOnlyReason(
  rule: EditCheckRule
): string | undefined {
  if (rule.unsupportedExpression) {
    return `Unsupported expression preserved read-only (${rule.unsupportedExpression.reason}). It will not fire until reviewed.`;
  }
  if (!isSupportedAction(rule.actionType)) {
    return `Unsupported action "${String(rule.actionType)}" preserved read-only.`;
  }
  return undefined;
}

/** Why one condition cannot be edited from the wire view, or undefined when it can. */
export function getConditionWireReadOnlyReason(
  condition: AstCondition
): string | undefined {
  if (!(condition.operator in OPERATOR_PHRASES)) {
    return `Unsupported operator "${String(condition.operator)}" preserved read-only.`;
  }
  if (Array.isArray(condition.value) || condition.operator === "in") {
    return "List membership is preserved but edited only in the sentence view.";
  }
  return undefined;
}

function formatValue(value: AstCondition["value"]): string {
  if (Array.isArray(value)) return `[${value.join(", ")}]`;
  if (value === "" || value === undefined || value === null) return '""';
  return typeof value === "string" ? `"${value}"` : String(value);
}

/** The natural-language phrase for one condition, without evaluation. */
export function describeConditionLogic(
  condition: AstCondition,
  fields: CRFField[]
): string {
  const subject = condition.crossVisitId
    ? `${fieldName(condition.fieldId, fields)} at visit ${condition.crossVisitId}`
    : fieldName(condition.fieldId, fields);
  const phrase =
    OPERATOR_PHRASES[condition.operator] ??
    `[unsupported operator "${String(condition.operator)}"]`;
  if (
    condition.operator === "is_empty" ||
    condition.operator === "is_not_empty"
  ) {
    return `${subject} ${phrase}`;
  }
  const object =
    condition.compareFieldId !== undefined
      ? `field ${fieldName(condition.compareFieldId, fields)}`
      : formatValue(condition.value);
  return `${subject} ${phrase} ${object}`;
}

function describeAction(rule: EditCheckRule, fields: CRFField[]): string {
  const target = fieldName(rule.targetFieldId, fields);
  switch (rule.actionType) {
    case "show_field":
      return `show ${target}`;
    case "hide_field":
      return `hide ${target}`;
    case "require_field":
      return `make ${target} mandatory`;
    case "raise_query": {
      const severity = rule.querySeverity ?? "warning";
      return rule.queryMessage
        ? `raise a ${severity} query on ${target} (message: "${rule.queryMessage}")`
        : `raise a ${severity} query on ${target}`;
    }
    case "set_value":
      return rule.formulaExpression
        ? `derive ${target} = ${rule.formulaExpression}`
        : `derive ${target} (no formula yet)`;
    default:
      return `perform unsupported action "${String(rule.actionType)}" on ${target}`;
  }
}

/**
 * The canonical natural-language rendering of a rule's logic. Both the
 * sentence view and the wire view show this text, and it is computed from
 * the rule alone, so equal sentences mean equal logic.
 */
export function describeRuleLogic(
  rule: EditCheckRule,
  fields: CRFField[]
): string {
  const action = describeAction(rule, fields);
  const groups = groupsOf(rule);
  const outer = hasGroups(rule) ? (rule.groupLogicalOperator ?? "AND") : "AND";
  const groupText = groups.map((group) =>
    group.conditions.length === 0
      ? "(always true)"
      : `(${group.conditions
          .map((c) => describeConditionLogic(c, fields))
          .join(` ${group.logicalOperator} `)})`
  );
  const noConditions = groups.every((g) => g.conditions.length === 0);
  const body = noConditions
    ? `Always ${action}.`
    : `When ${groupText.join(` ${outer} `)}, ${action}.`;
  return rule.unsupportedExpression
    ? `${body} Unsupported expression preserved read-only (${rule.unsupportedExpression.reason}); this rule will not fire.`
    : body;
}

function wireId(
  ruleId: string,
  groupKey: string,
  index: number,
  suffix = ""
): string {
  return `${ruleId}::${groupKey}::c${index}${suffix}`;
}

/** Project one rule into its wires, without changing it. */
export function projectRuleToWires(
  rule: EditCheckRule,
  fields: CRFField[]
): RuleWireRuleView {
  const ruleReadOnly = getRuleWireReadOnlyReason(rule);
  const grouped = hasGroups(rule);
  const groups = groupsOf(rule);
  const actionLabel = isSupportedAction(rule.actionType)
    ? WIRE_ACTION_LABELS[rule.actionType]
    : `Unsupported action "${String(rule.actionType)}"`;
  const target = fieldName(rule.targetFieldId, fields);
  const wires: RuleWire[] = [];
  const conditionSources = new Set<string>();

  const wireGroups: RuleWireGroup[] = groups.map((group, groupIndex) => {
    const groupKey = grouped ? `g:${group.id}` : "legacy";
    const conditionWireIds: string[] = [];
    group.conditions.forEach((condition, conditionIndex) => {
      const conditionReadOnly =
        ruleReadOnly ?? getConditionWireReadOnlyReason(condition);
      const id = wireId(rule.id, groupKey, conditionIndex);
      const position =
        groups.length > 1
          ? `condition ${conditionIndex + 1} of group ${groupIndex + 1}`
          : `condition ${conditionIndex + 1}`;
      conditionSources.add(condition.fieldId);
      conditionWireIds.push(id);
      wires.push({
        id,
        ruleId: rule.id,
        role: "condition",
        sourceFieldId: condition.fieldId,
        targetFieldId: rule.targetFieldId,
        actionType: rule.actionType,
        groupId: group.id,
        groupIndex,
        conditionIndex,
        condition: { ...condition },
        editable: conditionReadOnly === undefined,
        readOnlyReason: conditionReadOnly,
        description: `${fieldName(condition.fieldId, fields)} to ${target}: ${actionLabel} when ${describeConditionLogic(condition, fields)} (${position}, rule "${rule.name}")${conditionReadOnly ? ". Read-only." : "."}`,
      });
      if (condition.compareFieldId !== undefined) {
        conditionSources.add(condition.compareFieldId);
        wires.push({
          id: wireId(rule.id, groupKey, conditionIndex, "::compare"),
          ruleId: rule.id,
          role: "comparison",
          sourceFieldId: condition.compareFieldId,
          targetFieldId: rule.targetFieldId,
          actionType: rule.actionType,
          groupId: group.id,
          groupIndex,
          conditionIndex,
          editable: conditionReadOnly === undefined,
          readOnlyReason: conditionReadOnly,
          description: `${fieldName(condition.compareFieldId, fields)} to ${target}: compared against ${fieldName(condition.fieldId, fields)} in ${position} (rule "${rule.name}").`,
        });
      }
    });
    return {
      id: group.id,
      logicalOperator: group.logicalOperator,
      conditionWireIds,
    };
  });

  const triggers = Array.isArray(rule.triggerFieldIds)
    ? rule.triggerFieldIds
    : [];
  triggers.forEach((trigger) => {
    if (conditionSources.has(trigger)) return;
    wires.push({
      id: `${rule.id}::trigger::${trigger}`,
      ruleId: rule.id,
      role: "trigger",
      sourceFieldId: trigger,
      targetFieldId: rule.targetFieldId,
      actionType: rule.actionType,
      editable: false,
      readOnlyReason:
        "Trigger-only reference: re-evaluates the rule but carries no condition.",
      description: `${fieldName(trigger, fields)} to ${target}: re-evaluates rule "${rule.name}" when it changes (trigger only).`,
    });
  });

  const passthrough: Partial<EditCheckRule> = { ...rule };
  for (const key of OWNED_KEYS) delete passthrough[key];
  if (grouped) {
    // A grouped rule's flat fields are a compatibility mirror that imported
    // data may not keep in sync; carry them verbatim rather than recompute.
    if ("conditions" in rule) passthrough.conditions = rule.conditions;
    if ("logicalOperator" in rule)
      passthrough.logicalOperator = rule.logicalOperator;
  }

  return {
    ruleId: rule.id,
    ruleName: rule.name,
    actionType: rule.actionType,
    targetFieldId: rule.targetFieldId,
    supported: ruleReadOnly === undefined,
    readOnlyReason: ruleReadOnly,
    sentence: describeRuleLogic(rule, fields),
    representation: grouped ? "grouped" : "legacy",
    groups: wireGroups,
    groupLogicalOperator: rule.groupLogicalOperator,
    triggerFieldIds: [...triggers],
    wires,
    passthrough,
    ownedKeys: OWNED_KEYS.filter((key) => key in rule),
  };
}

/** Project every rule on a form into one wire graph. */
export function buildRuleWireGraph(
  rules: EditCheckRule[],
  fields: CRFField[]
): RuleWireGraph {
  const views = rules.map((rule) => projectRuleToWires(rule, fields));
  const wires = views.flatMap((view) => view.wires);
  const sources: string[] = [];
  const targets: string[] = [];
  wires.forEach((wire) => {
    if (!sources.includes(wire.sourceFieldId)) sources.push(wire.sourceFieldId);
    if (!targets.includes(wire.targetFieldId)) targets.push(wire.targetFieldId);
  });
  return {
    rules: views,
    wires,
    sourceFieldIds: sources,
    targetFieldIds: targets,
  };
}

/** Rebuild one rule from its wire projection. */
export function ruleFromWireView(view: RuleWireRuleView): EditCheckRule {
  const byId = new Map(view.wires.map((wire) => [wire.id, wire]));
  const groups: ConditionGroup[] = view.groups.map((group) => ({
    id: group.id,
    logicalOperator: group.logicalOperator,
    conditions: group.conditionWireIds.map((id) => {
      const condition = byId.get(id)?.condition;
      return condition
        ? { ...condition }
        : { fieldId: "", operator: "eq", value: "" };
    }),
  }));
  const owned: Partial<EditCheckRule> = {
    actionType: view.actionType as WireActionType,
    targetFieldId: view.targetFieldId,
    triggerFieldIds: [...view.triggerFieldIds],
  };
  if (view.representation === "grouped") {
    owned.conditionGroups = groups;
    if (view.groupLogicalOperator !== undefined) {
      owned.groupLogicalOperator = view.groupLogicalOperator;
    }
  } else {
    const [legacy] = groups;
    owned.conditions = legacy ? legacy.conditions : [];
    owned.logicalOperator = legacy ? legacy.logicalOperator : "AND";
    if (view.groupLogicalOperator !== undefined) {
      owned.groupLogicalOperator = view.groupLogicalOperator;
    }
  }
  const rebuilt: Partial<EditCheckRule> = { ...view.passthrough };
  for (const key of view.ownedKeys) {
    if (key === "conditionGroups" && view.representation === "legacy") {
      // An empty conditionGroups array evaluates as legacy; keep it present.
      rebuilt.conditionGroups = [];
      continue;
    }
    if (key in owned) {
      (rebuilt as Record<string, unknown>)[key] = owned[key];
    }
  }
  return rebuilt as EditCheckRule;
}

/**
 * Rebuild the rules a wire graph was projected from. Projecting rules and
 * rebuilding them returns rules deep-equal to the originals, which is the
 * sentence-to-wires-to-sentence equivalence the wire editor depends on.
 */
export function rulesFromWireGraph(graph: RuleWireGraph): EditCheckRule[] {
  return graph.rules.map(ruleFromWireView);
}

/** Where a condition sits inside a rule. */
export interface WireConditionLocation {
  groupIndex: number;
  conditionIndex: number;
}

/**
 * Write new groups back onto a rule, keeping its shape: a legacy rule stays
 * legacy while it has one group, and a grouped rule keeps its flat mirror
 * pointed at the first group, as the sentence view does.
 */
function commitGroups(
  rule: EditCheckRule,
  groups: ConditionGroup[],
  groupLogicalOperator?: "AND" | "OR"
): EditCheckRule {
  if (!hasGroups(rule) && groups.length === 1) {
    const [only] = groups;
    return {
      ...rule,
      conditions: only.conditions,
      logicalOperator: only.logicalOperator,
    };
  }
  const first = groups[0];
  return {
    ...rule,
    conditionGroups: groups.map((group, index) =>
      !hasGroups(rule) && index === 0 && group.id === "legacy"
        ? { ...group, id: `${rule.id}_group_1` }
        : group
    ),
    groupLogicalOperator:
      groupLogicalOperator ?? rule.groupLogicalOperator ?? "AND",
    conditions: first ? first.conditions : [],
    logicalOperator: first ? first.logicalOperator : "AND",
  };
}

function isConditionEditable(
  rule: EditCheckRule,
  location: WireConditionLocation
): boolean {
  if (getRuleWireReadOnlyReason(rule)) return false;
  const condition =
    groupsOf(rule)[location.groupIndex]?.conditions[location.conditionIndex];
  return (
    condition !== undefined &&
    getConditionWireReadOnlyReason(condition) === undefined
  );
}

/** Input for creating a rule from a new wire. */
export interface CreateWireRuleInput {
  id: string;
  sourceFieldId: string;
  targetFieldId: string;
  actionType: WireActionType;
  fields: CRFField[];
}

/**
 * Create a rule from a source-to-target connection. The new rule uses the
 * same flat shape the sentence view creates, so it opens there unchanged.
 */
export function createWireRule(input: CreateWireRuleInput): EditCheckRule {
  const source = fieldName(input.sourceFieldId, input.fields);
  const target = fieldName(input.targetFieldId, input.fields);
  const rule: EditCheckRule = {
    id: input.id,
    name: `${WIRE_ACTION_LABELS[input.actionType]}: ${source} to ${target}`,
    description: "Created from a visual wire",
    triggerFieldIds: [input.sourceFieldId],
    actionType: input.actionType,
    targetFieldId: input.targetFieldId,
    conditions: [
      { fieldId: input.sourceFieldId, operator: "is_not_empty", value: "" },
    ],
    logicalOperator: "AND",
  };
  if (input.actionType === "raise_query") {
    rule.querySeverity = "warning";
    rule.queryMessage = `Please review ${target}.`;
  }
  if (input.actionType === "set_value") {
    rule.formulaExpression = source;
  }
  return rule;
}

/**
 * Connect another source field to an existing rule by adding a condition on
 * it to the given group. Read-only rules are returned unchanged.
 */
export function connectWireSource(
  rule: EditCheckRule,
  sourceFieldId: string,
  groupIndex = 0
): EditCheckRule {
  if (getRuleWireReadOnlyReason(rule)) return rule;
  const groups = groupsOf(rule);
  if (!groups[groupIndex]) return rule;
  const condition: AstCondition = {
    fieldId: sourceFieldId,
    operator: "is_not_empty",
    value: "",
  };
  const next = commitGroups(
    rule,
    groups.map((group, index) =>
      index === groupIndex
        ? { ...group, conditions: [...group.conditions, condition] }
        : group
    )
  );
  return next.triggerFieldIds.includes(sourceFieldId)
    ? next
    : { ...next, triggerFieldIds: [...next.triggerFieldIds, sourceFieldId] };
}

/** Change one condition carried by a wire. Read-only conditions are left alone. */
export function updateWireCondition(
  rule: EditCheckRule,
  location: WireConditionLocation,
  updates: Partial<AstCondition>
): EditCheckRule {
  if (!isConditionEditable(rule, location)) return rule;
  return commitGroups(
    rule,
    groupsOf(rule).map((group, gi) =>
      gi === location.groupIndex
        ? {
            ...group,
            conditions: group.conditions.map((condition, ci) => {
              if (ci !== location.conditionIndex) return condition;
              const merged: AstCondition = { ...condition, ...updates };
              if (
                "compareFieldId" in updates &&
                updates.compareFieldId === undefined
              ) {
                delete merged.compareFieldId;
              }
              return merged;
            }),
          }
        : group
    )
  );
}

/** Disconnect a condition wire by removing its condition. */
export function removeWireCondition(
  rule: EditCheckRule,
  location: WireConditionLocation
): EditCheckRule {
  if (!isConditionEditable(rule, location)) return rule;
  return commitGroups(
    rule,
    groupsOf(rule).map((group, gi) =>
      gi === location.groupIndex
        ? {
            ...group,
            conditions: group.conditions.filter(
              (_, ci) => ci !== location.conditionIndex
            ),
          }
        : group
    )
  );
}

/** Set how the conditions inside one group combine. */
export function setWireGroupOperator(
  rule: EditCheckRule,
  groupIndex: number,
  logicalOperator: "AND" | "OR"
): EditCheckRule {
  if (getRuleWireReadOnlyReason(rule)) return rule;
  const groups = groupsOf(rule);
  if (!groups[groupIndex]) return rule;
  return commitGroups(
    rule,
    groups.map((group, index) =>
      index === groupIndex ? { ...group, logicalOperator } : group
    )
  );
}

/** Set how groups combine. Only meaningful for a rule with explicit groups. */
export function setWireOuterOperator(
  rule: EditCheckRule,
  groupLogicalOperator: "AND" | "OR"
): EditCheckRule {
  if (getRuleWireReadOnlyReason(rule) || !hasGroups(rule)) return rule;
  return { ...rule, groupLogicalOperator };
}

/**
 * Change rule-level configuration (action, target, query text, formula,
 * name) from the wire surface. Wire-owned condition keys are ignored here;
 * use the condition operations instead.
 */
export function configureWireRule(
  rule: EditCheckRule,
  updates: Partial<
    Pick<
      EditCheckRule,
      | "actionType"
      | "targetFieldId"
      | "name"
      | "querySeverity"
      | "queryMessage"
      | "formulaExpression"
    >
  >
): EditCheckRule {
  if (getRuleWireReadOnlyReason(rule)) return rule;
  if (
    updates.actionType !== undefined &&
    !isSupportedAction(updates.actionType)
  ) {
    return rule;
  }
  return { ...rule, ...updates };
}
