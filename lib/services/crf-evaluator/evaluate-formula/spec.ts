import { z } from "zod";
import type { CRFField } from "@/lib/crf/types";
import type { ServiceResult } from "@/lib/services/service-result";

export const EvaluateFormulaInputSchema = z.object({
  formula: z.string().min(1, "Formula string must not be empty"),
  fieldValues: z.record(z.string(), z.unknown()).default({}),
  fieldsList: z.array(z.custom<CRFField>()).default([]),
});

export type EvaluateFormulaInput = z.infer<typeof EvaluateFormulaInputSchema>;

export const EvaluateFormulaErrorCode = z.enum([
  "EMPTY_FORMULA",
  "SYNTAX_ERROR",
  "UNKNOWN_FUNCTION",
  "UNRESOLVED_VARIABLE",
  "DIVISION_BY_ZERO",
  "EVALUATION_ERROR",
]);

export type EvaluateFormulaErrorCode = z.infer<typeof EvaluateFormulaErrorCode>;

export interface EvaluateFormulaData {
  value: number | null;
  formula: string;
  isCalculated: boolean;
}

export type EvaluateFormulaResult = ServiceResult<
  EvaluateFormulaData,
  EvaluateFormulaErrorCode
>;

export interface EvaluateFormulaSpec {
  execute(input: EvaluateFormulaInput): EvaluateFormulaResult;
}
