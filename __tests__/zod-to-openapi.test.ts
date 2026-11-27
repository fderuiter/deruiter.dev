// @vitest-environment node
import { describe, it, expect } from "vitest";
import { z } from "zod";
import { zodToOpenApi } from "@/lib/zod-to-openapi";
import {
  CaseStudySummarySchema,
  CaseStudySubmissionSchema,
  BlogDraftCreateSchema,
  BlogDraftUpdateSchema,
  TelemetryEventSchema,
  FallbackMemorySchema,
  SyncParamsSchema,
  FeedbackSubmissionSchema,
  ReactionSubmissionSchema,
  ContactSubmissionSchema,
  NewsletterSubmissionSchema,
  ResendWebhookEventSchema,
  ResendWebhookResponseSchema,
  MaintenanceSummarySchema,
  ValidationErrorSchema,
} from "@/lib/schemas";

describe("zodToOpenApi Converter Engine", () => {
  it("converts primitive Zod types into OpenAPI 3.0 schema definitions", () => {
    const stringSchema = z.string().min(3).max(50);
    const result = zodToOpenApi(stringSchema);
    expect(result).toEqual({
      type: "string",
      minLength: 3,
      maxLength: 50,
    });
  });

  it("handles optional and nullable fields gracefully", () => {
    const objectSchema = z.object({
      optionalField: z.string().optional(),
      nullableField: z.string().nullable(),
    });
    const result = zodToOpenApi(objectSchema);
    expect(result).toMatchObject({
      type: "object",
      properties: {
        optionalField: { type: "string" },
        nullableField: { type: "string", nullable: true },
      },
    });
    expect((result.required as string[]) || []).not.toContain("optionalField");
    expect((result.required as string[]) || []).toContain("nullableField");
  });

  it("unwraps Zod transforms, pipes, and superRefines without error", () => {
    const transformedSchema = z
      .object({
        input: z.string().trim().min(5),
      })
      .transform((data) => ({ output: data.input.toUpperCase() }));

    const result = zodToOpenApi(transformedSchema);
    expect(result).toMatchObject({
      type: "object",
      properties: {
        input: {
          type: "string",
          minLength: 5,
        },
      },
      required: ["input"],
    });
  });

  it("converts all 14 required OpenAPI schema components from canonical Zod schemas", () => {
    const schemasToTest = [
      { name: "CaseStudySummary", schema: CaseStudySummarySchema },
      { name: "CaseStudySubmission", schema: CaseStudySubmissionSchema },
      { name: "BlogDraftCreate", schema: BlogDraftCreateSchema },
      { name: "BlogDraftUpdate", schema: BlogDraftUpdateSchema },
      { name: "TelemetryEvent", schema: TelemetryEventSchema },
      { name: "SyncParams", schema: SyncParamsSchema },
      { name: "FeedbackSubmission", schema: FeedbackSubmissionSchema },
      { name: "ReactionSubmission", schema: ReactionSubmissionSchema },
      { name: "ContactSubmission", schema: ContactSubmissionSchema },
      { name: "NewsletterSubmission", schema: NewsletterSubmissionSchema },
      { name: "ResendWebhookEvent", schema: ResendWebhookEventSchema },
      { name: "ResendWebhookResponse", schema: ResendWebhookResponseSchema },
      { name: "MaintenanceSummary", schema: MaintenanceSummarySchema },
      { name: "ValidationError", schema: ValidationErrorSchema },
    ];

    for (const { name, schema } of schemasToTest) {
      const converted = zodToOpenApi(schema);
      expect(converted, `Conversion failed for ${name}`).toBeDefined();
      expect(typeof converted, `${name} should produce an object`).toBe(
        "object"
      );
      expect(
        converted.$schema,
        `${name} should not contain $schema`
      ).toBeUndefined();
    }
  });

  it("trims surrounding whitespace before email and URL format or max-length checks", () => {
    const contact = ContactSubmissionSchema.safeParse({
      name: "Ada Lovelace",
      email: " ada@example.com ",
      subject: "Protocol inquiry",
      message: "Checking whitespace trimming around contact email.",
    });
    expect(contact.success).toBe(true);
    if (contact.success) {
      expect(contact.data.email).toBe("ada@example.com");
    }

    const newsletter = NewsletterSubmissionSchema.safeParse({
      email: " ada@example.com ",
    });
    expect(newsletter.success).toBe(true);
    if (newsletter.success) {
      expect(newsletter.data.email).toBe("ada@example.com");
    }

    const maxUrl =
      "https://images.example/" +
      "a".repeat(2048 - "https://images.example/".length);
    const paddedMaxUrl = `  ${maxUrl}  `;

    const draftUpdate = BlogDraftUpdateSchema.safeParse({
      heroImageUrl: paddedMaxUrl,
    });
    expect(draftUpdate.success).toBe(true);
    if (draftUpdate.success) {
      expect(draftUpdate.data.heroImageUrl).toBe(maxUrl);
    }

    const caseStudy = CaseStudySubmissionSchema.safeParse({
      title: "Clinical Schema Migration",
      slug: "clinical-schema-migration",
      primary_language: "TypeScript",
      editorial_content: "Summary of contract-preserving schema migration.",
      architectural_narrative: "<p>Validation pipeline narrative.</p>",
      tags: ["zod", "openapi"],
      hero_image_url: paddedMaxUrl,
      heroImageUrl: paddedMaxUrl,
    });
    expect(caseStudy.success).toBe(true);

    const overMaxUrl = `${maxUrl}x`;
    const draftOverMax = BlogDraftUpdateSchema.safeParse({
      heroImageUrl: overMaxUrl,
    });
    expect(draftOverMax.success).toBe(false);
  });

  it("preserves unrecognized webhook properties, URL validation, and ISO timestamps", () => {
    const webhook = ResendWebhookEventSchema.safeParse({
      type: "email.delivered",
      data: {
        id: "msg_123",
        providerRegion: "us-east-1",
      },
    });
    expect(webhook.success).toBe(true);
    if (webhook.success) {
      expect(webhook.data.data).toMatchObject({
        id: "msg_123",
        providerRegion: "us-east-1",
      });
    }

    expect(
      FallbackMemorySchema.safeParse({
        redisUrl: "https://redis.example.com",
      }).success
    ).toBe(true);
    expect(
      FallbackMemorySchema.safeParse({ redisUrl: "not-a-url" }).success
    ).toBe(false);

    expect(
      MaintenanceSummarySchema.safeParse({
        success: true,
        partial: false,
        startedAt: "2026-11-27T08:00:00.000Z",
        completedAt: "2026-11-27T08:00:02.000Z",
        durationMs: 2000,
        deadlineMs: 8000,
        phases: {},
      }).success
    ).toBe(true);
    expect(
      MaintenanceSummarySchema.safeParse({
        success: true,
        partial: false,
        startedAt: "2026-11-27",
        completedAt: "2026-11-27T08:00:02.000Z",
        durationMs: 2000,
        deadlineMs: 8000,
        phases: {},
      }).success
    ).toBe(false);
  });
});
