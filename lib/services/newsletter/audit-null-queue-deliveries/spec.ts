import { z } from "zod";
import type { ServiceResult } from "@/lib/services/service-result";
import type {
  NullQueueAuditErrorCode,
  NullQueueDeliveriesAudit,
  NullQueueDeliveriesAuditOptions,
} from "../shared";

export const AuditNullQueueDeliveriesInputSchema = z
  .object({
    page: z.number().finite().optional(),
    pageSize: z.number().finite().optional(),
  })
  .optional()
  .default({});

export type AuditNullQueueDeliveriesInput = NullQueueDeliveriesAuditOptions;

export type AuditNullQueueDeliveriesResult = ServiceResult<
  NullQueueDeliveriesAudit,
  NullQueueAuditErrorCode
>;

export interface AuditNullQueueDeliveriesSpec {
  execute(
    input?: AuditNullQueueDeliveriesInput
  ): Promise<AuditNullQueueDeliveriesResult>;
}
