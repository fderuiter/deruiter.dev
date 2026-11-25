import { z } from "zod";
import type { ServiceResult } from "@/lib/services/service-result";
import type { OutboundEmailStatus, RawEmailOptions } from "../shared";

export interface OutboundEmailQueueWriterLike {
  outboundEmailQueue: {
    create(args: {
      data: {
        to: string;
        from: string;
        replyTo?: string;
        subject: string;
        html: string;
        text?: string;
        tags?: Array<{ name: string; value: string }>;
        headers?: Record<string, string>;
        attempts: number;
        status: OutboundEmailStatus;
        nextRetryAt: Date;
      };
    }): Promise<{ id: string }>;
  };
}

export const EnqueueEmailOptionsSchema = z.object({
  to: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
  from: z.string().optional(),
  replyTo: z.string().optional(),
  subject: z.string().min(1, "Subject is required"),
  html: z.string().min(1, "HTML body is required"),
  text: z.string().optional(),
  tags: z.array(z.object({ name: z.string(), value: z.string() })).optional(),
  headers: z.record(z.string(), z.string()).optional(),
  skipQueue: z.boolean().optional(),
});

export interface EnqueueEmailInput {
  options: RawEmailOptions;
  client?: OutboundEmailQueueWriterLike;
}

export interface EnqueueEmailData {
  queueId: string;
}

export const EnqueueEmailErrorCode = z.enum([
  "ENQUEUE_FAILED",
  "INVALID_INPUT",
]);
export type EnqueueEmailErrorCode = z.infer<typeof EnqueueEmailErrorCode>;

export type EnqueueEmailResult = ServiceResult<
  EnqueueEmailData,
  EnqueueEmailErrorCode
>;

export interface EnqueueEmailSpec {
  execute(input: EnqueueEmailInput): Promise<EnqueueEmailResult>;
}
