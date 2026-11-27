// @vitest-environment node
import { fromPartial } from "@total-typescript/shoehorn";
import { describe, expect, it, vi } from "vitest";
import type { CaseStudyData } from "@/lib/services";
import {
  UploadProjectImageHandler,
  createFailure,
  createSuccess,
} from "@/lib/services";

const VALID_PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);

describe("UploadProjectImageHandler (Logic Test)", () => {
  it("validates magic bytes, saves asset, and updates case study image", async () => {
    const existing = fromPartial<CaseStudyData>({
      slug: "crf-studio",
      hero_image_url: null,
    });
    const updated = fromPartial<CaseStudyData>({
      slug: "crf-studio",
      hero_image_url: "/api/media/crf-studio-new.png",
    });
    const saveAsset = vi
      .fn()
      .mockResolvedValue(createSuccess("/api/media/crf-studio-new.png"));

    const handler = new UploadProjectImageHandler({
      getCaseStudyBySlug: vi.fn().mockResolvedValue(createSuccess(existing)),
      updateCaseStudyImage: vi.fn().mockResolvedValue(createSuccess(updated)),
      saveAsset,
      deleteAsset: vi.fn().mockResolvedValue(createSuccess(null)),
    });

    const result = await handler.execute({
      slug: "crf-studio",
      fileBuffer: VALID_PNG,
      mimeType: "image/png",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.hero_image_url).toBe("/api/media/crf-studio-new.png");
    }
    expect(saveAsset).toHaveBeenCalledTimes(1);
  });

  it("rejects mismatched magic bytes and rolls back saved asset on DB failure", async () => {
    const deleteAsset = vi.fn().mockResolvedValue(createSuccess(null));
    const handler = new UploadProjectImageHandler({
      getCaseStudyBySlug: vi.fn().mockResolvedValue(
        createSuccess(
          fromPartial<CaseStudyData>({
            slug: "crf-studio",
            hero_image_url: null,
          })
        )
      ),
      saveAsset: vi
        .fn()
        .mockResolvedValue(createSuccess("/api/media/crf-studio-new.png")),
      updateCaseStudyImage: vi
        .fn()
        .mockResolvedValue(createFailure("PERSISTENCE_FAILED", "DB down")),
      deleteAsset,
    });

    const badMagic = await handler.execute({
      slug: "crf-studio",
      fileBuffer: Buffer.from("not-a-png-header"),
      mimeType: "image/png",
    });
    expect(badMagic.success).toBe(false);
    if (!badMagic.success) {
      expect(badMagic.error.code).toBe("MALFORMED_HEADER");
    }

    const rollback = await handler.execute({
      slug: "crf-studio",
      fileBuffer: VALID_PNG,
      mimeType: "image/png",
    });
    expect(rollback.success).toBe(false);
    expect(deleteAsset).toHaveBeenCalledTimes(1);
  });
});
