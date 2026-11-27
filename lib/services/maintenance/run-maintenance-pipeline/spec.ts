import { z } from "zod";
import type { ServiceResult } from "@/lib/services/service-result";
import type { MaintenanceAdapters, MaintenanceSummary } from "../shared";

export const RunMaintenancePipelineInputSchema = z.object({
  batchSize: z.number().optional(),
  deadlineMs: z.number().optional(),
  now: z.date().optional(),
  clock: z.custom<() => number>((v) => typeof v === "function").optional(),
  adapters: z
    .custom<MaintenanceAdapters>((v) => typeof v === "object" && v !== null)
    .optional(),
});

export type RunMaintenancePipelineInput = z.infer<
  typeof RunMaintenancePipelineInputSchema
>;

export const RunMaintenancePipelineErrorCode = z.enum([
  "INVALID_MAINTENANCE_INPUT",
  "MAINTENANCE_PIPELINE_FAILED",
]);

export type RunMaintenancePipelineErrorCode = z.infer<
  typeof RunMaintenancePipelineErrorCode
>;

export type RunMaintenancePipelineResult = ServiceResult<
  MaintenanceSummary,
  RunMaintenancePipelineErrorCode
>;

export interface RunMaintenancePipelineSpec {
  execute(
    input?: RunMaintenancePipelineInput
  ): Promise<RunMaintenancePipelineResult>;
}
