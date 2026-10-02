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
});
