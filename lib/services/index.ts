/**
 * Central Public Entry Point for Domain Services & Typed Service Contracts
 * Adheres to ADR 0028 and Deep-Module architecture.
 */

// Shared Service Envelope
export * from "./service-result";
export * from "./event-outbox";

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

// Outbound Email Services
export type { EmailServiceSpec, EmailServiceHandler } from "./email-service";
