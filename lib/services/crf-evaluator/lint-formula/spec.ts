import { z } from "zod";
import type { CRFField } from "@/lib/crf/types";
import type { FormulaLintResult } from "@/lib/crf";
import type { ServiceResult } from "@/lib/services/service-result";

export const LintFormulaInputSchema = z.object({
  formula: z.string().default(""),
  fieldsList: z.array(z.custom<CRFField>()).default([]),
  targetFieldId: z.string().optional(),
  allFields: z.array(z.custom<CRFField>()).optional(),
});

export type LintFormulaInput = z.infer<typeof LintFormulaInputSchema>;

export const LintFormulaErrorCode = z.enum(["LINTING_FAILED", "INVALID_INPUT"]);

export type LintFormulaErrorCode = z.infer<typeof LintFormulaErrorCode>;

export type LintFormulaResult = ServiceResult<
  FormulaLintResult,
  LintFormulaErrorCode
>;

export interface LintFormulaSpec {
  execute(input: LintFormulaInput): LintFormulaResult;
}
