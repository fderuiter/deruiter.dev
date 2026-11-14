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
import { getEnv } from "@/lib/env";
import { resolveBaseUrl } from "@/lib/domain";
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

/** Hostname suffix shared by every Vercel Blob store. */
const VERCEL_BLOB_HOST_SUFFIX = ".public.blob.vercel-storage.com";

/** The API host that `VercelBlobStorageProvider.getUrl` builds URLs on. */
const VERCEL_BLOB_API_HOST = "blob.vercel-storage.com";

/** A Vercel Blob store id as it appears in a store's hostname label. */
const BLOB_STORE_ID_PATTERN = /^[a-z0-9]+$/;

/**
 * What a media URL is checked against before it is treated as an asset this
 * site owns and may delete.
 */
export interface MediaOwnership {
  /**
   * The origin the site serves `/api/media/` from. An absolute media URL on
   * any other origin is not ours, whatever its path says.
   */
  siteOrigin: string;
  /**
   * The id of the Vercel Blob store this deployment writes to, or `null` when
   * no store is configured. Without it no Blob URL counts as owned.
   */
  blobStoreId: string | null;
}

/**
 * Reads the store id out of a Vercel Blob read-write token
 * (`vercel_blob_rw_<storeId>_<secret>`). Returns `null` for anything else.
 */
export function blobStoreIdFromToken(
  token: string | null | undefined
): string | null {
  if (!token) return null;
  const parts = token.trim().split("_");
  if (parts.length < 5 || parts[0] !== "vercel" || parts[1] !== "blob") {
    return null;
  }
  const storeId = parts[3].toLowerCase();
  return BLOB_STORE_ID_PATTERN.test(storeId) ? storeId : null;
}

function resolveMediaOwnership(): MediaOwnership {
  return {
    siteOrigin: new URL(resolveBaseUrl()).origin,
    blobStoreId: blobStoreIdFromToken(getEnv().BLOB_READ_WRITE_TOKEN),
  };
}

/**
 * Returns the key in a `/api/media/<key>` path, or `null` when the key is
 * empty or would leave the flat media directory.
 */
function mediaKeyFromApiPath(pathname: string): string | null {
  const key = pathname.slice("/api/media/".length).trim();
  if (!key || key.includes("/") || key.includes("\\") || key === "..") {
    return null;
  }
  return key;
}

/**
 * Whether a parsed URL is a Vercel Blob URL in this deployment's own store.
 *
 * The check is exact: HTTPS, no credentials, no port, and either the Blob
 * API host or `<storeId>.public.blob.vercel-storage.com` for our store id.
 * A lookalike such as `blob.vercel-storage.com.evil.example`, or another
 * team's store on the same suffix, is not ours.
 */
function isOwnedBlobUrl(parsed: URL, blobStoreId: string | null): boolean {
  if (!blobStoreId) return false;
  if (parsed.protocol !== "https:") return false;
  if (parsed.username || parsed.password || parsed.port) return false;
  const host = parsed.hostname.toLowerCase();
  if (host === VERCEL_BLOB_API_HOST) return parsed.pathname.length > 1;
  return host === `${blobStoreId}${VERCEL_BLOB_HOST_SUFFIX}`;
}

/**
 * Extracts the storage key from a media asset URL or path, but only for an
 * asset this site owns. Cleanup deletes whatever key this returns, so an
 * external, lookalike or unparseable URL returns `null` (CodeQL alert 36).
 *
 * @param url - The stored asset URL or path.
 * @param ownership - Overrides the site origin and Blob store id; defaults
 *   to the values this deployment is configured with.
 */
export function extractMediaKeyFromUrl(
  url: string | null | undefined,
  ownership: MediaOwnership = resolveMediaOwnership()
): string | null {
  if (!url || typeof url !== "string" || !url.trim()) return null;
  const trimmed = url.trim();

  // Local storage relative path: /api/media/<key>
  if (trimmed.startsWith("/api/media/")) {
    return mediaKeyFromApiPath(trimmed);
  }

  // Relative paths not under /api/media/ are static public assets, not managed media keys
  if (trimmed.startsWith("/")) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
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

  if (parsed.username || parsed.password) return null;

  // An absolute /api/media/ URL is ours only on our own origin.
  if (parsed.pathname.startsWith("/api/media/")) {
    if (parsed.origin !== ownership.siteOrigin) return null;
    if (parsed.search || parsed.hash) return null;
    return mediaKeyFromApiPath(parsed.pathname);
  }

  // Vercel Blob: the provider deletes by URL, so the URL is the key.
  if (isOwnedBlobUrl(parsed, ownership.blobStoreId)) {
    return trimmed;
  }

  // External URLs (e.g. Unsplash, GitHub, third-party CDN) are not managed media assets
  return null;
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
  static extractMediaKeyFromUrl(
    url: string | null | undefined,
    ownership?: MediaOwnership
  ): string | null {
    return extractMediaKeyFromUrl(url, ownership);
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
