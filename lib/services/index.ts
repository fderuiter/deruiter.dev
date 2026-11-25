/**
 * Central Public Entry Point for Domain Services and Typed Service Contracts
 * Adheres to ADR 0028 Vertical Slice Architecture (Spec & Handler Pattern).
 */

// Shared Service Envelope, Client Simulation Slices, and Privacy Slices
export * from "./client";

// Media Storage Adapters
export * from "./media-storage";

// Telemetry Vertical Slices
export * from "./telemetry/shared";
export * from "./telemetry/check-rate-limit/spec";
export * from "./telemetry/check-rate-limit/handler";
export * from "./telemetry/compute-aggregate-stats/spec";
export * from "./telemetry/compute-aggregate-stats/handler";
export * from "./telemetry/get-aggregate-stats/spec";
export * from "./telemetry/get-aggregate-stats/handler";
export * from "./telemetry/record-event/spec";
export * from "./telemetry/record-event/handler";
export * from "./telemetry/refresh-aggregate-stats/spec";
export * from "./telemetry/refresh-aggregate-stats/handler";
export * from "./telemetry/rollup-and-prune-events/spec";
export * from "./telemetry/rollup-and-prune-events/handler";
export * from "./telemetry/sync-buffered-events/spec";
export * from "./telemetry/sync-buffered-events/handler";

// Case Study Vertical Slices
export * from "./case-study/shared";
export * from "./case-study/evict-case-study-cache/spec";
export * from "./case-study/evict-case-study-cache/handler";
export * from "./case-study/flush-buffered-reactions/spec";
export * from "./case-study/flush-buffered-reactions/handler";
export * from "./case-study/get-all-published-case-studies/spec";
export * from "./case-study/get-all-published-case-studies/handler";
export * from "./case-study/get-case-study-by-slug/spec";
export * from "./case-study/get-case-study-by-slug/handler";
export * from "./case-study/get-feedback/spec";
export * from "./case-study/get-feedback/handler";
export * from "./case-study/get-published-case-studies/spec";
export * from "./case-study/get-published-case-studies/handler";
export * from "./case-study/get-reactions/spec";
export * from "./case-study/get-reactions/handler";
export * from "./case-study/submit-case-study/spec";
export * from "./case-study/submit-case-study/handler";
export * from "./case-study/submit-feedback/spec";
export * from "./case-study/submit-feedback/handler";
export * from "./case-study/submit-reaction/spec";
export * from "./case-study/submit-reaction/handler";
export * from "./case-study/update-case-study-image/spec";
export * from "./case-study/update-case-study-image/handler";

// Blog Vertical Slices
export * from "./blog/shared";
export * from "./blog/create-draft-blog-post/spec";
export * from "./blog/create-draft-blog-post/handler";
export * from "./blog/delete-blog-post/spec";
export * from "./blog/delete-blog-post/handler";
export * from "./blog/evict-blog-post-cache/spec";
export * from "./blog/evict-blog-post-cache/handler";
export * from "./blog/flush-buffered-reactions/spec";
export * from "./blog/flush-buffered-reactions/handler";
export * from "./blog/get-all-blog-posts-admin/spec";
export * from "./blog/get-all-blog-posts-admin/handler";
export * from "./blog/get-all-published-blog-posts/spec";
export * from "./blog/get-all-published-blog-posts/handler";
export * from "./blog/get-blog-post-by-id/spec";
export * from "./blog/get-blog-post-by-id/handler";
export * from "./blog/get-blog-post-by-slug/spec";
export * from "./blog/get-blog-post-by-slug/handler";
export * from "./blog/get-draft-blog-post-by-id/spec";
export * from "./blog/get-draft-blog-post-by-id/handler";
export * from "./blog/get-draft-blog-posts/spec";
export * from "./blog/get-draft-blog-posts/handler";
export * from "./blog/get-reactions/spec";
export * from "./blog/get-reactions/handler";
export * from "./blog/hydrate-reaction-counts/spec";
export * from "./blog/hydrate-reaction-counts/handler";
export * from "./blog/submit-reaction/spec";
export * from "./blog/submit-reaction/handler";
export * from "./blog/update-draft-blog-post/spec";
export * from "./blog/update-draft-blog-post/handler";

// Outbound Email Vertical Slices
export * from "./email/shared";
export * from "./email/check-recipient-eligibility/spec";
export * from "./email/check-recipient-eligibility/handler";
export * from "./email/enqueue-email/spec";
export * from "./email/enqueue-email/handler";
export * from "./email/get-retry-queue-health/spec";
export * from "./email/get-retry-queue-health/handler";
export * from "./email/get-suppressed-emails/spec";
export * from "./email/get-suppressed-emails/handler";
export * from "./email/handle-webhook-event/spec";
export * from "./email/handle-webhook-event/handler";
export * from "./email/process-retry-queue/spec";
export * from "./email/process-retry-queue/handler";
export * from "./email/queue-outbound-email/spec";
export * from "./email/queue-outbound-email/handler";
export * from "./email/record-suppression/spec";
export * from "./email/record-suppression/handler";
export * from "./email/send-contact-inquiry/spec";
export * from "./email/send-contact-inquiry/handler";
export * from "./email/send-feedback-notification/spec";
export * from "./email/send-feedback-notification/handler";
export * from "./email/send-raw-email/spec";
export * from "./email/send-raw-email/handler";
export * from "./email/verify-svix-signature/spec";
export * from "./email/verify-svix-signature/handler";

// Newsletter Vertical Slices
export * from "./newsletter/shared";
export * from "./newsletter/audit-null-queue-deliveries/spec";
export * from "./newsletter/audit-null-queue-deliveries/handler";
export * from "./newsletter/confirm-subscriber/spec";
export * from "./newsletter/confirm-subscriber/handler";
export * from "./newsletter/dispatch-due/spec";
export * from "./newsletter/dispatch-due/handler";
export * from "./newsletter/queue-post-announcement/spec";
export * from "./newsletter/queue-post-announcement/handler";
export * from "./newsletter/subscribe-newsletter/spec";
export * from "./newsletter/subscribe-newsletter/handler";
export * from "./newsletter/unsubscribe-subscriber/spec";
export * from "./newsletter/unsubscribe-subscriber/handler";

// Project Image Vertical Slices
export * from "./project-image/shared";
export * from "./project-image/delete-media-asset/spec";
export * from "./project-image/delete-media-asset/handler";
export * from "./project-image/get-media-asset/spec";
export * from "./project-image/get-media-asset/handler";
export * from "./project-image/save-media-asset/spec";
export * from "./project-image/save-media-asset/handler";
export * from "./project-image/upload-project-image/spec";
export * from "./project-image/upload-project-image/handler";
export * from "./project-image/validate-project-image/spec";
export * from "./project-image/validate-project-image/handler";

// Maintenance Pipeline Vertical Slice
export * from "./maintenance/shared";
export * from "./maintenance/run-maintenance/spec";
export * from "./maintenance/run-maintenance/handler";
