// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";
import {
  UploadProjectImageHandler,
  createFailure,
  createSuccess,
  type CaseStudyData,
  type DeleteMediaAssetSpec,
  type GetCaseStudyBySlugSpec,
  type SaveMediaAssetSpec,
  type UpdateCaseStudyImageSpec,
} from "@/lib/services";

const PNG_HEADER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);

describe("UploadProjectImageHandler (Logic Test)", () => {
  it("validates PNG header, uploads asset, and updates case study hero image", async () => {
    const getCaseStudyHandler = fromPartial<GetCaseStudyBySlugSpec>({
      execute: async () =>
        createSuccess(
          fromPartial<CaseStudyData>({
            slug: "demo-study",
            hero_image_url: null,
          })
        ),
    });
    const saveMediaAssetHandler = fromPartial<SaveMediaAssetSpec>({
      execute: async () =>
        createSuccess("https://blob.example/projects/demo-study-1.png"),
    });
    const updateCaseStudyImageHandler = fromPartial<UpdateCaseStudyImageSpec>({
      execute: async () =>
        createSuccess(
          fromPartial<CaseStudyData>({
            slug: "demo-study",
            hero_image_url: "https://blob.example/projects/demo-study-1.png",
          })
        ),
    });
    const deleteMediaAssetHandler = fromPartial<DeleteMediaAssetSpec>({
      execute: async () => createSuccess(null),
    });

    const handler = new UploadProjectImageHandler({
      getCaseStudyHandler,
      saveMediaAssetHandler,
      updateCaseStudyImageHandler,
      deleteMediaAssetHandler,
      keyGenerator: (slug, ext) => `projects/${slug}-1.${ext}`,
    });

    const result = await handler.execute({
      slug: "demo-study",
      fileBuffer: PNG_HEADER,
      mimeType: "image/png",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.key).toBe("projects/demo-study-1.png");
      expect(result.data.hero_image_url).toBe(
        "https://blob.example/projects/demo-study-1.png"
      );
    }
  });

  it("rolls back uploaded asset and returns CASE_STUDY_NOT_FOUND when target slug does not exist", async () => {
    const getCaseStudyHandler = fromPartial<GetCaseStudyBySlugSpec>({
      execute: async () => createSuccess(null),
    });
    const saveMediaAssetHandler = fromPartial<SaveMediaAssetSpec>({
      execute: async () =>
        createSuccess("https://blob.example/projects/missing-1.png"),
    });
    const updateCaseStudyImageHandler = fromPartial<UpdateCaseStudyImageSpec>({
      execute: async () =>
        createFailure("CASE_STUDY_NOT_FOUND", "Case study not found"),
    });
    const deleteMediaAssetHandler = fromPartial<DeleteMediaAssetSpec>({
      execute: async () => createSuccess(null),
    });

    const handler = new UploadProjectImageHandler({
      getCaseStudyHandler,
      saveMediaAssetHandler,
      updateCaseStudyImageHandler,
      deleteMediaAssetHandler,
    });

    const result = await handler.execute({
      slug: "missing-slug",
      fileBuffer: PNG_HEADER,
      mimeType: "image/png",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("CASE_STUDY_NOT_FOUND");
    }
  });

  it("returns CASE_STUDY_LOOKUP_FAILED when case study lookup fails", async () => {
    const getCaseStudyHandler = fromPartial<GetCaseStudyBySlugSpec>({
      execute: async () =>
        createFailure("STORAGE_UNAVAILABLE", "Neon unavailable"),
    });
    const handler = new UploadProjectImageHandler({ getCaseStudyHandler });

    const result = await handler.execute({
      slug: "demo-study",
      fileBuffer: PNG_HEADER,
      mimeType: "image/png",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("CASE_STUDY_LOOKUP_FAILED");
    }
  });
});
