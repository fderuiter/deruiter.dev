// @vitest-environment node
import { fromAny } from "@total-typescript/shoehorn";
import { describe, expect, it } from "vitest";
import {
  ProjectImageErrorCode,
  UploadProjectImageInputSchema,
} from "@/lib/services";

describe("UploadProjectImageInputSchema (Contract Test)", () => {
  it("accepts valid slug, Buffer, and mimeType", () => {
    const parsed = UploadProjectImageInputSchema.safeParse({
      slug: "crf-studio",
      fileBuffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      mimeType: "image/png",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects empty slug or non-Buffer payload", () => {
    const parsed = UploadProjectImageInputSchema.safeParse({
      slug: "",
      fileBuffer: fromAny("not-a-buffer"),
      mimeType: "image/png",
    });
    expect(parsed.success).toBe(false);
    expect(ProjectImageErrorCode.options).toContain("EMPTY_PAYLOAD");
  });
});
