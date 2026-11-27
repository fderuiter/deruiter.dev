import { z } from "zod";
import {
  AuditNullQueueErrorCode,
  type NullQueueAuditResult,
  type NullQueueDeliveriesAudit,
  type NullQueueDeliveriesAuditOptions,
} from "../shared";

export const AuditNullQueueDeliveriesInputSchema = z.object({
  page: z.number().int().optional(),
  pageSize: z.number().int().optional(),
});

export type AuditNullQueueDeliveriesInput = z.infer<
  typeof AuditNullQueueDeliveriesInputSchema
>;

export {
  AuditNullQueueErrorCode,
  type NullQueueAuditResult,
  type NullQueueDeliveriesAudit,
  type NullQueueDeliveriesAuditOptions,
};

export interface AuditNullQueueDeliveriesSpec {
  execute(input?: AuditNullQueueDeliveriesInput): Promise<NullQueueAuditResult>;
}
