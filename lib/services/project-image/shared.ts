import { z } from "zod";
import { resolveBaseUrl } from "@/lib/domain";
import { getEnv } from "@/lib/env";
import {
  getMediaStorageProvider,
  type MediaAssetRecord,
  type MediaStorageErrorCode,
  type MediaStorageResult,
} from "@/lib/services/media-storage";
import {
  createFailure,
  createSuccess,
  type ServiceResult,
} from "@/lib/services/service-result";

export type { MediaAssetRecord, MediaStorageErrorCode, MediaStorageResult };

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

export type ProjectImageResult = ServiceResult<
  {
    key: string;
    hero_image_url: string;
  },
  ProjectImageErrorCode
>;

export type ProjectImageValidationResult = ServiceResult<
  null,
  ProjectImageErrorCode
>;

export const MAX_PROJECT_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

export const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "image/avif",
]);

/**
 * Lazily loads `isomorphic-dompurify` and sanitizes SVG XML strings using
 * defense-in-depth rules, keeping JSDOM/DOMPurify off cold starts for non-SVG routes.
 */
export async function sanitizeSvgLazy(svgContent: string): Promise<string> {
  const mod = await import("isomorphic-dompurify");
  const DOMPurify = mod.default ?? mod;
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
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
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

export function validateProjectImage(
  buffer: Buffer,
  mimeType: string
): ProjectImageValidationResult {
  if (!buffer || buffer.length === 0) {
    return createFailure(
      "EMPTY_PAYLOAD",
      "Invalid image payload: File is empty or missing.",
      { recoverable: false }
    );
  }

  if (buffer.length > MAX_PROJECT_IMAGE_SIZE_BYTES) {
    return createFailure(
      "FILE_TOO_LARGE",
      "File size exceeds maximum allowed limit of 5MB.",
      { recoverable: false }
    );
  }

  if (!ALLOWED_IMAGE_MIME_TYPES.has(mimeType.toLowerCase())) {
    return createFailure(
      "UNSUPPORTED_TYPE",
      "Invalid image type. Allowed formats: JPEG, PNG, WebP, GIF, SVG, and AVIF.",
      { recoverable: false }
    );
  }

  const isValidMagic = validateImageMagicBytes(buffer, mimeType);
  if (!isValidMagic) {
    return createFailure(
      "MALFORMED_HEADER",
      "Malformed or corrupt image file header. Image magic bytes do not match declared content type.",
      { recoverable: false }
    );
  }

  return createSuccess(null);
}

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

const VERCEL_BLOB_HOST_SUFFIX = ".public.blob.vercel-storage.com";
const VERCEL_BLOB_API_HOST = "blob.vercel-storage.com";
const BLOB_STORE_ID_PATTERN = /^[a-z0-9]+$/;

export interface MediaOwnership {
  siteOrigin: string;
  blobStoreId: string | null;
}

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

export function resolveMediaOwnership(): MediaOwnership {
  return {
    siteOrigin: new URL(resolveBaseUrl()).origin,
    blobStoreId: blobStoreIdFromToken(getEnv().BLOB_READ_WRITE_TOKEN),
  };
}

function mediaKeyFromApiPath(pathname: string): string | null {
  const key = pathname.slice("/api/media/".length).trim();
  if (!key || key.includes("/") || key.includes("\\") || key === "..") {
    return null;
  }
  return key;
}

function isOwnedBlobUrl(parsed: URL, blobStoreId: string | null): boolean {
  if (!blobStoreId) return false;
  if (parsed.protocol !== "https:") return false;
  if (parsed.username || parsed.password || parsed.port) return false;
  const host = parsed.hostname.toLowerCase();
  if (host === VERCEL_BLOB_API_HOST) return parsed.pathname.length > 1;
  return host === `${blobStoreId}${VERCEL_BLOB_HOST_SUFFIX}`;
}

export function extractMediaKeyFromUrl(
  url: string | null | undefined,
  ownership: MediaOwnership = resolveMediaOwnership()
): string | null {
  if (!url || typeof url !== "string" || !url.trim()) return null;
  const trimmed = url.trim();

  if (trimmed.startsWith("/api/media/")) {
    return mediaKeyFromApiPath(trimmed);
  }

  if (trimmed.startsWith("/")) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
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

  if (parsed.pathname.startsWith("/api/media/")) {
    if (parsed.origin !== ownership.siteOrigin) return null;
    if (parsed.search || parsed.hash) return null;
    return mediaKeyFromApiPath(parsed.pathname);
  }

  if (isOwnedBlobUrl(parsed, ownership.blobStoreId)) {
    return trimmed;
  }

  return null;
}

export async function guardMediaProviderCall<T>(
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

export async function saveMediaAsset(
  key: string,
  buffer: Buffer,
  contentType: string
): Promise<MediaStorageResult<string>> {
  const provider = getMediaStorageProvider();
  if (!provider.success) return provider;
  const uploaded = await guardMediaProviderCall(
    "UPLOAD_FAILED",
    "Could not store the media asset",
    () => provider.data.upload(buffer, key, contentType)
  );
  return uploaded.success ? createSuccess(uploaded.data.url) : uploaded;
}

export async function deleteMediaAsset(
  key: string
): Promise<MediaStorageResult<null>> {
  const provider = getMediaStorageProvider();
  if (!provider.success) return provider;
  return guardMediaProviderCall(
    "DELETE_FAILED",
    "Could not delete the media asset",
    () => provider.data.delete(key)
  );
}
