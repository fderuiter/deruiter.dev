import { NextResponse } from "next/server";
import { ProjectImageService } from "@/lib/services/project-image-service";
import { createApiHandler } from "@/lib/route-wrapper";
import { logger } from "@/lib/logger";
import { sanitizeError } from "@/lib/error-sanitization";

export const dynamic = "force-dynamic";

export const GET = createApiHandler(
  async (_req, { params }) => {
    const key = typeof params.key === "string" ? params.key : "";
    if (!key) {
      return NextResponse.json(
        { error: "Media asset key is required" },
        { status: 400 }
      );
    }

    const result = await ProjectImageService.getMediaAsset(key);
    if (!result.success) {
      logger.error(
        `Media asset read failed (${result.error.code}):`,
        sanitizeError(result.error.details ?? result.error.message)
      );
      return NextResponse.json(
        { error: "Media asset could not be read" },
        { status: 500 }
      );
    }

    const asset = result.data;
    if (!asset) {
      return NextResponse.json(
        { error: "Media asset not found" },
        { status: 404 }
      );
    }

    return new NextResponse(new Uint8Array(asset.buffer), {
      status: 200,
      headers: {
        "Content-Type": asset.contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  },
  // Stored uploads are served as-is, so nothing in them may run.
  { auth: "public", contentSecurityPolicy: "default-src 'none'" }
);
