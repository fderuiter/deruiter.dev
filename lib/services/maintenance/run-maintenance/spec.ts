import { z } from "zod";
import type { ServiceResult } from "@/lib/services/service-result";
import type { MaintenanceAdapters, MaintenanceSummary } from "../shared";

export const RunMaintenanceInputSchema = z
  .object({
    batchSize: z.number().finite().optional(),
    deadlineMs: z.number().finite().optional(),
    now: z.date().optional(),
  })
  .optional()
  .default({});

export interface RunMaintenanceInput {
  batchSize?: number;
  deadlineMs?: number;
  now?: Date;
  clock?: () => number;
  adapters?: MaintenanceAdapters;
}

export const RunMaintenanceErrorCode = z.enum(["INVALID_INPUT"]);
export type RunMaintenanceErrorCode = z.infer<typeof RunMaintenanceErrorCode>;

export type RunMaintenanceResult = ServiceResult<
  MaintenanceSummary,
  RunMaintenanceErrorCode
>;

export interface RunMaintenanceSpec {
  execute(input?: RunMaintenanceInput): Promise<RunMaintenanceResult>;
}
