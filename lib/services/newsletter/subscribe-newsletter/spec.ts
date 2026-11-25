import { z } from "zod";
import type { ServiceResult } from "@/lib/services/service-result";

export const SubscribeNewsletterInputSchema = z.object({
  email: z.string().trim().email("A valid email address is required"),
  now: z.date().optional(),
});

export interface SubscribeNewsletterInput {
  email: string;
  now?: Date;
}

export interface SubscribeNewsletterData {
  confirmationSent: boolean;
  simulated?: boolean;
}

export const SubscribeNewsletterErrorCode = z.enum([
  "STORAGE_UNAVAILABLE",
  "DELIVERY_FAILED",
  "INVALID_INPUT",
]);
export type SubscribeNewsletterErrorCode = z.infer<
  typeof SubscribeNewsletterErrorCode
>;

export type SubscribeNewsletterResult = ServiceResult<
  SubscribeNewsletterData,
  SubscribeNewsletterErrorCode
>;

export interface SubscribeNewsletterSpec {
  execute(input: SubscribeNewsletterInput): Promise<SubscribeNewsletterResult>;
}
