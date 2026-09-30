import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { getEnv } from "@/lib/env";
import {
  createFailure,
  createSuccess,
  type ServiceResult,
} from "@/lib/services/service-result";

/**
 * Error codes returned by media storage providers (ADR 0028, ADR 0043).
 *
 * `STORAGE_UNCONFIGURED` means no provider can serve this deployment, for
 * example a production or preview deployment without `BLOB_READ_WRITE_TOKEN`.
 * It fails closed instead of writing to ephemeral local disk. The remaining
 * codes are provider I/O failures.
 */
export const MediaStorageErrorCode = z.enum([
  "STORAGE_UNCONFIGURED",
  "UPLOAD_FAILED",
  "DELETE_FAILED",
  "READ_FAILED",
]);
export type MediaStorageErrorCode = z.infer<typeof MediaStorageErrorCode>;

/** Result envelope returned by every media storage operation. */
export type MediaStorageResult<T> = ServiceResult<T, MediaStorageErrorCode>;

/**
 * Result of a media upload operation.
 */
export interface MediaUploadResult {
  url: string;
  key: string;
}

/**
 * Persisted media asset record returned by storage providers.
 */
export interface MediaAssetRecord {
  buffer: Buffer;
  contentType: string;
  createdAt: Date;
}

/**
 * Pluggable media storage provider contract per ADR 0043.
 *
 * Operations return a {@link MediaStorageResult} instead of throwing. A missing
 * asset is a success with `null` data, not a failure.
 */
export interface MediaStorageProvider {
  upload(
    file: Buffer,
    filename: string,
    contentType: string
  ): Promise<MediaStorageResult<MediaUploadResult>>;
  delete(key: string): Promise<MediaStorageResult<null>>;
  getUrl(key: string): string;
  getAsset?(key: string): Promise<MediaStorageResult<MediaAssetRecord | null>>;
}

const MISSING_BLOB_TOKEN_MESSAGE =
  "BLOB_READ_WRITE_TOKEN is required for VercelBlobStorageProvider";

/**
 * Maps common file extensions to standard image MIME types.
 */
export function getMimeTypeForExtension(ext: string): string {
  switch (ext.toLowerCase()) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "svg":
      return "image/svg+xml";
    case "avif":
      return "image/avif";
    default:
      return "application/octet-stream";
  }
}

/**
 * Local filesystem storage provider persisting media assets to disk (.media-storage/).
 * Used in local development and automated testing environments.
 */
export class LocalStorageProvider implements MediaStorageProvider {
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir || path.resolve(process.cwd(), ".media-storage");
  }

  private ensureDir(): void {
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  private getFilePath(key: string): string {
    const safeKey = path.basename(key);
    return path.join(this.baseDir, safeKey);
  }

  async upload(
    file: Buffer,
    filename: string,
    _contentType: string
  ): Promise<MediaStorageResult<MediaUploadResult>> {
    try {
      this.ensureDir();
      const filePath = this.getFilePath(filename);
      await fs.promises.writeFile(filePath, file);
    } catch (error) {
      return createFailure(
        "UPLOAD_FAILED",
        "Local media storage could not write the asset",
        { details: error }
      );
    }
    return createSuccess({
      url: `/api/media/${filename}`,
      key: filename,
    });
  }

  async delete(key: string): Promise<MediaStorageResult<null>> {
    const filePath = this.getFilePath(key);
    try {
      await fs.promises.unlink(filePath);
    } catch {
      // Ignored if file does not exist
    }
    return createSuccess(null);
  }

  getUrl(key: string): string {
    return `/api/media/${key}`;
  }

  async getAsset(
    key: string
  ): Promise<MediaStorageResult<MediaAssetRecord | null>> {
    const filePath = this.getFilePath(key);
    try {
      const buffer = await fs.promises.readFile(filePath);
      const ext = path.extname(key).replace(/^\./, "").toLowerCase();
      const contentType = getMimeTypeForExtension(ext);
      return createSuccess({
        buffer,
        contentType,
        createdAt: new Date(),
      });
    } catch {
      // An unreadable local file is served as a missing asset.
      return createSuccess(null);
    }
  }
}

/**
 * Cloud storage provider directing media uploads to Vercel Blob.
 * Active in preview and production environments with BLOB_READ_WRITE_TOKEN.
 *
 * Constructed without a token, explicit or from the environment, every
 * operation returns `STORAGE_UNCONFIGURED` without making a request.
 */
export class VercelBlobStorageProvider implements MediaStorageProvider {
  private token: string;

  constructor(token?: string) {
    this.token = token || getEnv().BLOB_READ_WRITE_TOKEN || "";
  }

  /** Whether a Blob read-write token is available to this provider. */
  isConfigured(): boolean {
    return this.token.length > 0;
  }

  async upload(
    file: Buffer,
    filename: string,
    contentType: string
  ): Promise<MediaStorageResult<MediaUploadResult>> {
    if (!this.isConfigured()) {
      return createFailure("STORAGE_UNCONFIGURED", MISSING_BLOB_TOKEN_MESSAGE, {
        recoverable: false,
      });
    }

    try {
      const res = await fetch(`https://blob.vercel-storage.com/${filename}`, {
        method: "PUT",
        headers: {
          authorization: `Bearer ${this.token}`,
          "x-content-type": contentType,
          "x-add-random-suffix": "false",
        },
        body: new Uint8Array(file),
      });

      if (!res.ok) {
        return createFailure(
          "UPLOAD_FAILED",
          `Vercel Blob upload failed: ${res.statusText}`,
          { details: { status: res.status } }
        );
      }

      const data = (await res.json()) as { url: string; pathname?: string };
      return createSuccess({
        url: data.url,
        key: data.pathname || filename,
      });
    } catch (error) {
      return createFailure("UPLOAD_FAILED", "Vercel Blob upload failed", {
        details: error,
      });
    }
  }

  async delete(key: string): Promise<MediaStorageResult<null>> {
    if (!this.isConfigured()) {
      return createFailure("STORAGE_UNCONFIGURED", MISSING_BLOB_TOKEN_MESSAGE, {
        recoverable: false,
      });
    }

    try {
      const res = await fetch("https://blob.vercel-storage.com/delete", {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ urls: [key] }),
      });

      if (!res.ok) {
        return createFailure(
          "DELETE_FAILED",
          `Vercel Blob delete failed: ${res.statusText}`,
          { details: { status: res.status } }
        );
      }
      return createSuccess(null);
    } catch (error) {
      return createFailure("DELETE_FAILED", "Vercel Blob delete failed", {
        details: error,
      });
    }
  }

  getUrl(key: string): string {
    if (key.startsWith("http://") || key.startsWith("https://")) {
      return key;
    }
    return `https://blob.vercel-storage.com/${key}`;
  }
}

let activeProvider: MediaStorageProvider | null = null;

/**
 * Resolves the active MediaStorageProvider from environment configuration.
 *
 * A production or preview deployment without `BLOB_READ_WRITE_TOKEN` resolves
 * to `STORAGE_UNCONFIGURED` instead of falling back to ephemeral local disk.
 */
export function getMediaStorageProvider(): MediaStorageResult<MediaStorageProvider> {
  if (activeProvider) {
    return createSuccess(activeProvider);
  }

  const { BLOB_READ_WRITE_TOKEN: token, NODE_ENV, VERCEL_ENV } = getEnv();
  if (token && token.trim().length > 0) {
    return createSuccess(new VercelBlobStorageProvider(token));
  }

  if (
    NODE_ENV === "production" ||
    VERCEL_ENV === "production" ||
    VERCEL_ENV === "preview"
  ) {
    return createFailure(
      "STORAGE_UNCONFIGURED",
      "BLOB_READ_WRITE_TOKEN is required for media storage in production or preview environments",
      { recoverable: false }
    );
  }

  return createSuccess(new LocalStorageProvider());
}

/**
 * Overrides the active MediaStorageProvider for testing or configuration.
 */
export function setMediaStorageProvider(
  provider: MediaStorageProvider | null
): void {
  activeProvider = provider;
}
