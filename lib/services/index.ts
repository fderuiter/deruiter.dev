/**
 * Central Public Entry Point for Domain Services & Typed Service Contracts.
 * Adheres to ADR 0028 vertical slice architecture.
 */

// Shared Service Envelope & Browser-Safe Interactive Slices
export * from "./client";

// Privacy Helpers (Runtime-Agnostic Re-export) & Vertical Slices
export * from "@/lib/privacy";
export * from "./privacy/extract-client-ip/spec";
export * from "./privacy/extract-client-ip/handler";
export * from "./privacy/hash-connection/spec";
export * from "./privacy/hash-connection/handler";

// Telemetry Vertical Slices
export * from "./telemetry/shared";
export * from "./telemetry/check-rate-limit/spec";
export * from "./telemetry/check-rate-limit/handler";
export * from "./telemetry/record-telemetry-event/spec";
export * from "./telemetry/record-telemetry-event/handler";
export * from "./telemetry/get-aggregate-stats/spec";
export * from "./telemetry/get-aggregate-stats/handler";
export * from "./telemetry/compute-aggregate-stats/spec";
export * from "./telemetry/compute-aggregate-stats/handler";
export * from "./telemetry/refresh-aggregate-stats/spec";
export * from "./telemetry/refresh-aggregate-stats/handler";
export * from "./telemetry/sync-buffered-events/spec";
export * from "./telemetry/sync-buffered-events/handler";
export * from "./telemetry/rollup-and-prune-events/spec";
export * from "./telemetry/rollup-and-prune-events/handler";

// Outbound Email Vertical Slices
export * from "./email/shared";
export * from "./email/check-recipient-eligibility/spec";
export * from "./email/check-recipient-eligibility/handler";
export * from "./email/get-suppressed-emails/spec";
export * from "./email/get-suppressed-emails/handler";
export * from "./email/record-suppression/spec";
export * from "./email/record-suppression/handler";
export * from "./email/enqueue-email/spec";
export * from "./email/enqueue-email/handler";
export * from "./email/send-raw-email/spec";
export * from "./email/send-raw-email/handler";
export * from "./email/send-contact-inquiry/spec";
export * from "./email/send-contact-inquiry/handler";
export * from "./email/send-feedback-notification/spec";
export * from "./email/send-feedback-notification/handler";
export * from "./email/process-retry-queue/spec";
export * from "./email/process-retry-queue/handler";
export * from "./email/get-retry-queue-health/spec";
export * from "./email/get-retry-queue-health/handler";
export * from "./email/handle-resend-webhook/spec";
export * from "./email/handle-resend-webhook/handler";

// Newsletter Vertical Slices
export * from "./newsletter/shared";
export * from "./newsletter/subscribe-newsletter/spec";
export * from "./newsletter/subscribe-newsletter/handler";
export * from "./newsletter/confirm-subscriber/spec";
export * from "./newsletter/confirm-subscriber/handler";
export * from "./newsletter/unsubscribe-subscriber/spec";
export * from "./newsletter/unsubscribe-subscriber/handler";
export * from "./newsletter/queue-post-announcement/spec";
export * from "./newsletter/queue-post-announcement/handler";
export * from "./newsletter/dispatch-due/spec";
export * from "./newsletter/dispatch-due/handler";
export * from "./newsletter/audit-null-queue-deliveries/spec";
export * from "./newsletter/audit-null-queue-deliveries/handler";

// Case Study Vertical Slices
export * from "./case-study/shared";
export * from "./case-study/list-published-case-studies/spec";
export * from "./case-study/list-published-case-studies/handler";
export * from "./case-study/list-case-study-summaries/spec";
export * from "./case-study/list-case-study-summaries/handler";
export * from "./case-study/get-case-study-by-slug/spec";
export * from "./case-study/get-case-study-by-slug/handler";
export * from "./case-study/create-case-study-draft/spec";
export * from "./case-study/create-case-study-draft/handler";
export * from "./case-study/update-case-study-image/spec";
export * from "./case-study/update-case-study-image/handler";
export * from "./case-study/evict-case-study-cache/spec";
export * from "./case-study/evict-case-study-cache/handler";
export * from "./case-study/get-case-study-reactions/spec";
export * from "./case-study/get-case-study-reactions/handler";
export * from "./case-study/submit-case-study-reaction/spec";
export * from "./case-study/submit-case-study-reaction/handler";
export * from "./case-study/flush-case-study-reactions/spec";
export * from "./case-study/flush-case-study-reactions/handler";
export * from "./case-study/get-case-study-feedback/spec";
export * from "./case-study/get-case-study-feedback/handler";
export * from "./case-study/submit-case-study-feedback/spec";
export * from "./case-study/submit-case-study-feedback/handler";

// Blog Vertical Slices
export * from "./blog/shared";
export * from "./blog/list-published-blog-posts/spec";
export * from "./blog/list-published-blog-posts/handler";
export * from "./blog/get-published-blog-post/spec";
export * from "./blog/get-published-blog-post/handler";
export * from "./blog/get-blog-rss-feed/spec";
export * from "./blog/get-blog-rss-feed/handler";
export * from "./blog/evict-blog-cache/spec";
export * from "./blog/evict-blog-cache/handler";
export * from "./blog/list-admin-blog-posts/spec";
export * from "./blog/list-admin-blog-posts/handler";
export * from "./blog/get-admin-blog-post-by-id/spec";
export * from "./blog/get-admin-blog-post-by-id/handler";
export * from "./blog/list-draft-blog-posts/spec";
export * from "./blog/list-draft-blog-posts/handler";
export * from "./blog/get-draft-blog-post/spec";
export * from "./blog/get-draft-blog-post/handler";
export * from "./blog/create-draft-blog-post/spec";
export * from "./blog/create-draft-blog-post/handler";
export * from "./blog/update-draft-blog-post/spec";
export * from "./blog/update-draft-blog-post/handler";
export * from "./blog/delete-blog-post/spec";
export * from "./blog/delete-blog-post/handler";
export * from "./blog/get-blog-reactions/spec";
export * from "./blog/get-blog-reactions/handler";
export * from "./blog/submit-blog-reaction/spec";
export * from "./blog/submit-blog-reaction/handler";
export * from "./blog/flush-blog-reactions/spec";
export * from "./blog/flush-blog-reactions/handler";

// Project Image & Media Asset Vertical Slices
export * from "./project-image/shared";
export * from "./project-image/validate-project-image/spec";
export * from "./project-image/validate-project-image/handler";
export * from "./project-image/get-media-asset/spec";
export * from "./project-image/get-media-asset/handler";
export * from "./project-image/upload-project-image/spec";
export * from "./project-image/upload-project-image/handler";
export * from "./project-image/delete-project-image/spec";
export * from "./project-image/delete-project-image/handler";

// Maintenance Pipeline Vertical Slice
export * from "./maintenance/shared";
export * from "./maintenance/run-maintenance-pipeline/spec";
export * from "./maintenance/run-maintenance-pipeline/handler";
