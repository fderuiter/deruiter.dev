import { z } from "zod";
import type { ServiceResult } from "@/lib/services/service-result";

export const UnsubscribeSubscriberInputSchema = z.object({
  token: z.string().min(1, "Unsubscribe token is required"),
  now: z.date().optional(),
});

export interface UnsubscribeSubscriberInput {
  token: string;
  now?: Date;
}

export interface UnsubscribeSubscriberData {
  outcome: "unsubscribed" | "already_unsubscribed";
}

export const UnsubscribeSubscriberErrorCode = z.enum([
  "NOT_FOUND",
  "STORAGE_UNAVAILABLE",
  "INVALID_INPUT",
]);
export type UnsubscribeSubscriberErrorCode = z.infer<
  typeof UnsubscribeSubscriberErrorCode
>;

export type UnsubscribeSubscriberResult = ServiceResult<
  UnsubscribeSubscriberData,
  UnsubscribeSubscriberErrorCode
>;

export interface UnsubscribeSubscriberSpec {
  execute(
    input: UnsubscribeSubscriberInput
  ): Promise<UnsubscribeSubscriberResult>;
}
