// @vitest-environment node
import { describe, expect, it } from "vitest";
import { UploadProjectImageInputSchema } from "@/lib/services";

describe("UploadProjectImageInputSchema (Contract Test)", () => {
  it("accepts valid slug, fileBuffer, and mimeType", () => {
    expect(
      UploadProjectImageInputSchema.safeParse({
        slug: "imednet-python-sdk",
        fileBuffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
        mimeType: "image/png",
      }).success
    ).toBe(true);
  });

  it("rejects empty slug", () => {
    expect(
      UploadProjectImageInputSchema.safeParse({
        slug: "",
        fileBuffer: Buffer.from([1]),
        mimeType: "image/png",
      }).success
    ).toBe(false);
  });
});
