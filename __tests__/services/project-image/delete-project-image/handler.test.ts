// @vitest-environment node
import { fromPartial } from "@total-typescript/shoehorn";
import { describe, expect, it, vi } from "vitest";
import type { CaseStudyData } from "@/lib/services";
import {
  DeleteProjectImageHandler,
  createFailure,
  createSuccess,
} from "@/lib/services";

describe("DeleteProjectImageHandler (Logic Test)", () => {
  it("clears hero_image_url and deletes owned media asset", async () => {
    const existing = fromPartial<CaseStudyData>({
      slug: "crf-studio",
      hero_image_url: "/api/media/crf-studio-hero.png",
    });
    const cleared = fromPartial<CaseStudyData>({
      slug: "crf-studio",
      hero_image_url: null,
    });
    const deleteAsset = vi.fn().mockResolvedValue(createSuccess(null));

    const handler = new DeleteProjectImageHandler({
      getCaseStudyBySlug: vi.fn().mockResolvedValue(createSuccess(existing)),
      updateCaseStudyImage: vi.fn().mockResolvedValue(createSuccess(cleared)),
      deleteAsset,
    });

    const result = await handler.execute({ slug: "crf-studio" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        slug: "crf-studio",
        hero_image_url: null,
      });
    }
    expect(deleteAsset).toHaveBeenCalledWith("crf-studio-hero.png");
  });

  it("returns CASE_STUDY_NOT_FOUND or PERSISTENCE_FAILED without throwing", async () => {
    const missingHandler = new DeleteProjectImageHandler({
      getCaseStudyBySlug: vi.fn().mockResolvedValue(createSuccess(null)),
    });
    const missing = await missingHandler.execute({ slug: "unknown-slug" });
    expect(missing.success).toBe(false);
    if (!missing.success) {
      expect(missing.error.code).toBe("CASE_STUDY_NOT_FOUND");
    }

    const dbFailHandler = new DeleteProjectImageHandler({
      getCaseStudyBySlug: vi.fn().mockResolvedValue(
        createSuccess(
          fromPartial<CaseStudyData>({
            slug: "crf-studio",
            hero_image_url: null,
          })
        )
      ),
      updateCaseStudyImage: vi
        .fn()
        .mockResolvedValue(
          createFailure("PERSISTENCE_FAILED", "DB unavailable")
        ),
    });
    const dbFail = await dbFailHandler.execute({ slug: "crf-studio" });
    expect(dbFail.success).toBe(false);
    if (!dbFail.success) {
      expect(dbFail.error.code).toBe("PERSISTENCE_FAILED");
    }
  });
});
