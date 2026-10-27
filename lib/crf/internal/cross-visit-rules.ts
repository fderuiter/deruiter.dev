import { AstCondition, StudyVisit } from "../types";
import { evaluateCondition } from "./expression-evaluator";

export interface ConditionalFormRule {
  formId: string;
  condition: AstCondition;
  targetVisitIds: string[];
}

/**
 * Resolves form requirements per visit schedule based on subject treatment arm or clinical criteria.
 */
export function evaluateMatrixFormObligations(
  visits: StudyVisit[],
  rules: ConditionalFormRule[],
  fieldValues: Record<string, string | number | boolean | null | undefined>
): StudyVisit[] {
  return visits.map((visit) => {
    const resolvedForms = new Set(visit.assignedFormIds);

    for (const rule of rules) {
      if (rule.targetVisitIds.includes(visit.id)) {
        const isSatisfied = evaluateCondition(rule.condition, fieldValues, []);
        if (isSatisfied) {
          resolvedForms.add(rule.formId);
        }
      }
    }

    return {
      ...visit,
      assignedFormIds: Array.from(resolvedForms),
    };
  });
}
