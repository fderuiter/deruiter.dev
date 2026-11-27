import {
  EvaluateFormulaSpec,
  EvaluateFormulaInput,
  EvaluateFormulaResult,
  EvaluateFormulaErrorCode,
} from "./spec";
import { parseAndEvaluateFormula } from "@/lib/crf/evaluator";
import { createSuccess, createFailure } from "@/lib/services/service-result";

const ERROR_SUGGESTIONS: Record<EvaluateFormulaErrorCode, string> = {
  EMPTY_FORMULA: "Provide a valid mathematical expression string",
  SYNTAX_ERROR:
    "Check expression syntax, operators, parentheses, and function argument counts",
  UNKNOWN_FUNCTION:
    "Use a supported math function: round, sqrt, cbrt, clamp, abs, max, min, floor, ceil, exp, log",
  UNRESOLVED_VARIABLE:
    "Ensure all referenced variables exist in the study form fields or fieldValues map",
  DIVISION_BY_ZERO:
    "Ensure divisor variables are non-zero before evaluating the formula",
  EVALUATION_ERROR:
    "Check numeric domains (for example non-negative inputs to sqrt and positive inputs to log)",
};

export class EvaluateFormulaHandler implements EvaluateFormulaSpec {
  execute(input: EvaluateFormulaInput): EvaluateFormulaResult {
    const trimmed = (input.formula || "").trim();
    if (!trimmed) {
      return createFailure("EMPTY_FORMULA", "Formula cannot be empty", {
        suggestion: ERROR_SUGGESTIONS.EMPTY_FORMULA,
        recoverable: true,
      });
    }

    try {
      const outcome = parseAndEvaluateFormula(
        trimmed,
        input.fieldValues as Record<
          string,
          string | number | boolean | null | undefined
        >,
        input.fieldsList
      );

      if (!outcome.success) {
        const code: EvaluateFormulaErrorCode = outcome.error.code;
        return createFailure(code, outcome.error.message, {
          suggestion: ERROR_SUGGESTIONS[code],
          recoverable: true,
        });
      }

      return createSuccess({
        value: outcome.value,
        formula: trimmed,
        isCalculated: outcome.value !== null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return createFailure("EVALUATION_ERROR", message, {
        suggestion: ERROR_SUGGESTIONS.EVALUATION_ERROR,
        recoverable: true,
        details: err,
      });
    }
  }
}
