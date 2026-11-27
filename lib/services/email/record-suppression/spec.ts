import { z } from "zod";
import type { SuppressionReason } from "../shared";
import type { ServiceResult } from "../../service-result";

export const RecordSuppressionInputSchema = z.object({
  email: z.string().trim().min(1),
  reason: z.enum(["BOUNCE", "COMPLAINT", "UNSUBSCRIBE"]),
});

export type RecordSuppressionInput = {
  email: string;
  reason: SuppressionReason;
};

export const RecordSuppressionErrorCode = z.enum([
  "INVALID_INPUT",
  "STORAGE_UNAVAILABLE",
]);
export type RecordSuppressionErrorCode = z.infer<
  typeof RecordSuppressionErrorCode
>;

export interface RecordSuppressionOutput {
  email: string;
  reason: SuppressionReason;
}

export type RecordSuppressionResult = ServiceResult<
  RecordSuppressionOutput,
  RecordSuppressionErrorCode
>;

export interface RecordSuppressionSpec {
  execute(input: RecordSuppressionInput): Promise<RecordSuppressionResult>;
}
