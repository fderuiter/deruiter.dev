import { NextResponse } from "next/server";
import {
  ProjectImageService,
  MAX_PROJECT_IMAGE_SIZE_BYTES,
  type ProjectImageErrorCode,
} from "@/lib/services/project-image-service";
import { CaseStudyService } from "@/lib/services/case-study-service";
import { applySecurityHeaders } from "@/lib/security-headers";
import { sanitizeError } from "@/lib/error-sanitization";
import { createApiHandler } from "@/lib/route-wrapper";
import { logger } from "@/lib/logger";

interface FormFileBlob {
  arrayBuffer(): Promise<ArrayBuffer>;
  type?: string;
}

export const dynamic = "force-dynamic";

/**
 * Upload failures the administrator can correct: their message is returned
 * verbatim with a 400. Every other code is an infrastructure failure and gets
 * a generic 500 so storage and database details stay in the server log.
 */
const CLIENT_ERROR_CODES: ReadonlySet<ProjectImageErrorCode> = new Set([
  "EMPTY_PAYLOAD",
  "FILE_TOO_LARGE",
  "UNSUPPORTED_TYPE",
  "MALFORMED_HEADER",
  "SANITIZED_SVG_EMPTY",
  "CASE_STUDY_NOT_FOUND",
]);

export const POST = createApiHandler(
  async (req, { params }) => {
    const slug =
      typeof params.slug === "string"
        ? params.slug
        : Array.isArray(params.slug)
          ? params.slug[0] || ""
          : "";

    if (!slug) {
      const res = NextResponse.json(
        { error: "Project slug parameter is required" },
        { status: 400 }
      );
      return applySecurityHeaders(res, req);
    }

    // Parse Multipart Form Data Payload
    try {
      const contentLength = req.headers.get("content-length");
      if (
        contentLength &&
        parseInt(contentLength, 10) > MAX_PROJECT_IMAGE_SIZE_BYTES + 64 * 1024
      ) {
        const res = NextResponse.json(
          { error: "File size exceeds maximum allowed limit of 5MB." },
          { status: 400 }
        );
        return applySecurityHeaders(res, req);
      }

      const formData = await req.formData();
      const file = formData.get("file") || formData.get("image");

      if (
        !file ||
        typeof file === "string" ||
        typeof (file as unknown as FormFileBlob).arrayBuffer !== "function"
      ) {
        const res = NextResponse.json(
          { error: "Image file is required in 'file' or 'image' field" },
          { status: 400 }
        );
        return applySecurityHeaders(res, req);
      }

      const fileBlob = file as unknown as FormFileBlob & { size?: number };
      if (
        typeof fileBlob.size === "number" &&
        fileBlob.size > MAX_PROJECT_IMAGE_SIZE_BYTES
      ) {
        const res = NextResponse.json(
          { error: "File size exceeds maximum allowed limit of 5MB." },
          { status: 400 }
        );
        return applySecurityHeaders(res, req);
      }

      const arrayBuffer = await fileBlob.arrayBuffer();
      if (arrayBuffer.byteLength > MAX_PROJECT_IMAGE_SIZE_BYTES) {
        const res = NextResponse.json(
          { error: "File size exceeds maximum allowed limit of 5MB." },
          { status: 400 }
        );
        return applySecurityHeaders(res, req);
      }

      const buffer = Buffer.from(arrayBuffer);
      const mimeType = fileBlob.type || "application/octet-stream";

      // 3. Process, Validate & Upload Project Image Asset
      const result = await ProjectImageService.uploadProjectImage(
        slug,
        buffer,
        mimeType
      );

      if (!result.success) {
        if (CLIENT_ERROR_CODES.has(result.error.code)) {
          const res = NextResponse.json(
            { error: result.error.message },
            { status: 400 }
          );
          return applySecurityHeaders(res, req);
        }

        logger.error("Project image upload failed:", {
          code: result.error.code,
          cause: sanitizeError(result.error.details),
        });
        const res = NextResponse.json(
          { error: "Failed to process and store project image" },
          { status: 500 }
        );
        return applySecurityHeaders(res, req);
      }

      const res = NextResponse.json(
        {
          success: true,
          data: {
            slug,
            hero_image_url: result.data.hero_image_url,
            key: result.data.key,
          },
        },
        { status: 200 }
      );
      return applySecurityHeaders(res, req);
    } catch (err: unknown) {
      // Only request parsing (multipart form data) can throw here.
      logger.error("Project image upload failed:", sanitizeError(err));
      const res = NextResponse.json(
        { error: "Failed to process and store project image" },
        { status: 500 }
      );
      return applySecurityHeaders(res, req);
    }
  },
  { auth: "clerk_admin" }
);

export const DELETE = createApiHandler(
  async (req, { params }) => {
    const slug =
      typeof params.slug === "string"
        ? params.slug
        : Array.isArray(params.slug)
          ? params.slug[0] || ""
          : "";

    if (!slug) {
      const res = NextResponse.json(
        { error: "Project slug parameter is required" },
        { status: 400 }
      );
      return applySecurityHeaders(res, req);
    }

    try {
      const existing = await CaseStudyService.getCaseStudyBySlug(slug);
      if (!existing) {
        const res = NextResponse.json(
          { error: `Case study with slug "${slug}" not found` },
          { status: 404 }
        );
        return applySecurityHeaders(res, req);
      }

      const priorKey = ProjectImageService.extractMediaKeyFromUrl(
        existing.hero_image_url
      );

      const cleared = await CaseStudyService.updateCaseStudyImage(slug, null);
      if (!cleared.success) {
        if (cleared.error.code === "CASE_STUDY_NOT_FOUND") {
          const res = NextResponse.json(
            { error: cleared.error.message },
            { status: 404 }
          );
          return applySecurityHeaders(res, req);
        }
        logger.error(
          "Failed to clear project image:",
          sanitizeError(cleared.error.details)
        );
        const res = NextResponse.json(
          { error: "Failed to clear project image" },
          { status: 500 }
        );
        return applySecurityHeaders(res, req);
      }

      if (priorKey) {
        try {
          const deleted = await ProjectImageService.deleteMediaAsset(priorKey);
          if (!deleted) {
            logger.warn(
              "Project image reference was cleared, but media cleanup failed.",
              { slug }
            );
          }
        } catch (err) {
          logger.warn(
            "Project image reference was cleared, but media cleanup failed.",
            sanitizeError(err),
            { slug }
          );
        }
      }

      const res = NextResponse.json(
        { success: true, data: { slug, hero_image_url: null } },
        { status: 200 }
      );
      return applySecurityHeaders(res, req);
    } catch (err) {
      logger.error("Failed to clear project image:", sanitizeError(err));
      const res = NextResponse.json(
        { error: "Failed to clear project image" },
        { status: 500 }
      );
      return applySecurityHeaders(res, req);
    }
  },
  { auth: "clerk_admin" }
);
