import { LintFormSpec, LintFormInput, LintFormResult } from "./spec";
import * as astEvaluator from "@/lib/crf";
import { createSuccess, createFailure } from "@/lib/services/service-result";

export class LintFormHandler implements LintFormSpec {
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
      const diagnostics = astEvaluator.lintForm(normalizedForm);
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
