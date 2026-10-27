import { z } from "zod";
import type { CRFForm } from "@/lib/crf/types";
import type { DiagnosticItem } from "@/lib/crf";
import type { ServiceResult } from "@/lib/services/service-result";

export const LintFormInputSchema = z.object({
  form: z.custom<CRFForm>((val) => Boolean(val && typeof val === "object"), {
    message: "Valid CRFForm object is required",
  }),
});

export type LintFormInput = z.infer<typeof LintFormInputSchema>;

export const LintFormErrorCode = z.enum(["INVALID_FORM", "LINTING_FAILED"]);

export type LintFormErrorCode = z.infer<typeof LintFormErrorCode>;

export type LintFormResult = ServiceResult<DiagnosticItem[], LintFormErrorCode>;

export interface LintFormSpec {
  execute(input: LintFormInput): LintFormResult;
}
