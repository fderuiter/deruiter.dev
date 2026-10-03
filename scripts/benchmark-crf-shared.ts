/**
 * Types and helpers shared by the CRF workload benchmark's engine and browser
 * phases (scripts/benchmark-crf.ts and scripts/benchmark-crf-browser.ts), kept
 * apart so neither phase imports the other.
 */

import type { CrfWorkloadId } from "../lib/dx/crf-workloads";

/** Outcome of one measured step. Only "passed" counts as passed. */
export type StepStatus = "passed" | "failed" | "skipped";

export interface StepTiming {
  median: number;
  p95: number;
  min: number;
  max: number;
  samples: number[];
}

export interface StepResult {
  workflow: string;
  step: string;
  status: StepStatus;
  /** Wall-clock milliseconds per iteration, when the step ran. */
  timing?: StepTiming;
  /** Output size or other facts the step produced. */
  facts?: Record<string, string | number | boolean | null>;
  /** Why the step failed or was skipped. */
  reason?: string;
}

export interface CrfBenchmarkOptions {
  phases: Set<"engine" | "browser">;
  workloads: CrfWorkloadId[];
  iterations: number;
  /** Repeated browser sessions per workload; latency samples are pooled. */
  browserRuns: number;
  baseUrl: string | null;
  port: number;
  outputDirectory: string;
  stepTimeoutMs: number;
}

/** Summarizes timing samples; samples are kept so the report is auditable. */
export function summarizeTimings(samples: number[]): StepTiming {
  const sorted = [...samples].sort((a, b) => a - b);
  const pick = (fraction: number) =>
    sorted[
      Math.min(sorted.length - 1, Math.ceil(fraction * sorted.length) - 1)
    ];
  const round = (value: number) => Number(value.toFixed(2));
  const middle = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0
      ? (sorted[middle - 1] + sorted[middle]) / 2
      : sorted[middle];
  return {
    median: round(median),
    p95: round(pick(0.95)),
    min: round(sorted[0]),
    max: round(sorted[sorted.length - 1]),
    samples: samples.map(round),
  };
}
