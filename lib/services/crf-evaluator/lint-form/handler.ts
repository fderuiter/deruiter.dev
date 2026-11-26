import type { CRFForm } from "@/lib/crf/types";
import { LintFormSpec, LintFormInput, LintFormResult } from "./spec";
import * as astEvaluator from "@/lib/crf/evaluator";
import { createSuccess, createFailure } from "@/lib/services/service-result";

export type LintFormEvaluator = (
  form: CRFForm
) => astEvaluator.DiagnosticItem[];

export class LintFormHandler implements LintFormSpec {
  constructor(
    private readonly lintFormFn: LintFormEvaluator = astEvaluator.lintForm
  ) {}

  execute(input: LintFormInput): LintFormResult {
    if (!input.form || !Array.isArray(input.form.sections)) {
      return createFailure(
        "INVALID_FORM",
        "Form must contain a valid sections array",
        {
          suggestion: "Ensure the CRFForm object has initialized sections",
          recoverable: true,
        }
      );
    }

    try {
      const normalizedForm = {
        ...input.form,
        rules: Array.isArray(input.form.rules) ? input.form.rules : [],
      };
      const diagnostics = this.lintFormFn(normalizedForm);
      return createSuccess(diagnostics);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return createFailure("LINTING_FAILED", message, {
        suggestion: "Check form structure and field integrity",
        recoverable: true,
        details: err,
      });
    }
  }
}
