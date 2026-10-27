import { LintFormulaSpec, LintFormulaInput, LintFormulaResult } from "./spec";
import { lintFormula } from "@/lib/crf";
import { createSuccess, createFailure } from "@/lib/services/service-result";

export class LintFormulaHandler implements LintFormulaSpec {
  execute(input: LintFormulaInput): LintFormulaResult {
    try {
      const lintResult = lintFormula(
        input.formula,
        input.fieldsList,
        input.targetFieldId
      );

      return createSuccess(lintResult);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return createFailure("LINTING_FAILED", message, {
        suggestion: "Verify formula string and field definitions",
        recoverable: true,
        details: err,
      });
    }
  }
}
