import { z } from "zod";
import type { ServiceResult } from "@/lib/services/service-result";
import type { SuppressionReason } from "../shared";

export const RecordEmailSuppressionInputSchema = z.object({
  email: z.string().min(1, "Email is required"),
  reason: z.enum(["BOUNCE", "COMPLAINT", "UNSUBSCRIBE"]),
});

export type RecordEmailSuppressionInput = {
  email: string;
  reason: SuppressionReason;
};

export interface RecordEmailSuppressionData {
  email: string;
  reason: SuppressionReason;
}

export const RecordEmailSuppressionErrorCode = z.enum([
  "STORAGE_UNAVAILABLE",
  "INVALID_INPUT",
]);
export type RecordEmailSuppressionErrorCode = z.infer<
  typeof RecordEmailSuppressionErrorCode
>;

export type RecordEmailSuppressionResult = ServiceResult<
  RecordEmailSuppressionData,
  RecordEmailSuppressionErrorCode
>;

export interface RecordEmailSuppressionSpec {
  execute(
    input: RecordEmailSuppressionInput
  ): Promise<RecordEmailSuppressionResult>;
}
