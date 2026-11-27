import { useCallback, useMemo } from "react";
import * as crf from "@/lib/crf";
import {
  EvaluateFormulaHandler,
  EvaluateFormulaInput,
  EvaluateFormulaInputSchema,
  EvaluateFormulaResult,
  LintFormHandler,
  LintFormInput,
  LintFormInputSchema,
  LintFormResult,
  LintFormulaHandler,
  LintFormulaInput,
  LintFormulaInputSchema,
  LintFormulaResult,
  createFailure,
} from "@/lib/services/client";

/**
 * Custom React hook providing access to CRF Studio evaluation and linter domain service operations.
 * Wraps EvaluateFormulaHandler, LintFormulaHandler, and LintFormHandler with Zod input validation
 * and zero-exception ServiceResult error handling.
 */
export function useCrfService() {
  const evaluateFormulaHandler = useMemo(
    () => new EvaluateFormulaHandler(),
    []
  );
  const lintFormulaHandler = useMemo(() => new LintFormulaHandler(), []);
  const lintFormHandler = useMemo(
    () => new LintFormHandler((form) => crf.lintForm(form)),
    []
  );

  const evaluateFormula = useCallback(
    (input: EvaluateFormulaInput): EvaluateFormulaResult => {
      const parsed = EvaluateFormulaInputSchema.safeParse(input);
      if (!parsed.success) {
        return createFailure(
          "EMPTY_FORMULA",
          parsed.error.issues[0]?.message || "Invalid formula evaluation input",
          {
            suggestion: "Provide valid formula string and field list",
            recoverable: true,
            details: parsed.error,
          }
        );
      }
      return evaluateFormulaHandler.execute(parsed.data);
    },
    [evaluateFormulaHandler]
  );

  const lintFormula = useCallback(
    (input: LintFormulaInput): LintFormulaResult => {
      const parsed = LintFormulaInputSchema.safeParse(input);
      if (!parsed.success) {
        return createFailure(
          "INVALID_INPUT",
          parsed.error.issues[0]?.message || "Invalid formula linting input",
          {
            suggestion: "Provide valid formula string and field definitions",
            recoverable: true,
            details: parsed.error,
          }
        );
      }
      return lintFormulaHandler.execute(parsed.data);
    },
    [lintFormulaHandler]
  );

  const lintForm = useCallback(
    (input: LintFormInput): LintFormResult => {
      const parsed = LintFormInputSchema.safeParse(input);
      if (!parsed.success) {
        return createFailure(
          "INVALID_FORM",
          parsed.error.issues[0]?.message || "Invalid form linting input",
          {
            suggestion: "Ensure CRFForm has valid sections array",
            recoverable: true,
            details: parsed.error,
          }
        );
      }
      return lintFormHandler.execute(parsed.data);
    },
    [lintFormHandler]
  );

  return useMemo(
    () => ({
      evaluateFormula,
      lintFormula,
      lintForm,
    }),
    [evaluateFormula, lintFormula, lintForm]
  );
}
