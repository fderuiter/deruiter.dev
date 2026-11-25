import { z } from "zod";
import {
  ResendWebhookEventSchema,
  type ResendWebhookEvent,
} from "@/lib/schemas";
import type { ServiceResult } from "@/lib/services/service-result";
import type { SuppressionReason } from "../shared";

export const HandleEmailWebhookEventInputSchema = z.object({
  event: ResendWebhookEventSchema,
});

export interface HandleEmailWebhookEventInput {
  event: ResendWebhookEvent;
}

export interface HandleEmailWebhookEventData {
  suppressed: boolean;
  reason?: SuppressionReason;
}

export const HandleEmailWebhookEventErrorCode = z.enum([
  "STORAGE_UNAVAILABLE",
  "INVALID_INPUT",
]);
export type HandleEmailWebhookEventErrorCode = z.infer<
  typeof HandleEmailWebhookEventErrorCode
>;

export type HandleEmailWebhookEventResult = ServiceResult<
  HandleEmailWebhookEventData,
  HandleEmailWebhookEventErrorCode
>;

export interface HandleEmailWebhookEventSpec {
  execute(
    input: HandleEmailWebhookEventInput
  ): Promise<HandleEmailWebhookEventResult>;
}
