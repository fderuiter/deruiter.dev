import DOMPurify from "isomorphic-dompurify";
import { z } from "zod";
import { CaseStudyService } from "@/lib/services/case-study-service";
import {
  createFailure,
  createSuccess,
  type ServiceResult,
} from "@/lib/services/service-result";
import { logger } from "@/lib/logger";
import { sanitizeError } from "@/lib/error-sanitization";
import { generateId } from "@/lib/utils";
import {
  getMediaStorageProvider,
  type MediaAssetRecord,
  type MediaStorageErrorCode,
  type MediaStorageResult,
} from "@/lib/services/media-storage";

/**
 * Error codes returned by the project image upload contract (ADR 0028).
 *
 * The validation codes (`EMPTY_PAYLOAD` through `SANITIZED_SVG_EMPTY`) and
 * `CASE_STUDY_NOT_FOUND` describe a request the caller can correct; the
 * remaining codes are infrastructure failures.
 */
export const ProjectImageErrorCode = z.enum([
  "EMPTY_PAYLOAD",
  "FILE_TOO_LARGE",
  "UNSUPPORTED_TYPE",
  "MALFORMED_HEADER",
  "SANITIZED_SVG_EMPTY",
  "CASE_STUDY_NOT_FOUND",
  "CASE_STUDY_LOOKUP_FAILED",
  "STORAGE_FAILED",
  "PERSISTENCE_FAILED",
]);
export type ProjectImageErrorCode = z.infer<typeof ProjectImageErrorCode>;

/** Result envelope of {@link ProjectImageService.uploadProjectImage}. */
export type ProjectImageResult = ServiceResult<
  {
    key: string;
    hero_image_url: string;
  },
  ProjectImageErrorCode
>;

/** Result envelope of {@link validateProjectImage}. */
export type ProjectImageValidationResult = ServiceResult<
  null,
  ProjectImageErrorCode
>;

export const MAX_PROJECT_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "image/avif",
]);

export type { MediaAssetRecord, MediaStorageErrorCode, MediaStorageResult };

/**
 * Sanitizes SVG XML strings using DOMPurify defense-in-depth, stripping
 * scripts, foreign objects, inline event handlers, and external URLs per ADR 0043.
 */
export function sanitizeSvg(svgContent: string): string {
  return DOMPurify.sanitize(svgContent, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: [
      "script",
      "feImage",
      "foreignObject",
      "iframe",
      "object",
      "embed",
    ],
    FORBID_ATTR: [
      "onload",
      "onerror",
      "onclick",
      "onmouseover",
      "onfocus",
      "onblur",
      "xlink:href",
    ],
    ALLOWED_URI_REGEXP: /^#/,
  });
}

/**
 * Checks file header magic bytes to prevent MIME-type spoofing and reject malformed files.
 */
export function validateImageMagicBytes(
  buffer: Buffer,
  mimeType: string
): boolean {
  if (!buffer || buffer.length === 0) return false;

  const normalizedMime = mimeType.toLowerCase();

  if (normalizedMime === "image/jpeg" || normalizedMime === "image/jpg") {
    return (
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
    );
  }

  if (normalizedMime === "image/png") {
    return (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 && // P
      buffer[2] === 0x4e && // N
      buffer[3] === 0x47 && // G
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    );
  }

  if (normalizedMime === "image/gif") {
    if (buffer.length < 6) return false;
    const header = buffer.toString("ascii", 0, 6);
    return header === "GIF87a" || header === "GIF89a";
  }

  if (normalizedMime === "image/webp") {
    if (buffer.length < 12) return false;
    const riff = buffer.toString("ascii", 0, 4);
    const webp = buffer.toString("ascii", 8, 12);
    return riff === "RIFF" && webp === "WEBP";
  }

  if (normalizedMime === "image/svg+xml") {
    const snippet = buffer
      .toString("utf-8", 0, Math.min(buffer.length, 1024))
      .toLowerCase();
    return snippet.includes("<svg") || snippet.includes("<?xml");
  }

  if (normalizedMime === "image/avif") {
    if (buffer.length < 12) return false;
    const ftyp = buffer.toString("ascii", 4, 8);
    const brand = buffer.toString("ascii", 8, 12);
    return ftyp === "ftyp" && (brand === "avif" || brand === "mif1");
  }

  return false;
}

/**
 * Validates file size, MIME type, and magic bytes.
 * Returns a failure envelope carrying a user-safe message when validation fails.
 */
export function validateProjectImage(
  buffer: Buffer,
  mimeType: string
): ProjectImageValidationResult {
  if (!buffer || buffer.length === 0) {
    return createFailure(
      "EMPTY_PAYLOAD",
      "Invalid image payload: File is empty or missing."
    );
  }

  if (buffer.length > MAX_PROJECT_IMAGE_SIZE_BYTES) {
    return createFailure(
      "FILE_TOO_LARGE",
      "File size exceeds maximum allowed limit of 5MB."
    );
  }

  if (!ALLOWED_IMAGE_MIME_TYPES.has(mimeType.toLowerCase())) {
    return createFailure(
      "UNSUPPORTED_TYPE",
      "Invalid image type. Allowed formats: JPEG, PNG, WebP, GIF, SVG, and AVIF."
    );
  }

  const isValidMagic = validateImageMagicBytes(buffer, mimeType);
  if (!isValidMagic) {
    return createFailure(
      "MALFORMED_HEADER",
      "Malformed or corrupt image file header. Image magic bytes do not match declared content type."
    );
  }

  return createSuccess(null);
}

/**
 * Helper to get file extension from MIME type.
 */
export function getExtensionForMimeType(mimeType: string): string {
  switch (mimeType.toLowerCase()) {
    case "image/jpeg":
    case "image/jpg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    case "image/svg+xml":
      return "svg";
    case "image/avif":
      return "avif";
    default:
      return "bin";
  }
}

/**
 * Extracts the storage key from a media asset URL or path.
 */
export function extractMediaKeyFromUrl(
  url: string | null | undefined
): string | null {
  if (!url || typeof url !== "string" || !url.trim()) return null;
  const trimmed = url.trim();

  // Local storage relative path: /api/media/<key>
  if (trimmed.startsWith("/api/media/")) {
    const key = trimmed.slice("/api/media/".length).trim();
    return key.length > 0 ? key : null;
  }

  // Relative paths not under /api/media/ are static public assets, not managed media keys
  if (trimmed.startsWith("/")) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.pathname.startsWith("/api/media/")) {
      const key = parsed.pathname.slice("/api/media/".length).trim();
      return key.length > 0 ? key : null;
    }
    // Vercel Blob cloud storage URL
    if (parsed.hostname.includes("blob.vercel-storage.com")) {
      return trimmed;
    }
    // External URLs (e.g. Unsplash, GitHub, third-party CDN) are not managed media assets
    return null;
  } catch {
    // Non-URL strings: allow bare keys without path separators or schemes
    if (
      !trimmed.includes("/") &&
      !trimmed.includes("\\") &&
      !trimmed.includes(":")
    ) {
      return trimmed;
    }
    return null;
  }
}

/**
 * Runs a provider operation and converts an exception from a provider that
 * breaks the result contract (for example a custom override) into a failure,
 * so the media boundary never throws.
 */
async function guardProviderCall<T>(
  code: MediaStorageErrorCode,
  message: string,
  operation: () => Promise<MediaStorageResult<T>>
): Promise<MediaStorageResult<T>> {
  try {
    return await operation();
  } catch (error) {
    return createFailure(code, message, { details: error });
  }
}

export class ProjectImageService {
  /**
   * Extracts the storage key from a media asset URL or path.
   */
  static extractMediaKeyFromUrl(url: string | null | undefined): string | null {
    return extractMediaKeyFromUrl(url);
  }

  /**
   * Saves a validated media buffer to the active storage provider and returns
   * its asset URL. A failure means the asset was not stored durably, so the
   * caller must not persist a URL for it.
   */
  static async saveMediaAsset(
    key: string,
    buffer: Buffer,
    contentType: string
  ): Promise<MediaStorageResult<string>> {
    const provider = getMediaStorageProvider();
    if (!provider.success) return provider;
    const uploaded = await guardProviderCall(
      "UPLOAD_FAILED",
      "Could not store the media asset",
      () => provider.data.upload(buffer, key, contentType)
    );
    return uploaded.success ? createSuccess(uploaded.data.url) : uploaded;
  }

  /**
   * Retrieves a media asset from storage by key. A provider without read
   * support, or a missing asset, resolves to `null` data.
   */
  static async getMediaAsset(
    key: string
  ): Promise<MediaStorageResult<MediaAssetRecord | null>> {
    const provider = getMediaStorageProvider();
    if (!provider.success) return provider;
    const reader = provider.data;
    if (!reader.getAsset) return createSuccess(null);
    return guardProviderCall(
      "READ_FAILED",
      "Could not read the media asset",
      () => reader.getAsset!(key)
    );
  }

  /**
   * Deletes a media asset from the active provider by key. A deployment with
   * no configured provider resolves to `STORAGE_UNCONFIGURED`, so missing
   * production credentials still fail closed.
   */
  static async deleteMediaAsset(
    key: string
  ): Promise<MediaStorageResult<null>> {
    const provider = getMediaStorageProvider();
    if (!provider.success) return provider;
    return guardProviderCall(
      "DELETE_FAILED",
      "Could not delete the media asset",
      () => provider.data.delete(key)
    );
  }

  /**
   * Processes, validates, persists, and links a project image asset to a case study.
   * If database persistence fails, the prior asset is preserved.
   *
   * Never throws: every failure is returned as a typed {@link ProjectImageErrorCode}.
   */
  static async uploadProjectImage(
    slug: string,
    fileBuffer: Buffer,
    mimeType: string
  ): Promise<ProjectImageResult> {
    // 1. Validate image format, size, and magic bytes
    const validation = validateProjectImage(fileBuffer, mimeType);
    if (!validation.success) {
      return validation;
    }

    // 2. SVG Defense-in-Depth sanitization
    if (mimeType.toLowerCase() === "image/svg+xml") {
      const sanitized = sanitizeSvg(fileBuffer.toString("utf-8"));
      fileBuffer = Buffer.from(sanitized, "utf-8");
      if (!validateImageMagicBytes(fileBuffer, mimeType)) {
        return createFailure(
          "SANITIZED_SVG_EMPTY",
          "Invalid image payload: Sanitized SVG contains no valid svg element."
        );
      }
    }

    // 3. Fetch existing case study to preserve prior asset URL on failure
    let existing: Awaited<
      ReturnType<typeof CaseStudyService.getCaseStudyBySlug>
    >;
    try {
      existing = await CaseStudyService.getCaseStudyBySlug(slug);
    } catch (error) {
      return createFailure(
        "CASE_STUDY_LOOKUP_FAILED",
        `Could not read case study "${slug}" before replacing its image`,
        { details: error }
      );
    }
    const priorAssetUrl = existing?.hero_image_url ?? null;
    const priorKey = extractMediaKeyFromUrl(priorAssetUrl);

    // 4. Generate key and save media asset using provider
    const ext = getExtensionForMimeType(mimeType);
    const key = `${generateId(`project-${slug}`, { timestamp: true })}.${ext}`;
    const stored = await ProjectImageService.saveMediaAsset(
      key,
      fileBuffer,
      mimeType
    );
    if (!stored.success) {
      return createFailure(
        "STORAGE_FAILED",
        "Could not store the project image asset",
        { details: stored.error }
      );
    }
    const assetUrl = stored.data;

    // 5. Persist the new asset reference before cleaning up the prior asset.
    const persisted = await CaseStudyService.updateCaseStudyImage(
      slug,
      assetUrl
    );
    if (!persisted.success) {
      // 6. On persistence failure, clean up the new asset and restore the prior
      // reference. Cleanup is best-effort and never masks the original failure.
      const cleanup = await ProjectImageService.deleteMediaAsset(key);
      if (!cleanup.success) {
        logger.warn(
          "Project image upload rollback could not clean up the new asset.",
          sanitizeError(cleanup.error.details),
          { slug, code: cleanup.error.code }
        );
      }
      if (existing) {
        // Best effort rollback: the original failure is what the caller sees.
        await CaseStudyService.updateCaseStudyImage(slug, priorAssetUrl);
      }
      return persisted;
    }

    // 7. Cleanup is post-commit and best-effort: a provider outage must not
    // report failure after the new image reference has already been persisted.
    if (priorKey && priorKey !== key) {
      const cleanup = await ProjectImageService.deleteMediaAsset(priorKey);
      if (!cleanup.success) {
        logger.warn(
          "Project image was replaced, but prior asset cleanup failed.",
          sanitizeError(cleanup.error.details),
          { slug, code: cleanup.error.code }
        );
      }
    }

    return createSuccess({ hero_image_url: assetUrl, key });
  }
}
