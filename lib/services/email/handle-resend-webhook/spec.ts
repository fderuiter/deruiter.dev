import { z } from "zod";
import {
  ResendWebhookEventSchema,
  type ResendWebhookEvent,
} from "@/lib/schemas";
import type { ServiceResult } from "../../service-result";

export const HandleResendWebhookInputSchema = z.object({
  event: ResendWebhookEventSchema,
});

export interface HandleResendWebhookInput {
  event: ResendWebhookEvent;
}

export const HandleResendWebhookErrorCode = z.enum([
  "INVALID_INPUT",
  "STORAGE_UNAVAILABLE",
]);
export type HandleResendWebhookErrorCode = z.infer<
  typeof HandleResendWebhookErrorCode
>;

export interface HandleResendWebhookOutput {
  suppressed: boolean;
  reason?: string;
}

export type HandleResendWebhookResult = ServiceResult<
  HandleResendWebhookOutput,
  HandleResendWebhookErrorCode
>;

export interface HandleResendWebhookSpec {
  execute(input: HandleResendWebhookInput): Promise<HandleResendWebhookResult>;
}
