import { NextRequest, NextResponse } from "next/server";
import { ProjectImageService } from "@/lib/services/project-image-service";
import { applySecurityHeaders } from "@/lib/security-headers";
import { logger } from "@/lib/logger";
import { sanitizeError } from "@/lib/error-sanitization";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ key: string }> }
): Promise<NextResponse> {
  const { key } = await context.params;

  if (!key) {
    const response = NextResponse.json(
      { error: "Media asset key is required" },
      { status: 400 }
    );
    return applySecurityHeaders(response, req);
  }

  const result = await ProjectImageService.getMediaAsset(key);
  if (!result.success) {
    logger.error(
      `Media asset read failed (${result.error.code}):`,
      sanitizeError(result.error.details ?? result.error.message)
    );
    const response = NextResponse.json(
      { error: "Media asset could not be read" },
      { status: 500 }
    );
    return applySecurityHeaders(response, req);
  }

  const asset = result.data;
  if (!asset) {
    const response = NextResponse.json(
      { error: "Media asset not found" },
      { status: 404 }
    );
    return applySecurityHeaders(response, req);
  }

  const headers: Record<string, string> = {
    "Content-Type": asset.contentType,
    "Cache-Control": "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'",
  };

  const response = new NextResponse(new Uint8Array(asset.buffer), {
    status: 200,
    headers,
  });

  applySecurityHeaders(response, req);
  response.headers.set("Content-Security-Policy", "default-src 'none'");
  return response;
}
