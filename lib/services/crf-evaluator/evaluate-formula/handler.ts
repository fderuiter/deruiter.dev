import {
  EvaluateFormulaSpec,
  EvaluateFormulaInput,
  EvaluateFormulaResult,
} from "./spec";
import { evaluateFormula } from "@/lib/crf";
import { createSuccess, createFailure } from "@/lib/services/service-result";

export class EvaluateFormulaHandler implements EvaluateFormulaSpec {
  execute(input: EvaluateFormulaInput): EvaluateFormulaResult {
    const trimmed = (input.formula || "").trim();
    if (!trimmed) {
      return createFailure("EMPTY_FORMULA", "Formula cannot be empty", {
        suggestion: "Provide a valid mathematical expression string",
        recoverable: true,
      });
    }

    try {
      const result = evaluateFormula(
        trimmed,
        input.fieldValues as Record<
          string,
          string | number | boolean | null | undefined
        >,
        input.fieldsList
      );

      return createSuccess({
        value: result,
        formula: trimmed,
        isCalculated: result !== null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return createFailure("EVALUATION_ERROR", message, {
        suggestion: "Check expression syntax, parentheses, and variable names",
        recoverable: true,
        details: err,
      });
    }
  }
}
