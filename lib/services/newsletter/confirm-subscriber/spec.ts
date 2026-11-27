import { z } from "zod";
import type { ServiceResult } from "@/lib/services/service-result";

export const ConfirmSubscriberInputSchema = z.object({
  token: z.string().trim().min(10, "Invalid confirmation token").max(256),
  now: z.date().optional(),
});

export type ConfirmSubscriberInput = z.infer<
  typeof ConfirmSubscriberInputSchema
>;

export interface ConfirmSubscriberData {
  outcome: "confirmed" | "already_confirmed";
}

export const ConfirmSubscriberErrorCode = z.enum([
  "INVALID_TOKEN",
  "STORAGE_UNAVAILABLE",
]);

export type ConfirmSubscriberErrorCode = z.infer<
  typeof ConfirmSubscriberErrorCode
>;

export type ConfirmSubscriberResult = ServiceResult<
  ConfirmSubscriberData,
  ConfirmSubscriberErrorCode
>;

export interface ConfirmSubscriberSpec {
  execute(input: ConfirmSubscriberInput): Promise<ConfirmSubscriberResult>;
}
