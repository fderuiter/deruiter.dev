import type { ServiceResult } from "@/lib/services/service-result";

export const DEFAULT_MAINTENANCE_DEADLINE_MS = 8000;
export const MAINTENANCE_RESPONSE_RESERVE_MS = 250;

export type MaintenancePhaseName =
  "telemetry" | "newsletter" | "emailRetry" | "retention";

export type MaintenancePhaseStatus =
  "completed" | "failed" | "timed_out" | "skipped";

export interface MaintenancePhaseSummary {
  status: MaintenancePhaseStatus;
  durationMs: number;
  counts: Record<string, number | null>;
  error?: string;
}

export interface MaintenanceSummary {
  success: boolean;
  partial: boolean;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  deadlineMs: number;
  phases: Record<MaintenancePhaseName, MaintenancePhaseSummary>;
}

export type MaintenancePhaseCounts = Record<string, number | null>;
export type MaintenancePhaseResult = ServiceResult<MaintenancePhaseCounts>;

export interface MaintenanceAdapters {
  syncTelemetry(batchSize: number): Promise<MaintenancePhaseResult>;
  dispatchNewsletter(now: Date): Promise<MaintenancePhaseResult>;
  processEmailRetry(now: Date): Promise<MaintenancePhaseResult>;
  runRetention(now: Date): Promise<MaintenancePhaseResult>;
}
