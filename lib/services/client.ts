/**
 * Browser-safe vertical slice entry point for client-side interactive studios
 * and simulators (`crf-evaluator`, `garmin`, `duck`).
 *
 * Server-bound slices that depend on Node/database clients are exported from
 * `@/lib/services` (`lib/services/index.ts`), which also re-exports everything
 * in this module.
 */

export * from "./service-result";

// CRF Evaluator Vertical Slices
export * from "./crf-evaluator/evaluate-formula/spec";
export * from "./crf-evaluator/evaluate-formula/handler";
export * from "./crf-evaluator/lint-formula/spec";
export * from "./crf-evaluator/lint-formula/handler";
export * from "./crf-evaluator/lint-form/spec";
export * from "./crf-evaluator/lint-form/handler";

// Garmin Watch Simulator Vertical Slices
export * from "./garmin/allocate-memory/spec";
export * from "./garmin/allocate-memory/handler";
export * from "./garmin/garbage-collect/spec";
export * from "./garmin/garbage-collect/handler";
export * from "./garmin/sync-flash-storage/spec";
export * from "./garmin/sync-flash-storage/handler";

// Working With Duck Vertical Slices
export * from "./duck/dispatch-command/spec";
export * from "./duck/dispatch-command/handler";
export * from "./duck/interact-hazard/spec";
export * from "./duck/interact-hazard/handler";
