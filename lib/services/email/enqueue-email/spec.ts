import { z } from "zod";
import type { ServiceResult } from "../../service-result";
import type { RawEmailOptions } from "../shared";

export const EnqueueEmailInputSchema = z.object({
  options: z.object({
    to: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
    from: z.string().optional(),
    replyTo: z.string().optional(),
    subject: z.string().min(1),
    html: z.string().min(1),
    text: z.string().optional(),
    tags: z.array(z.object({ name: z.string(), value: z.string() })).optional(),
    headers: z.record(z.string(), z.string()).optional(),
    skipQueue: z.boolean().optional(),
  }),
  mode: z.enum(["pending", "retry"]).default("pending"),
  fromAddress: z.string().optional(),
  errorReason: z.string().optional(),
});

export interface EnqueueEmailInput {
  options: RawEmailOptions;
  mode?: "pending" | "retry";
  fromAddress?: string;
  errorReason?: string;
}

export const EnqueueEmailErrorCode = z.enum([
  "INVALID_INPUT",
  "ENQUEUE_FAILED",
]);
export type EnqueueEmailErrorCode = z.infer<typeof EnqueueEmailErrorCode>;

export interface EnqueueEmailOutput {
  queueId: string;
}

export type EnqueueEmailResult = ServiceResult<
  EnqueueEmailOutput,
  EnqueueEmailErrorCode
>;

export interface EnqueueEmailSpec {
  execute(input: EnqueueEmailInput): Promise<EnqueueEmailResult>;
}
