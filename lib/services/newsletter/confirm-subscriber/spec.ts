import { z } from "zod";
import type { ServiceResult } from "@/lib/services/service-result";

export const ConfirmSubscriberInputSchema = z.object({
  token: z.string().min(1, "Confirmation token is required"),
  now: z.date().optional(),
});

export interface ConfirmSubscriberInput {
  token: string;
  now?: Date;
}

export interface ConfirmSubscriberData {
  outcome: "confirmed" | "already_confirmed";
}

export const ConfirmSubscriberErrorCode = z.enum([
  "NOT_FOUND",
  "STORAGE_UNAVAILABLE",
  "INVALID_INPUT",
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
