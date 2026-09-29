import { z } from "zod";
import { validateConstructiveContent } from "@/lib/moderation";
import { CONTENT_PILLARS } from "@/lib/blog/types";

const BLOG_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Runtime contract for a new, server-owned unpublished BlogPost draft. */
export const BlogDraftCreateSchema = z
  .object({
    title: z.string().trim().min(3).max(180),
    slug: z
      .string()
      .trim()
      .min(3)
      .max(120)
      .regex(BLOG_SLUG_PATTERN, "Slug must be lowercase kebab-case"),
    dek: z.string().trim().min(10).max(500),
    body: z.string().trim().min(1).max(50_000),
    pillar: z.enum(CONTENT_PILLARS),
    tags: z.array(z.string().trim().min(1).max(50)).min(1).max(12),
    heroImageUrl: z.string().trim().url().max(2048).nullable().optional(),
  })
  .strict()
  .transform((data) => ({
    ...data,
    tags: data.tags.join(", "),
    hero_image_url: data.heroImageUrl || null,
  }));

/** Runtime contract for an existing BlogPost draft route parameter. */
export const BlogDraftIdParamsSchema = z
  .object({
    id: z.string().trim().min(1).max(191),
  })
  .strict();

/**
 * Runtime contract for a partial, server-owned BlogPost draft edit. Publication,
 * identity, and timestamp fields are intentionally omitted and rejected by strict mode.
 */
export const BlogDraftUpdateSchema = z
  .object({
    title: z.string().trim().min(3).max(180).optional(),
    slug: z
      .string()
      .trim()
      .min(3)
      .max(120)
      .regex(BLOG_SLUG_PATTERN, "Slug must be lowercase kebab-case")
      .optional(),
    dek: z.string().trim().min(10).max(500).optional(),
    body: z.string().trim().min(1).max(50_000).optional(),
    pillar: z.enum(CONTENT_PILLARS).optional(),
    tags: z.array(z.string().trim().min(1).max(50)).min(1).max(12).optional(),
    heroImageUrl: z.string().trim().url().max(2048).nullable().optional(),
    published: z.boolean().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one editable draft field is required",
  });

/** Runtime contract for bounded, deterministic admin draft collection pagination. */
export const BlogDraftPaginationSchema = z
  .object({
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

/**
 * Schema for telemetry POST payload validation
 */
export const TelemetryEventSchema = z.object({
  projectSlug: z.string().min(1, "projectSlug must be a non-empty string"),
  eventType: z.enum(
    [
      "page_view",
      "project_click",
      "route_error",
      "simulator_option_select",
      "simulator_milestone_reached",
      "simulator_schedule_click",
      "simulator_report_copy",
    ],
    {
      message:
        "Allowed: 'page_view', 'project_click', 'route_error', 'simulator_option_select', 'simulator_milestone_reached', 'simulator_schedule_click', 'simulator_report_copy'",
    }
  ),
});

/**
 * Schema for sliding window rate limit parameters
 */
export const RateLimitParamsSchema = z.object({
  windowMs: z.number().int().positive().default(60000),
  maxRequests: z.number().int().positive().default(100),
});

/**
 * Schema for fallback secondary memory properties
 */
export const FallbackMemorySchema = z.object({
  redisUrl: z.string().url("Must be a valid redis connection URL").optional(),
  redisToken: z.string().min(1, "Redis token cannot be empty").optional(),
  ttlSeconds: z.number().int().positive().default(172800), // 48 hours
});

/**
 * Schema for background sync cron query parameters
 */
export const SyncParamsSchema = z.object({
  batch: z.coerce
    .number()
    .int()
    .positive("Batch must be a positive integer")
    .max(500, "Batch cannot exceed 500")
    .default(50),
});

/**
 * Schema for Case Study Summary item
 */
export const CaseStudySummarySchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  title: z.string().min(1),
  primary_language: z.string().min(1),
  tags: z
    .string()
    .describe(
      'Comma-separated tag list exactly as stored on the case study, e.g. "clinical, edc, mapping". Split on commas and trim each entry to get individual tags.'
    ),
});

/**
 * Schema for Case Study list response
 */
export const CaseStudyListResponseSchema = z.array(CaseStudySummarySchema);

/**
 * Schema for Case Study submission POST payload validation
 */
export const CaseStudySubmissionSchema = z
  .object({
    title: z
      .string({ message: "Title is required" })
      .trim()
      .min(1, "Title is required"),
    slug: z
      .string({ message: "Slug is required" })
      .trim()
      .min(1, "Slug is required")
      .regex(
        /^[a-zA-Z0-9-_]+$/,
        "Slug must contain only alphanumeric characters, hyphens, and underscores"
      ),
    primary_language: z.string().trim().optional(),
    language: z.string().trim().optional(),
    editorial_content: z.string().trim().optional(),
    summary: z.string().trim().optional(),
    summary_markdown: z.string().trim().optional(),
    architectural_narrative: z.string().trim().optional(),
    narrative: z.string().trim().optional(),
    architectural_narrative_html: z.string().trim().optional(),
    tags: z.union(
      [
        z.string().trim().min(1, "Tags are required"),
        z
          .array(z.string().trim().min(1, "Tag cannot be empty"))
          .min(1, "At least one tag is required"),
      ],
      { message: "Tags are required" }
    ),
    github_url: z.string().trim().optional(),
    hero_image_url: z.string().trim().url().max(2048).nullable().optional(),
    heroImageUrl: z.string().trim().url().max(2048).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    const lang = data.primary_language || data.language;
    if (!lang) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Primary language is required",
        path: ["primary_language"],
      });
    }

    const ed = data.editorial_content || data.summary || data.summary_markdown;
    if (!ed) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Summary / editorial content is required",
        path: ["editorial_content"],
      });
    }

    const arch =
      data.architectural_narrative ||
      data.narrative ||
      data.architectural_narrative_html;
    if (!arch) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Architectural narrative is required",
        path: ["architectural_narrative"],
      });
    }

    // Content Moderation & Tone Validation
    if (data.title) {
      const check = validateConstructiveContent(data.title);
      if (!check.isValid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: check.reason || "Title violates community tone standards",
          path: ["title"],
        });
      }
    }

    if (ed) {
      const check = validateConstructiveContent(ed);
      if (!check.isValid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: check.reason || "Summary violates community tone standards",
          path: ["editorial_content"],
        });
      }
    }

    if (arch) {
      const check = validateConstructiveContent(arch);
      if (!check.isValid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            check.reason ||
            "Architectural narrative violates community tone standards",
          path: ["architectural_narrative"],
        });
      }
    }

    const tagsStr = Array.isArray(data.tags) ? data.tags.join(" ") : data.tags;
    if (tagsStr) {
      const check = validateConstructiveContent(tagsStr);
      if (!check.isValid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: check.reason || "Tags violate community tone standards",
          path: ["tags"],
        });
      }
    }
  })
  .transform((data) => {
    const lang = data.primary_language || data.language || "";
    const ed =
      data.editorial_content || data.summary || data.summary_markdown || "";
    const arch =
      data.architectural_narrative ||
      data.narrative ||
      data.architectural_narrative_html ||
      "";
    const tagsStr = Array.isArray(data.tags) ? data.tags.join(", ") : data.tags;

    return {
      title: data.title,
      slug: data.slug,
      primary_language: lang,
      editorial_content: ed,
      architectural_narrative: arch,
      tags: tagsStr,
      github_url: data.github_url || null,
    };
  });

/**
 * Allowed reaction types
 */
export const ALLOWED_REACTIONS = [
  "insightful",
  "mind_blowing",
  "actionable",
  "thorough",
] as const;

/**
 * Schema for Feedback POST payload validation
 */
export const FeedbackSubmissionSchema = z
  .object({
    caseStudySlug: z
      .string()
      .min(1, "caseStudySlug must be a non-empty string"),
    takeaways: z
      .array(z.string().min(1, "Takeaway cannot be empty"))
      .min(1, "At least one learning takeaway must be selected"),
    comments: z
      .string()
      .min(3, "Comments must be at least 3 characters long")
      .max(2000, "Comments cannot exceed 2000 characters"),
  })
  .superRefine((data, ctx) => {
    if (data.comments) {
      const commentsCheck = validateConstructiveContent(data.comments);
      if (!commentsCheck.isValid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            commentsCheck.reason ||
            "Submission text violates community tone standards",
          path: ["comments"],
        });
      }
    }

    if (Array.isArray(data.takeaways)) {
      data.takeaways.forEach((takeaway, idx) => {
        const takeawayCheck = validateConstructiveContent(takeaway);
        if (!takeawayCheck.isValid) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              takeawayCheck.reason ||
              "Submission text violates community tone standards",
            path: ["takeaways", idx],
          });
        }
      });
    }
  });

/**
 * Schema for Reaction POST payload validation
 */
export const ReactionSubmissionSchema = z.object({
  caseStudySlug: z.string().min(1, "caseStudySlug must be a non-empty string"),
  reactionType: z.enum(ALLOWED_REACTIONS, {
    message:
      "Allowed reactionType values: 'insightful', 'mind_blowing', 'actionable', 'thorough'",
  }),
});

/**
 * Schema for Blog Post Reaction POST payload validation
 */
export const BlogPostReactionSubmissionSchema = z.object({
  blogPostSlug: z
    .string()
    .trim()
    .min(1, "blogPostSlug must be a non-empty string"),
  reactionType: z.enum(ALLOWED_REACTIONS, {
    message:
      "Allowed reactionType values: 'insightful', 'mind_blowing', 'actionable', 'thorough'",
  }),
});

/**
 * Allowed intent categories for visitor contact submissions
 */
export const CONTACT_INTENTS = [
  "general",
  "collaboration",
  "consulting",
  "recruiting",
  "other",
] as const;
export type ContactIntent = (typeof CONTACT_INTENTS)[number];

/**
 * Schema for Contact submission POST payload validation
 */
export const ContactSubmissionSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters")
      .max(100, "Name cannot exceed 100 characters"),
    email: z.string().trim().email("Please provide a valid email address"),
    intent: z
      .enum(CONTACT_INTENTS, {
        message:
          "Intent must be one of: 'general', 'collaboration', 'consulting', 'recruiting', 'other'",
      })
      .default("general"),
    subject: z
      .string()
      .trim()
      .min(3, "Subject must be at least 3 characters")
      .max(150, "Subject cannot exceed 150 characters"),
    message: z
      .string()
      .trim()
      .min(10, "Message must be at least 10 characters")
      .max(5000, "Message cannot exceed 5000 characters"),
    _gotcha: z.string().optional(),
    _clientTimestamp: z.number().int().positive().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.name) {
      const check = validateConstructiveContent(data.name);
      if (!check.isValid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: check.reason || "Name violates community tone standards",
          path: ["name"],
        });
      }
    }

    if (data.subject) {
      const check = validateConstructiveContent(data.subject);
      if (!check.isValid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: check.reason || "Subject violates community tone standards",
          path: ["subject"],
        });
      }
    }

    if (data.message) {
      const check = validateConstructiveContent(data.message);
      if (!check.isValid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: check.reason || "Message violates community tone standards",
          path: ["message"],
        });
      }
    }
  });

export type ContactSubmission = z.infer<typeof ContactSubmissionSchema>;

/**
 * Schema for Contact submission API response
 */
export const ContactResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  messageId: z.string().optional(),
  simulated: z.boolean().optional(),
});

export type ContactResponse = z.infer<typeof ContactResponseSchema>;

/**
 * Schema for Newsletter subscription POST payload validation
 */
export const NewsletterSubscriptionSchema = z.object({
  email: z.string().trim().email("Please provide a valid email address"),
  _gotcha: z.string().optional(),
  _clientTimestamp: z.number().int().positive().optional(),
});

export type NewsletterSubscription = z.infer<
  typeof NewsletterSubscriptionSchema
>;

/**
 * Schema for Newsletter subscription API response
 */
export const NewsletterResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  subscriberId: z.string().optional(),
  simulated: z.boolean().optional(),
});

export type NewsletterResponse = z.infer<typeof NewsletterResponseSchema>;

/**
 * Schema for the token query parameter on the newsletter confirmation and
 * one-click unsubscribe links (#841).
 */
export const NewsletterTokenQuerySchema = z.object({
  token: z
    .string()
    .trim()
    .min(16, "Invalid or expired link")
    .max(128, "Invalid or expired link"),
});

export type NewsletterTokenQuery = z.infer<typeof NewsletterTokenQuerySchema>;

/**
 * Allowed Resend webhook lifecycle event types
 */
export const RESEND_EVENT_TYPES = [
  "email.sent",
  "email.delivered",
  "email.delivery_delayed",
  "email.complained",
  "email.bounced",
  "email.opened",
  "email.clicked",
] as const;

export type ResendEventType = (typeof RESEND_EVENT_TYPES)[number];

/**
 * Schema for Resend Webhook POST payload validation
 */
export const ResendWebhookEventSchema = z.object({
  type: z.enum(RESEND_EVENT_TYPES, {
    message: "Invalid or unsupported Resend event type",
  }),
  created_at: z.string().optional(),
  data: z
    .object({
      id: z.string().optional(),
      from: z.string().optional(),
      to: z.array(z.string()).optional(),
      subject: z.string().optional(),
      created_at: z.string().optional(),
      status: z.string().optional(),
      bounce: z
        .object({
          message: z.string().optional(),
          type: z.string().optional(),
        })
        .optional(),
    })
    .passthrough(),
});

export type ResendWebhookEvent = z.infer<typeof ResendWebhookEventSchema>;

/**
 * Schema for Resend Webhook response
 */
export const ResendWebhookResponseSchema = z.object({
  received: z.boolean(),
  processedEvent: z.string().optional(),
  suppressed: z.boolean().optional(),
});

export type ResendWebhookResponse = z.infer<typeof ResendWebhookResponseSchema>;

/**
 * Body of the delayed QStash message that asks the app to retry one queued
 * outbound email (#715). Carries only the queue id; the message content stays
 * in the database.
 */
export const QStashRetryPayloadSchema = z.object({
  queueId: z.string().min(1).max(64),
});

export type QStashRetryPayload = z.infer<typeof QStashRetryPayloadSchema>;

/** Response of the QStash email-retry webhook. */
export const QStashRetryResponseSchema = z.object({
  received: z.boolean(),
  queueId: z.string().optional(),
  processed: z.number().int().nonnegative().optional(),
  succeeded: z.number().int().nonnegative().optional(),
  failed: z.number().int().nonnegative().optional(),
  rescheduled: z.boolean().optional(),
  ignored: z.string().optional(),
});

export type QStashRetryResponse = z.infer<typeof QStashRetryResponseSchema>;

/** Alias for NewsletterSubscriptionSchema to match OpenAPI naming convention */
export const NewsletterSubmissionSchema = NewsletterSubscriptionSchema;

/** Alias for ContactResponseSchema to match OpenAPI naming convention */
export const ContactPostResponseSchema = ContactResponseSchema;

/** Schema for validation error details */
export const ValidationErrorItemSchema = z.object({
  path: z.string(),
  message: z.string(),
});

/** Schema for standardized validation error responses */
export const ValidationErrorSchema = z.object({
  error: z.string(),
  details: z.array(ValidationErrorItemSchema).optional(),
});

/** Schema for individual maintenance phase summary counters */
export const MaintenancePhaseSummarySchema = z.object({
  status: z.enum(["completed", "failed", "timed_out", "skipped"]),
  durationMs: z.number().int(),
  counts: z.record(z.string(), z.number().int().nullable()),
  error: z.string().optional(),
});

/** Schema for maintenance execution pipeline summary */
export const MaintenanceSummarySchema = z.object({
  success: z.boolean(),
  partial: z.boolean(),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime(),
  durationMs: z.number().int(),
  deadlineMs: z.number().int().max(8000),
  phases: z.record(z.string(), MaintenancePhaseSummarySchema),
});

/** Schema for standardized simple error responses */
export const ErrorResponseSchema = z.object({
  error: z.string(),
});

/** Schema for persisted BlogDraft entity */
export const BlogDraftSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  dek: z.string(),
  body: z.string(),
  pillar: z.string(),
  tags: z.string(),
  published: z.literal(false),
  reading_time_minutes: z.number().int().min(1).nullable().optional(),
  hero_image_url: z.string().url().nullable().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

/** Schema for paginated BlogDraft collection */
export const BlogDraftCollectionSchema = z.object({
  data: z.array(BlogDraftSchema),
  pagination: z.object({
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1).max(100),
    total: z.number().int().min(0),
  }),
});

/** Schema for BlogDraft create response */
export const BlogDraftCreateResponseSchema = z.object({
  success: z.literal(true),
  data: BlogDraftSchema,
});

/** Schema for BlogDraft read response */
export const BlogDraftReadResponseSchema = z.object({
  data: BlogDraftSchema,
});

/** Schema for BlogDraft update response */
export const BlogDraftUpdateResponseSchema = z.object({
  success: z.literal(true),
  data: BlogDraftSchema,
});

/** Schema for individual learning feedback item */
export const FeedbackItemSchema = z.object({
  id: z.string(),
  takeaways: z.array(z.string()),
  comments: z.string(),
  createdAt: z.string().datetime(),
});

/** Schema for Feedback GET response */
export const FeedbackGetResponseSchema = z.object({
  success: z.boolean(),
  caseStudySlug: z.string(),
  hasSubmitted: z.boolean(),
  totalFeedback: z.number().int(),
  feedback: z.array(FeedbackItemSchema),
});

/** Schema for Feedback POST response */
export const FeedbackPostResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  feedback: z.object({
    id: z.string(),
    caseStudySlug: z.string(),
    takeaways: z.array(z.string()),
    comments: z.string(),
    createdAt: z.string().datetime(),
  }),
});

/** Schema for Reaction counts breakdown */
export const ReactionCountsSchema = z.object({
  insightful: z.number().int(),
  mind_blowing: z.number().int(),
  actionable: z.number().int(),
  thorough: z.number().int(),
});

/** Schema for Reaction GET response */
export const ReactionGetResponseSchema = z.object({
  success: z.boolean(),
  caseStudySlug: z.string(),
  counts: ReactionCountsSchema,
  userReactions: z.array(z.string()),
});

/** Schema for Reaction POST response */
export const ReactionPostResponseSchema = z.object({
  success: z.boolean(),
  reactionType: z.enum(ALLOWED_REACTIONS),
  counts: ReactionCountsSchema,
  userReactions: z.array(z.string()),
});

/** Schema for CaseStudy POST response */
export const CaseStudyPostResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    id: z.string(),
    slug: z.string(),
    title: z.string(),
    primary_language: z.string(),
    editorial_content: z.string(),
    architectural_narrative: z.string(),
    published: z.boolean(),
    tags: z.string(),
    created_at: z.string().datetime().optional(),
  }),
});

/** Schema for Telemetry POST response */
export const TelemetryPostResponseSchema = z.object({
  success: z.boolean(),
  durable: z.boolean(),
  event: z.object({
    id: z.string(),
    projectSlug: z.string(),
    eventType: z.string(),
    createdAt: z.string().datetime(),
  }),
});

/** Schema for Telemetry sync cron response */
export const TelemetrySyncResponseSchema = z.object({
  success: z.boolean(),
  processed: z.number().int(),
  inserted: z.number().int().optional(),
  reactions: z
    .object({
      processed: z.number().int(),
      inserted: z.number().int(),
    })
    .optional(),
});

/**
 * Schema for route parameters targeting a specific project/case study slug.
 */
export const ProjectSlugParamSchema = z.object({
  slug: z.string().trim().min(1, "Project slug is required"),
});
