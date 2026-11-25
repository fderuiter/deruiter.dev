// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";
import {
  SubmitCaseStudyHandler,
  type CaseStudyDbRowLike,
  type SubmitCaseStudyDeps,
} from "@/lib/services";

describe("SubmitCaseStudyHandler (Logic Test)", () => {
  it("sanitizes HTML fields, persists draft case study, and evicts cache", async () => {
    const sanitizeHtml = vi.fn(async (html: string) =>
      html.replace(/<script>.*<\/script>/g, "")
    );
    const evictExecute = vi.fn(async () => ({
      success: true as const,
      data: { evicted: true },
    }));
    const createdRow = fromPartial<CaseStudyDbRowLike>({
      id: "cs-new",
      slug: "new-study",
      title: "New Study",
      published: false,
    });
    const deps = fromPartial<SubmitCaseStudyDeps>({
      sanitizeHtml,
      evictCacheHandler: { execute: evictExecute },
      db: {
        caseStudy: {
          create: async () => createdRow,
        },
      },
    });

    const handler = new SubmitCaseStudyHandler(deps);
    const result = await handler.execute({
      title: "New Study",
      slug: "new-study",
      primary_language: "TypeScript",
      editorial_content: "<p>Hello</p><script>x()</script>",
      architectural_narrative: "<p>World</p>",
      tags: "ts",
    });

    expect(result).toEqual({ success: true, data: createdRow });
    expect(sanitizeHtml).toHaveBeenCalledTimes(2);
    expect(evictExecute).toHaveBeenCalledWith({ slug: "new-study" });
  });

  it("maps Prisma P2002 unique constraint error to DUPLICATE_SLUG", async () => {
    const deps = fromPartial<SubmitCaseStudyDeps>({
      sanitizeHtml: async (html: string) => html,
      db: {
        caseStudy: {
          create: async () => {
            throw Object.assign(new Error("Unique constraint"), {
              code: "P2002",
            });
          },
        },
      },
    });

    const handler = new SubmitCaseStudyHandler(deps);
    const result = await handler.execute({
      title: "Dup Study",
      slug: "dup-study",
      primary_language: "TypeScript",
      editorial_content: "<p>A</p>",
      architectural_narrative: "<p>B</p>",
      tags: "ts",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("DUPLICATE_SLUG");
    }
  });
});
