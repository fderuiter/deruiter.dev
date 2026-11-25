import { z } from "zod";
import type { ServiceResult } from "@/lib/services/service-result";

export const UnsubscribeSubscriberInputSchema = z.object({
  token: z.string().trim().min(10, "Invalid unsubscribe token").max(256),
  now: z.date().optional(),
});

export type UnsubscribeSubscriberInput = z.infer<
  typeof UnsubscribeSubscriberInputSchema
>;

export interface UnsubscribeSubscriberData {
  outcome: "unsubscribed" | "already_unsubscribed";
}

export const UnsubscribeSubscriberErrorCode = z.enum([
  "INVALID_TOKEN",
  "STORAGE_UNAVAILABLE",
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
