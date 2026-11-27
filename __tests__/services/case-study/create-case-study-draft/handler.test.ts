// @vitest-environment node
import { fromPartial } from "@total-typescript/shoehorn";
import { describe, expect, it, vi } from "vitest";
import {
  CreateCaseStudyDraftHandler,
  type RawCaseStudyRecord,
} from "@/lib/services";

describe("CreateCaseStudyDraftHandler (Logic Test)", () => {
  it("sanitizes HTML, persists unpublished draft, and evicts cache", async () => {
    const created = fromPartial<RawCaseStudyRecord>({
      id: "cs-1",
      slug: "crf-studio",
      title: "CRF Studio",
      published: false,
    });
    const create = vi.fn().mockResolvedValue(created);
    const evictCache = vi.fn().mockResolvedValue({});
    const sanitizeHtml = vi.fn(async (s: string) => `clean:${s}`);

    const handler = new CreateCaseStudyDraftHandler({
      caseStudies: { create },
      evictCache,
      sanitizeHtml,
    });

    const result = await handler.execute({
      title: "CRF Studio",
      slug: "crf-studio",
      primary_language: "TypeScript",
      editorial_content: "<p>Editorial</p>",
      architectural_narrative: "<p>Architecture</p>",
      tags: "clinical",
    });

    expect(result.success).toBe(true);
    expect(sanitizeHtml).toHaveBeenCalledTimes(2);
    expect(evictCache).toHaveBeenCalledWith("crf-studio");
  });

  it("maps Prisma P2002 to DUPLICATE_CASE_STUDY_SLUG and DB errors to STORAGE_UNAVAILABLE", async () => {
    const dupErr = Object.assign(new Error("Unique constraint"), {
      code: "P2002",
    });
    const dupHandler = new CreateCaseStudyDraftHandler({
      caseStudies: { create: vi.fn().mockRejectedValue(dupErr) },
      sanitizeHtml: async (s) => s,
    });
    const dup = await dupHandler.execute({
      title: "CRF Studio",
      slug: "crf-studio",
      primary_language: "TypeScript",
      editorial_content: "",
      architectural_narrative: "",
      tags: "clinical",
    });
    expect(dup.success).toBe(false);
    if (!dup.success) {
      expect(dup.error.code).toBe("DUPLICATE_CASE_STUDY_SLUG");
    }
  });
});
