import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { fromPartial } from "@total-typescript/shoehorn";
import { isCurrentUserAdmin } from "@/lib/auth/admin";
import { auth } from "@clerk/nextjs/server";
import { POST, DELETE } from "@/app/api/admin/projects/[slug]/image/route";
import { GET as getMediaAssetRoute } from "@/app/api/media/[key]/route";
import {
  ProjectImageService,
  MAX_PROJECT_IMAGE_SIZE_BYTES,
} from "@/lib/services/project-image-service";
import { CaseStudyService } from "@/lib/services/case-study-service";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import { logger } from "@/lib/logger";

vi.mock("@/lib/auth/admin", () => ({
  isCurrentUserAdmin: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/services/case-study-service", () => ({
  CaseStudyService: {
    getCaseStudyBySlug: vi.fn(),
    updateCaseStudyImage: vi.fn(),
  },
}));

// Valid PNG 1x1 image buffer
const VALID_PNG_BUFFER = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c63000100000500010d0a2d0b0000000049454e44ae426082",
  "hex"
);

// Valid JPEG header buffer
const VALID_JPEG_BUFFER = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46,
]);

function createMultipartRequest(
  url: string,
  fields: Record<
    string,
    string | { buffer: Buffer; filename: string; contentType: string }
  >
): NextRequest {
  const boundary =
    "----WebKitFormBoundary" + Math.random().toString(36).slice(2);
  const chunks: Buffer[] = [];

  for (const [name, val] of Object.entries(fields)) {
    if (typeof val === "string") {
      chunks.push(
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${val}\r\n`,
          "utf-8"
        )
      );
    } else {
      chunks.push(
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="${name}"; filename="${val.filename}"\r\nContent-Type: ${val.contentType}\r\n\r\n`,
          "utf-8"
        )
      );
      chunks.push(val.buffer);
      chunks.push(Buffer.from("\r\n", "utf-8"));
    }
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`, "utf-8"));
  const body = Buffer.concat(chunks);

  return new NextRequest(url, {
    method: "POST",
    headers: {
      "content-type": `multipart/form-data; boundary=${boundary}`,
      "content-length": String(body.length),
    },
    body,
  });
}

describe("API Admin Project Image Upload Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(fromPartial({ userId: "user_admin123" }));
    vi.mocked(isCurrentUserAdmin).mockResolvedValue(true);
    vi.mocked(CaseStudyService.getCaseStudyBySlug).mockResolvedValue({
      id: "cs_1",
      slug: "laser-loon",
      title: "Laser Loon",
      primary_language: "TypeScript",
      github_url: "https://github.com/test/laser-loon",
      published: true,
      simulated_telemetry: false,
      tags: "game, canvas",
      editorial_content: "Editorial narrative",
      architectural_narrative: "Architectural breakdown",
      hero_image_url: "/api/media/project-laser-loon-old.png",
      created_at: new Date(),
      updated_at: new Date(),
    });
    vi.mocked(CaseStudyService.updateCaseStudyImage).mockImplementation(
      async (slug, hero_image_url) =>
        createSuccess({
          id: "cs_1",
          slug,
          title: "Laser Loon",
          primary_language: "TypeScript",
          github_url: "https://github.com/test/laser-loon",
          published: true,
          simulated_telemetry: false,
          tags: "game, canvas",
          editorial_content: "Editorial narrative",
          architectural_narrative: "Architectural breakdown",
          hero_image_url,
          created_at: new Date(),
          updated_at: new Date(),
        })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 403 Forbidden when request is unauthenticated (no userId)", async () => {
    vi.mocked(auth).mockResolvedValue(fromPartial({ userId: null }));
    vi.mocked(isCurrentUserAdmin).mockResolvedValue(false);

    const req = createMultipartRequest(
      "http://localhost:3000/api/admin/projects/laser-loon/image",
      {
        file: {
          buffer: VALID_PNG_BUFFER,
          filename: "hero.png",
          contentType: "image/png",
        },
      }
    );

    const res = await POST(req, {
      params: Promise.resolve({ slug: "laser-loon" }),
    });
    expect(res.status).toBe(403);

    const data = await res.json();
    expect(data.error).toMatch(/Administrator access required/i);
  });

  it("returns 403 Forbidden when user is authenticated but not an admin", async () => {
    vi.mocked(auth).mockResolvedValue(fromPartial({ userId: "user_regular" }));
    vi.mocked(isCurrentUserAdmin).mockResolvedValue(false);

    const req = createMultipartRequest(
      "http://localhost:3000/api/admin/projects/laser-loon/image",
      {
        file: {
          buffer: VALID_PNG_BUFFER,
          filename: "hero.png",
          contentType: "image/png",
        },
      }
    );

    const res = await POST(req, {
      params: Promise.resolve({ slug: "laser-loon" }),
    });
    expect(res.status).toBe(403);

    const data = await res.json();
    expect(data.error).toMatch(/Administrator access required/i);
  });

  it("returns 400 Bad Request when file is missing in multipart form data", async () => {
    const req = createMultipartRequest(
      "http://localhost:3000/api/admin/projects/laser-loon/image",
      {}
    );

    const res = await POST(req, {
      params: Promise.resolve({ slug: "laser-loon" }),
    });
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toMatch(/Image file is required/i);
  });

  it("returns 400 Bad Request when file exceeds 5MB size limit", async () => {
    const oversizedBuffer = Buffer.alloc(MAX_PROJECT_IMAGE_SIZE_BYTES + 100);
    // Write valid PNG header
    VALID_PNG_BUFFER.copy(oversizedBuffer, 0, 0, 8);

    const req = createMultipartRequest(
      "http://localhost:3000/api/admin/projects/laser-loon/image",
      {
        file: {
          buffer: oversizedBuffer,
          filename: "large.png",
          contentType: "image/png",
        },
      }
    );

    const res = await POST(req, {
      params: Promise.resolve({ slug: "laser-loon" }),
    });
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toMatch(/exceeds/i);
  });

  it("returns 400 Bad Request for disallowed image MIME type", async () => {
    const req = createMultipartRequest(
      "http://localhost:3000/api/admin/projects/laser-loon/image",
      {
        file: {
          buffer: Buffer.from("echo hello"),
          filename: "malicious.sh",
          contentType: "application/x-sh",
        },
      }
    );

    const res = await POST(req, {
      params: Promise.resolve({ slug: "laser-loon" }),
    });
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toMatch(/Invalid image type/i);
  });

  it("returns 400 Bad Request when image magic bytes do not match MIME type", async () => {
    const req = createMultipartRequest(
      "http://localhost:3000/api/admin/projects/laser-loon/image",
      {
        file: {
          buffer: Buffer.from("NOT_A_REAL_PNG_FILE_HEADER"),
          filename: "fake.png",
          contentType: "image/png",
        },
      }
    );

    const res = await POST(req, {
      params: Promise.resolve({ slug: "laser-loon" }),
    });
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toMatch(/magic bytes/i);
  });

  it("successfully validates, persists, and links valid PNG image asset", async () => {
    const deleteSpy = vi.spyOn(ProjectImageService, "deleteMediaAsset");

    const req = createMultipartRequest(
      "http://localhost:3000/api/admin/projects/laser-loon/image",
      {
        file: {
          buffer: VALID_PNG_BUFFER,
          filename: "hero.png",
          contentType: "image/png",
        },
      }
    );

    const res = await POST(req, {
      params: Promise.resolve({ slug: "laser-loon" }),
    });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.slug).toBe("laser-loon");
    expect(data.data.hero_image_url).toMatch(
      /^\/api\/media\/project-laser-loon-/
    );
    expect(deleteSpy).toHaveBeenCalledWith("project-laser-loon-old.png");

    // Verify GET /api/media/[key] route serves the stored asset correctly
    const key = data.data.key;
    const mediaReq = new NextRequest(`http://localhost:3000/api/media/${key}`);
    const mediaRes = await getMediaAssetRoute(mediaReq, {
      params: Promise.resolve({ key }),
    });

    expect(mediaRes.status).toBe(200);
    expect(mediaRes.headers.get("Content-Type")).toBe("image/png");
    expect(mediaRes.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(mediaRes.headers.get("Cache-Control")).toContain("immutable");
    expect(mediaRes.headers.get("Content-Security-Policy")).toBe(
      "default-src 'none'"
    );
  });

  it("sanitizes SVG uploads with DOMPurify and enforces Content-Security-Policy on retrieval", async () => {
    const dirtySvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><script>alert(1)</script><circle cx="50" cy="50" r="40" onload="alert(2)"/><a href="https://evil.com"><text>Click</text></a></svg>`;
    const req = createMultipartRequest(
      "http://localhost:3000/api/admin/projects/laser-loon/image",
      {
        file: {
          buffer: Buffer.from(dirtySvg, "utf-8"),
          filename: "hero.svg",
          contentType: "image/svg+xml",
        },
      }
    );

    const res = await POST(req, {
      params: Promise.resolve({ slug: "laser-loon" }),
    });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);

    const key = data.data.key;
    const mediaReq = new NextRequest(`http://localhost:3000/api/media/${key}`);
    const mediaRes = await getMediaAssetRoute(mediaReq, {
      params: Promise.resolve({ key }),
    });

    expect(mediaRes.status).toBe(200);
    expect(mediaRes.headers.get("Content-Type")).toBe("image/svg+xml");
    expect(mediaRes.headers.get("Content-Security-Policy")).toBe(
      "default-src 'none'"
    );

    const servedBody = await mediaRes.text();
    expect(servedBody).not.toContain("<script");
    expect(servedBody).not.toContain("onload=");
    expect(servedBody).not.toContain("https://evil.com");
    expect(servedBody).toContain("<svg");
  });

  it("preserves prior asset when database update fails", async () => {
    vi.mocked(CaseStudyService.updateCaseStudyImage).mockResolvedValueOnce(
      createFailure("PERSISTENCE_FAILED", "Database connection lost")
    );
    const deleteSpy = vi.spyOn(ProjectImageService, "deleteMediaAsset");

    const req = createMultipartRequest(
      "http://localhost:3000/api/admin/projects/laser-loon/image",
      {
        file: {
          buffer: VALID_JPEG_BUFFER,
          filename: "hero.jpg",
          contentType: "image/jpeg",
        },
      }
    );

    const res = await POST(req, {
      params: Promise.resolve({ slug: "laser-loon" }),
    });
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("Failed to process and store project image");

    // Verify updateCaseStudyImage was called to roll back to prior asset
    expect(CaseStudyService.updateCaseStudyImage).toHaveBeenCalledWith(
      "laser-loon",
      "/api/media/project-laser-loon-old.png"
    );
    // The new asset is cleaned up; the prior asset is left in place.
    expect(deleteSpy).toHaveBeenCalledTimes(1);
    expect(deleteSpy).not.toHaveBeenCalledWith("project-laser-loon-old.png");
  });

  it("returns 400 with the service message when the case study does not exist", async () => {
    vi.mocked(CaseStudyService.getCaseStudyBySlug).mockResolvedValue(null);
    vi.mocked(CaseStudyService.updateCaseStudyImage).mockResolvedValueOnce(
      createFailure(
        "CASE_STUDY_NOT_FOUND",
        'Case study with slug "missing" not found',
        { recoverable: false }
      )
    );
    const deleteSpy = vi.spyOn(ProjectImageService, "deleteMediaAsset");

    const req = createMultipartRequest(
      "http://localhost:3000/api/admin/projects/missing/image",
      {
        file: {
          buffer: VALID_PNG_BUFFER,
          filename: "hero.png",
          contentType: "image/png",
        },
      }
    );

    const res = await POST(req, {
      params: Promise.resolve({ slug: "missing" }),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Case study with slug "missing" not found');
    // The uploaded asset is removed and no prior reference is restored.
    expect(deleteSpy).toHaveBeenCalledTimes(1);
    expect(CaseStudyService.updateCaseStudyImage).toHaveBeenCalledTimes(1);
  });

  it("returns a generic 500 when media storage rejects the upload", async () => {
    vi.spyOn(ProjectImageService, "saveMediaAsset").mockResolvedValue(
      createFailure("UPLOAD_FAILED", "Invalid token: Vercel Blob upload failed")
    );
    const errorSpy = vi.spyOn(logger, "error");

    const req = createMultipartRequest(
      "http://localhost:3000/api/admin/projects/laser-loon/image",
      {
        file: {
          buffer: VALID_PNG_BUFFER,
          filename: "hero.png",
          contentType: "image/png",
        },
      }
    );

    const res = await POST(req, {
      params: Promise.resolve({ slug: "laser-loon" }),
    });
    // A provider message containing "Invalid" is an infrastructure failure,
    // not a validation error, and must not leak to the client.
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("Failed to process and store project image");
    expect(errorSpy).toHaveBeenCalledWith(
      "Project image upload failed:",
      expect.objectContaining({ code: "STORAGE_FAILED" })
    );
    expect(CaseStudyService.updateCaseStudyImage).not.toHaveBeenCalled();
  });

  it("returns 500 on DELETE when clearing the image reference fails", async () => {
    vi.mocked(CaseStudyService.updateCaseStudyImage).mockResolvedValueOnce(
      createFailure("PERSISTENCE_FAILED", "Database connection lost")
    );
    const deleteSpy = vi.spyOn(ProjectImageService, "deleteMediaAsset");
    const req = new NextRequest(
      "http://localhost:3000/api/admin/projects/laser-loon/image",
      { method: "DELETE" }
    );

    const res = await DELETE(req, {
      params: Promise.resolve({ slug: "laser-loon" }),
    });

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("Failed to clear project image");
    // The prior asset stays in storage because its reference was not cleared.
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it("keeps a successfully replaced image when prior-asset cleanup fails", async () => {
    const newAssetUrl =
      "https://abc.public.blob.vercel-storage.com/project-laser-loon-new.png";
    vi.spyOn(ProjectImageService, "saveMediaAsset").mockResolvedValue(
      createSuccess(newAssetUrl)
    );
    const deleteSpy = vi
      .spyOn(ProjectImageService, "deleteMediaAsset")
      .mockResolvedValue(
        createFailure("DELETE_FAILED", "Vercel Blob delete failed")
      );
    const warningSpy = vi.spyOn(logger, "warn");

    const req = createMultipartRequest(
      "http://localhost:3000/api/admin/projects/laser-loon/image",
      {
        file: {
          buffer: VALID_PNG_BUFFER,
          filename: "hero.png",
          contentType: "image/png",
        },
      }
    );

    const res = await POST(req, {
      params: Promise.resolve({ slug: "laser-loon" }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data.hero_image_url).toBe(newAssetUrl);
    expect(CaseStudyService.updateCaseStudyImage).toHaveBeenCalledTimes(1);
    expect(CaseStudyService.updateCaseStudyImage).toHaveBeenCalledWith(
      "laser-loon",
      newAssetUrl
    );
    expect(deleteSpy).toHaveBeenCalledWith("project-laser-loon-old.png");
    expect(warningSpy).toHaveBeenCalledWith(
      "Project image was replaced, but prior asset cleanup failed.",
      undefined,
      { slug: "laser-loon", code: "DELETE_FAILED" }
    );
  });

  it("clears project hero image on DELETE request from authorized admin and deletes prior asset", async () => {
    const deleteSpy = vi.spyOn(ProjectImageService, "deleteMediaAsset");

    const req = new NextRequest(
      "http://localhost:3000/api/admin/projects/laser-loon/image",
      {
        method: "DELETE",
      }
    );

    const res = await DELETE(req, {
      params: Promise.resolve({ slug: "laser-loon" }),
    });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.hero_image_url).toBeNull();
    expect(CaseStudyService.updateCaseStudyImage).toHaveBeenCalledWith(
      "laser-loon",
      null
    );
    expect(deleteSpy).toHaveBeenCalledWith("project-laser-loon-old.png");
  });

  it("keeps a cleared project image successful when blob cleanup fails", async () => {
    vi.spyOn(ProjectImageService, "deleteMediaAsset").mockResolvedValue(
      createFailure("DELETE_FAILED", "Vercel Blob delete failed", {
        details: new Error("Blob cleanup unavailable"),
      })
    );
    const req = new NextRequest(
      "http://localhost:3000/api/admin/projects/laser-loon/image",
      { method: "DELETE" }
    );

    const res = await DELETE(req, {
      params: Promise.resolve({ slug: "laser-loon" }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.hero_image_url).toBeNull();
    expect(CaseStudyService.updateCaseStudyImage).toHaveBeenCalledWith(
      "laser-loon",
      null
    );
  });

  it("warns when clearing succeeds but media deletion fails", async () => {
    vi.spyOn(ProjectImageService, "deleteMediaAsset").mockResolvedValue(
      createFailure("STORAGE_UNCONFIGURED", "BLOB_READ_WRITE_TOKEN is required")
    );
    const warningSpy = vi.spyOn(logger, "warn");
    const req = new NextRequest(
      "http://localhost:3000/api/admin/projects/laser-loon/image",
      { method: "DELETE" }
    );

    const res = await DELETE(req, {
      params: Promise.resolve({ slug: "laser-loon" }),
    });

    expect(res.status).toBe(200);
    expect(warningSpy).toHaveBeenCalledWith(
      "Project image reference was cleared, but media cleanup failed.",
      undefined,
      { slug: "laser-loon", code: "STORAGE_UNCONFIGURED" }
    );
  });

  it("answers 500 from the media route when the storage read fails", async () => {
    vi.spyOn(ProjectImageService, "getMediaAsset").mockResolvedValue(
      createFailure(
        "STORAGE_UNCONFIGURED",
        "BLOB_READ_WRITE_TOKEN is required for media storage in production or preview environments"
      )
    );
    const errorSpy = vi.spyOn(logger, "error");

    const res = await getMediaAssetRoute(
      new NextRequest("http://localhost:3000/api/media/hero.png"),
      { params: Promise.resolve({ key: "hero.png" }) }
    );

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({
      error: "Media asset could not be read",
    });
    expect(errorSpy).toHaveBeenCalledWith(
      "Media asset read failed (STORAGE_UNCONFIGURED):",
      expect.anything()
    );
  });

  it("answers 404 from the media route when the asset is missing", async () => {
    vi.spyOn(ProjectImageService, "getMediaAsset").mockResolvedValue(
      createSuccess(null)
    );

    const res = await getMediaAssetRoute(
      new NextRequest("http://localhost:3000/api/media/missing.png"),
      { params: Promise.resolve({ key: "missing.png" }) }
    );

    expect(res.status).toBe(404);
  });

  it("returns 404 on DELETE request when case study slug does not exist", async () => {
    vi.mocked(CaseStudyService.getCaseStudyBySlug).mockResolvedValue(null);

    const req = new NextRequest(
      "http://localhost:3000/api/admin/projects/non-existent/image",
      {
        method: "DELETE",
      }
    );

    const res = await DELETE(req, {
      params: Promise.resolve({ slug: "non-existent" }),
    });
    expect(res.status).toBe(404);

    const data = await res.json();
    expect(data.error).toMatch(/not found/i);
    expect(CaseStudyService.updateCaseStudyImage).not.toHaveBeenCalled();
  });

  it("does not attempt to delete media asset when hero_image_url is an external third-party URL", async () => {
    const deleteSpy = vi.spyOn(ProjectImageService, "deleteMediaAsset");
    vi.mocked(CaseStudyService.getCaseStudyBySlug).mockResolvedValue({
      id: "cs_external",
      slug: "laser-loon",
      title: "Laser Loon",
      primary_language: "TypeScript",
      github_url: "https://github.com/test/laser-loon",
      published: true,
      simulated_telemetry: false,
      tags: "game, canvas",
      editorial_content: "Editorial narrative",
      architectural_narrative: "Architectural breakdown",
      hero_image_url: "https://images.unsplash.com/photo-123456789",
      created_at: new Date(),
      updated_at: new Date(),
    });

    const req = new NextRequest(
      "http://localhost:3000/api/admin/projects/laser-loon/image",
      {
        method: "DELETE",
      }
    );

    const res = await DELETE(req, {
      params: Promise.resolve({ slug: "laser-loon" }),
    });
    expect(res.status).toBe(200);
    expect(CaseStudyService.updateCaseStudyImage).toHaveBeenCalledWith(
      "laser-loon",
      null
    );
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it("extracts media storage key correctly across various URL patterns", () => {
    expect(
      ProjectImageService.extractMediaKeyFromUrl(
        "/api/media/project-test-123.png"
      )
    ).toBe("project-test-123.png");
    expect(
      ProjectImageService.extractMediaKeyFromUrl(
        "https://example.com/api/media/project-test-456.jpg"
      )
    ).toBe("project-test-456.jpg");
    expect(
      ProjectImageService.extractMediaKeyFromUrl("custom-blob-key.webp")
    ).toBe("custom-blob-key.webp");
    expect(
      ProjectImageService.extractMediaKeyFromUrl(
        "https://abc12345.public.blob.vercel-storage.com/project-test-789.png"
      )
    ).toBe(
      "https://abc12345.public.blob.vercel-storage.com/project-test-789.png"
    );
    expect(
      ProjectImageService.extractMediaKeyFromUrl(
        "https://images.unsplash.com/photo-987654"
      )
    ).toBeNull();
    expect(
      ProjectImageService.extractMediaKeyFromUrl("/images/projects/banner.jpg")
    ).toBeNull();
    expect(
      ProjectImageService.extractMediaKeyFromUrl(
        "data:image/png;base64,iVBORw0KGgo="
      )
    ).toBeNull();
    expect(ProjectImageService.extractMediaKeyFromUrl(null)).toBeNull();
    expect(ProjectImageService.extractMediaKeyFromUrl("")).toBeNull();
    expect(ProjectImageService.extractMediaKeyFromUrl("   ")).toBeNull();
  });
});
