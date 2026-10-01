/**
 * Step-by-Step AST Debugger Engine for Edit Check Rules (#671/#540).
 *
 * Provides deterministic, step-by-step tracing of logical AST condition nodes
 * with short-circuit detection, four-valued truth evaluation (true, false, missing, incompatible),
 * diagnostic warnings, and pre-populated sample subject data profiles.
 */

import {
  AstCondition,
  AstOperator,
  ConditionGroup,
  ConditionResult,
  EditCheckRule,
  CRFField,
} from "./types";
import {
  evaluateConditionResult,
  getRuleGroups,
  combineConditionResults,
  isMissingOrNullFlavor,
} from "./expression-evaluator";

export interface AstDebugStep {
  stepIndex: number;
  nodeId: string;
  nodeType: "condition" | "group" | "rule_summary";
  condition?: AstCondition;
  group?: ConditionGroup;
  fieldId?: string;
  variableName: string;
  actualValue: string | number | boolean | null | undefined;
  operator?: string;
  operatorLabel?: string;
  comparedValue?: string | number | boolean | string[] | null | undefined;
  comparedVariableName?: string;
  result: ConditionResult;
  shortCircuited: boolean;
  shortCircuitReason?: string;
  sentence: string;
  diagnostics: string[];
}

export interface AstRuleDebugTrace {
  ruleId: string;
  ruleName: string;
  actionType: EditCheckRule["actionType"];
  targetFieldId: string;
  finalResult: ConditionResult;
  overallSummary: string;
  steps: AstDebugStep[];
  totalSteps: number;
  hasShortCircuit: boolean;
  missingFields: string[];
  incompatibleFields: string[];
  raisesQuery: boolean;
  queryMessage?: string;
}

export interface SampleSubjectProfile {
  id: string;
  name: string;
  description: string;
  category: "normal" | "missing" | "deviation" | "edge_case";
  values: Record<string, string | number | boolean | null>;
}

export const SAMPLE_SUBJECT_PROFILES: SampleSubjectProfile[] = [
  {
    id: "standard_subject",
    name: "Standard Subject (Complete Record)",
    description:
      "Complete vital signs, laboratory, and demographic data within expected ranges.",
    category: "normal",
    values: {
      sex: "M",
      age: 55,
      weight: 74.5,
      height: 178,
      sysbp: 120,
      diabp: 80,
      serum_cr: 1.1,
      egqt: 420,
      egrr: 0.85,
      smoke_stat: "NEVER",
      ae_yn: "N",
    },
  },
  {
    id: "missing_vitals",
    name: "Missing Baseline Vitals (Undecidable)",
    description:
      "Incomplete subject record with missing weight, height, or laboratory parameters.",
    category: "missing",
    values: {
      sex: "F",
      age: 62,
      weight: null,
      height: null,
      sysbp: 125,
      diabp: null,
      serum_cr: null,
      egqt: 430,
      egrr: null,
      smoke_stat: "",
    },
  },
  {
    id: "protocol_deviation",
    name: "Protocol Deviation (Fired Query)",
    description:
      "Out-of-range clinical values designed to trigger hard-stop edit check queries.",
    category: "deviation",
    values: {
      sex: "M",
      age: 72,
      weight: 110.0,
      height: 165,
      sysbp: 185,
      diabp: 115,
      serum_cr: 2.8,
      egqt: 510,
      egrr: 0.7,
      smoke_stat: "CURRENT",
      ae_yn: "Y",
    },
  },
  {
    id: "type_incompatible",
    name: "Type Incompatible Edge Case",
    description:
      "Mismatched data types or invalid format values to test defensive evaluation.",
    category: "edge_case",
    values: {
      sex: "M",
      age: "NOT_ENTERED" as unknown as number,
      weight: "N/A" as unknown as number,
      height: 175,
      sysbp: 120,
      diabp: "INVALID",
      serum_cr: -1,
      egqt: 420,
      egrr: 0.85,
    },
  },
];

const OPERATOR_DISPLAY_MAP: Record<AstOperator, string> = {
  eq: "=",
  neq: "≠",
  gt: ">",
  gte: "≥",
  lt: "<",
  lte: "≤",
  in: "IN",
  contains: "CONTAINS",
  is_empty: "IS EMPTY",
  is_not_empty: "IS NOT EMPTY",
};

function resolveFieldRef(
  fieldId: string,
  fieldsList: CRFField[]
): CRFField | undefined {
  return fieldsList.find(
    (f) =>
      f.id === fieldId || f.variableName.toLowerCase() === fieldId.toLowerCase()
  );
}

function getEffectiveFieldValue(
  fieldId: string,
  fieldValues: Record<string, string | number | boolean | null | undefined>,
  fieldsList: CRFField[],
  visitContext?: string,
  crossVisitId?: string
): string | number | boolean | null | undefined {
  const targetField = resolveFieldRef(fieldId, fieldsList);
  let val: string | number | boolean | null | undefined;

  if (crossVisitId) {
    val =
      fieldValues[`${crossVisitId}_${fieldId}`] ??
      (targetField
        ? (fieldValues[`${crossVisitId}_${targetField.id}`] ??
          fieldValues[`${crossVisitId}_${targetField.variableName}`])
        : undefined);
  } else if (visitContext) {
    val =
      fieldValues[`${visitContext}_${fieldId}`] ??
      (targetField
        ? (fieldValues[`${visitContext}_${targetField.id}`] ??
          fieldValues[`${visitContext}_${targetField.variableName}`])
        : undefined);
  }

  if (val === undefined) {
    val =
      fieldValues[fieldId] ??
      (targetField
        ? (fieldValues[targetField.id] ?? fieldValues[targetField.variableName])
        : undefined);
  }

  if (
    (val === undefined || val === null || val === "") &&
    targetField?.nullFlavorValue
  ) {
    val = targetField.nullFlavorValue;
  }

  return val;
}

function formatVal(val: unknown): string {
  if (val === undefined || val === null || val === "") return "no value";
  if (Array.isArray(val)) return `[${val.join(", ")}]`;
  return String(val);
}

/**
 * Generates a step-by-step AST execution trace for an edit check rule.
 */
export function generateRuleDebugTrace(
  rule: EditCheckRule,
  fieldValues: Record<string, string | number | boolean | null | undefined>,
  fieldsList: CRFField[],
  visitContext?: string
): AstRuleDebugTrace {
  const steps: AstDebugStep[] = [];
  const missingFieldsSet = new Set<string>();
  const incompatibleFieldsSet = new Set<string>();
  let hasShortCircuit = false;

  if (rule.unsupportedExpression) {
    steps.push({
      stepIndex: 1,
      nodeId: `${rule.id}_unsupported`,
      nodeType: "rule_summary",
      variableName: "RULE",
      actualValue: null,
      result: "incompatible",
      shortCircuited: false,
      sentence: `Unsupported Expression: ${rule.unsupportedExpression.reason}`,
      diagnostics: [
        `Imported expression is unsupported by current evaluator (${rule.unsupportedExpression.reason}).`,
      ],
    });

    return {
      ruleId: rule.id,
      ruleName: rule.name,
      actionType: rule.actionType,
      targetFieldId: rule.targetFieldId,
      finalResult: "incompatible",
      overallSummary: `Rule contains unsupported imported expression (${rule.unsupportedExpression.reason})`,
      steps,
      totalSteps: 1,
      hasShortCircuit: false,
      missingFields: [],
      incompatibleFields: ["UNSUPPORTED_EXPRESSION"],
      raisesQuery: false,
      queryMessage: rule.queryMessage,
    };
  }

  const { groups, groupLogicalOperator } = getRuleGroups(rule);
  let globalShortCircuit = false;
  let prevGroupShortCircuitReason = "";

  groups.forEach((group, gIdx) => {
    const groupNum = gIdx + 1;
    const groupShortCircuited = globalShortCircuit;
    const groupShortCircuitReason = prevGroupShortCircuitReason;

    const condResults: ConditionResult[] = [];

    group.conditions.forEach((cond, cIdx) => {
      const stepIndex = steps.length + 1;
      const condId = `${group.id}_cond_${cIdx + 1}`;
      const fieldRef = resolveFieldRef(cond.fieldId, fieldsList);
      const varName = fieldRef ? fieldRef.variableName : cond.fieldId;

      const actualVal = getEffectiveFieldValue(
        cond.fieldId,
        fieldValues,
        fieldsList,
        visitContext,
        cond.crossVisitId
      );

      let comparedVal: string | number | boolean | string[] | null | undefined =
        cond.value;
      let comparedVarName: string | undefined;

      if (cond.compareFieldId) {
        const compRef = resolveFieldRef(cond.compareFieldId, fieldsList);
        comparedVarName = compRef ? compRef.variableName : cond.compareFieldId;
        comparedVal = getEffectiveFieldValue(
          cond.compareFieldId,
          fieldValues,
          fieldsList,
          visitContext
        );
      }

      const diagnostics: string[] = [];

      // Determine condition result
      let condResult: ConditionResult = "missing";
      let isCondShortCircuited = groupShortCircuited;
      let localShortCircuitReason = groupShortCircuitReason;

      if (!isCondShortCircuited && cIdx > 0) {
        // Check for within-group short-circuiting
        if (group.logicalOperator === "AND" && condResults.includes("false")) {
          isCondShortCircuited = true;
          localShortCircuitReason = `⚡ Short-circuited: Previous condition in AND group ${groupNum} evaluated to FALSE`;
        } else if (
          group.logicalOperator === "OR" &&
          condResults.includes("true")
        ) {
          isCondShortCircuited = true;
          localShortCircuitReason = `⚡ Short-circuited: Previous condition in OR group ${groupNum} evaluated to TRUE`;
        }
      }

      if (isCondShortCircuited) {
        hasShortCircuit = true;
        condResult = group.logicalOperator === "AND" ? "false" : "true";
      } else {
        condResult = evaluateConditionResult(
          cond,
          fieldValues,
          fieldsList,
          visitContext
        );
      }

      condResults.push(condResult);

      // Collect missing & incompatible fields for author diagnostics
      if (isMissingOrNullFlavor(actualVal)) {
        missingFieldsSet.add(varName);
        diagnostics.push(
          `Input value for '${varName}' is missing or null flavor.`
        );
      }
      if (cond.compareFieldId && isMissingOrNullFlavor(comparedVal)) {
        const compName = comparedVarName || cond.compareFieldId;
        missingFieldsSet.add(compName);
        diagnostics.push(`Compared input value for '${compName}' is missing.`);
      }

      if (condResult === "incompatible") {
        incompatibleFieldsSet.add(varName);
        diagnostics.push(
          `Incompatible data types or unsupported operator '${cond.operator}' for field '${varName}'.`
        );
      }

      const opLabel = OPERATOR_DISPLAY_MAP[cond.operator] || cond.operator;
      const compDesc = comparedVarName
        ? `${comparedVarName} (${formatVal(comparedVal)})`
        : formatVal(cond.value);

      const sentence = isCondShortCircuited
        ? `${varName} ${opLabel} ${compDesc} → SKIPPED (${localShortCircuitReason})`
        : `${varName} (${formatVal(actualVal)}) ${opLabel} ${compDesc} → ${condResult.toUpperCase()}`;

      steps.push({
        stepIndex,
        nodeId: condId,
        nodeType: "condition",
        condition: cond,
        group,
        fieldId: cond.fieldId,
        variableName: varName,
        actualValue: actualVal,
        operator: cond.operator,
        operatorLabel: opLabel,
        comparedValue: comparedVal,
        comparedVariableName: comparedVarName,
        result: condResult,
        shortCircuited: isCondShortCircuited,
        shortCircuitReason: isCondShortCircuited
          ? localShortCircuitReason
          : undefined,
        sentence,
        diagnostics,
      });
    });

    const groupResult = combineConditionResults(
      group.logicalOperator,
      condResults
    );

    // Check if group outcome causes global short-circuit for subsequent groups
    if (!globalShortCircuit && gIdx < groups.length - 1) {
      if (groupLogicalOperator === "AND" && groupResult === "false") {
        globalShortCircuit = true;
        prevGroupShortCircuitReason = `⚡ Short-circuited: Group ${groupNum} evaluated to FALSE under AND rule logic`;
      } else if (groupLogicalOperator === "OR" && groupResult === "true") {
        globalShortCircuit = true;
        prevGroupShortCircuitReason = `⚡ Short-circuited: Group ${groupNum} evaluated to TRUE under OR rule logic`;
      }
    }
  });

  // Calculate final rule result
  const finalResult = combineConditionResults(
    groupLogicalOperator,
    steps.filter((s) => s.nodeType === "condition").map((s) => s.result)
  );

  const fired = finalResult === "true";
  const raisesQuery = fired && rule.actionType === "raise_query";

  let overallSummary = `Rule ${rule.name} evaluated to ${finalResult.toUpperCase()}`;
  if (raisesQuery && rule.queryMessage) {
    overallSummary += ` — Raises Query: "${rule.queryMessage}"`;
  } else if (finalResult === "missing") {
    overallSummary += ` — Waiting on missing input fields: ${Array.from(missingFieldsSet).join(", ")}`;
  } else if (finalResult === "incompatible") {
    overallSummary += ` — Incompatible comparison on fields: ${Array.from(incompatibleFieldsSet).join(", ")}`;
  }

  // Add final rule summary step
  steps.push({
    stepIndex: steps.length + 1,
    nodeId: `${rule.id}_final`,
    nodeType: "rule_summary",
    variableName: "RULE_OUTCOME",
    actualValue: finalResult,
    result: finalResult,
    shortCircuited: false,
    sentence: overallSummary,
    diagnostics: [],
  });

  return {
    ruleId: rule.id,
    ruleName: rule.name,
    actionType: rule.actionType,
    targetFieldId: rule.targetFieldId,
    finalResult,
    overallSummary,
    steps,
    totalSteps: steps.length,
    hasShortCircuit,
    missingFields: Array.from(missingFieldsSet),
    incompatibleFields: Array.from(incompatibleFieldsSet),
    raisesQuery,
    queryMessage: rule.queryMessage,
  };
}
