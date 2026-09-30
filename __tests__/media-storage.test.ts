import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  LocalStorageProvider,
  VercelBlobStorageProvider,
  getMediaStorageProvider,
  setMediaStorageProvider,
  getMimeTypeForExtension,
  type MediaStorageProvider,
} from "@/lib/services/media-storage";
import { ProjectImageService } from "@/lib/services/project-image-service";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import * as envModule from "@/lib/env";

describe("Media Storage Provider Test Suite", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.restoreAllMocks();
    setMediaStorageProvider(null);
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    setMediaStorageProvider(null);
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe("getMimeTypeForExtension", () => {
    it("maps standard image extensions to their corresponding MIME types", () => {
      expect(getMimeTypeForExtension("jpg")).toBe("image/jpeg");
      expect(getMimeTypeForExtension("jpeg")).toBe("image/jpeg");
      expect(getMimeTypeForExtension("png")).toBe("image/png");
      expect(getMimeTypeForExtension("webp")).toBe("image/webp");
      expect(getMimeTypeForExtension("gif")).toBe("image/gif");
      expect(getMimeTypeForExtension("svg")).toBe("image/svg+xml");
      expect(getMimeTypeForExtension("avif")).toBe("image/avif");
    });

    it("handles case-insensitive extensions", () => {
      expect(getMimeTypeForExtension("JPG")).toBe("image/jpeg");
      expect(getMimeTypeForExtension("PnG")).toBe("image/png");
      expect(getMimeTypeForExtension("WEBP")).toBe("image/webp");
      expect(getMimeTypeForExtension("GIF")).toBe("image/gif");
      expect(getMimeTypeForExtension("SVG")).toBe("image/svg+xml");
      expect(getMimeTypeForExtension("AVIF")).toBe("image/avif");
    });

    it("returns application/octet-stream for unknown file extensions", () => {
      expect(getMimeTypeForExtension("bin")).toBe("application/octet-stream");
      expect(getMimeTypeForExtension("exe")).toBe("application/octet-stream");
      expect(getMimeTypeForExtension("txt")).toBe("application/octet-stream");
      expect(getMimeTypeForExtension("")).toBe("application/octet-stream");
    });
  });

  describe("LocalStorageProvider", () => {
    const mockDir = path.resolve(process.cwd(), ".mock-media-storage");

    it("uses default directory when no baseDir is passed", () => {
      const provider = new LocalStorageProvider();
      expect(provider.getUrl("sample.png")).toBe("/api/media/sample.png");
    });

    it("creates storage directory if it does not exist during upload", async () => {
      const existsSpy = vi.spyOn(fs, "existsSync").mockReturnValue(false);
      const mkdirSpy = vi
        .spyOn(fs, "mkdirSync")
        .mockImplementation(() => undefined as unknown as string);
      const writeFileSpy = vi
        .spyOn(fs.promises, "writeFile")
        .mockResolvedValue(undefined);

      const provider = new LocalStorageProvider(mockDir);
      const fileBuffer = Buffer.from("test image data");
      const result = await provider.upload(
        fileBuffer,
        "test-image.png",
        "image/png"
      );

      expect(existsSpy).toHaveBeenCalledWith(mockDir);
      expect(mkdirSpy).toHaveBeenCalledWith(mockDir, { recursive: true });
      expect(writeFileSpy).toHaveBeenCalledWith(
        path.join(mockDir, "test-image.png"),
        fileBuffer
      );
      expect(result).toEqual(
        createSuccess({
          url: "/api/media/test-image.png",
          key: "test-image.png",
        })
      );
    });

    it("skips creating directory if it already exists", async () => {
      const existsSpy = vi.spyOn(fs, "existsSync").mockReturnValue(true);
      const mkdirSpy = vi
        .spyOn(fs, "mkdirSync")
        .mockImplementation(() => undefined as unknown as string);
      vi.spyOn(fs.promises, "writeFile").mockResolvedValue(undefined);

      const provider = new LocalStorageProvider(mockDir);
      await provider.upload(Buffer.from("data"), "existing.png", "image/png");

      expect(existsSpy).toHaveBeenCalledWith(mockDir);
      expect(mkdirSpy).not.toHaveBeenCalled();
    });

    it("sanitizes keys to prevent directory traversal in file paths", async () => {
      vi.spyOn(fs, "existsSync").mockReturnValue(true);
      const writeFileSpy = vi
        .spyOn(fs.promises, "writeFile")
        .mockResolvedValue(undefined);

      const provider = new LocalStorageProvider(mockDir);
      const result = await provider.upload(
        Buffer.from("traversal test"),
        "../../etc/passwd.png",
        "image/png"
      );

      expect(writeFileSpy).toHaveBeenCalledWith(
        path.join(mockDir, "passwd.png"),
        expect.any(Buffer)
      );
      expect(result.success && result.data.key).toBe("../../etc/passwd.png");
    });

    it("deletes existing file cleanly", async () => {
      const unlinkSpy = vi
        .spyOn(fs.promises, "unlink")
        .mockResolvedValue(undefined);

      const provider = new LocalStorageProvider(mockDir);
      await expect(provider.delete("file-to-delete.png")).resolves.toEqual(
        createSuccess(null)
      );

      expect(unlinkSpy).toHaveBeenCalledWith(
        path.join(mockDir, "file-to-delete.png")
      );
    });

    it("ignores errors gracefully when deleting a non-existent file", async () => {
      vi.spyOn(fs.promises, "unlink").mockRejectedValue(
        new Error("ENOENT: no such file or directory")
      );

      const provider = new LocalStorageProvider(mockDir);
      await expect(provider.delete("non-existent.png")).resolves.toEqual(
        createSuccess(null)
      );
    });

    it("generates local media URLs correctly", () => {
      const provider = new LocalStorageProvider(mockDir);
      expect(provider.getUrl("my-avatar.webp")).toBe(
        "/api/media/my-avatar.webp"
      );
    });

    it("retrieves asset successfully when file exists", async () => {
      const contentBuffer = Buffer.from("asset content");
      vi.spyOn(fs.promises, "readFile").mockResolvedValue(contentBuffer);

      const provider = new LocalStorageProvider(mockDir);
      const result = await provider.getAsset("hero-banner.jpg");
      const asset = result.success ? result.data : null;

      expect(asset).not.toBeNull();
      expect(asset?.buffer).toEqual(contentBuffer);
      expect(asset?.contentType).toBe("image/jpeg");
      expect(asset?.createdAt).toBeInstanceOf(Date);
    });

    it("returns an upload failure instead of throwing when the disk write fails", async () => {
      vi.spyOn(fs, "existsSync").mockReturnValue(true);
      const diskError = new Error("EACCES: permission denied");
      vi.spyOn(fs.promises, "writeFile").mockRejectedValue(diskError);

      const provider = new LocalStorageProvider(mockDir);
      const result = await provider.upload(
        Buffer.from("data"),
        "locked.png",
        "image/png"
      );

      expect(result).toMatchObject({
        success: false,
        error: { code: "UPLOAD_FAILED", details: diskError },
      });
    });

    it("returns null when reading asset fails", async () => {
      vi.spyOn(fs.promises, "readFile").mockRejectedValue(new Error("ENOENT"));

      const provider = new LocalStorageProvider(mockDir);
      const result = await provider.getAsset("missing.png");

      expect(result).toEqual(createSuccess(null));
    });
  });

  describe("VercelBlobStorageProvider", () => {
    const testToken = "vercel_blob_rw_test_token_12345";

    it("returns STORAGE_UNCONFIGURED without a request when no token is available", async () => {
      vi.spyOn(envModule, "getEnv").mockReturnValue({
        ...envModule.getEnv(),
        BLOB_READ_WRITE_TOKEN: undefined,
      });
      const fetchSpy = vi.spyOn(globalThis, "fetch");

      const provider = new VercelBlobStorageProvider("");
      expect(provider.isConfigured()).toBe(false);

      const expected = {
        success: false,
        error: {
          code: "STORAGE_UNCONFIGURED",
          message:
            "BLOB_READ_WRITE_TOKEN is required for VercelBlobStorageProvider",
          recoverable: false,
        },
      };
      await expect(
        provider.upload(Buffer.from("data"), "hero.png", "image/png")
      ).resolves.toMatchObject(expected);
      await expect(provider.delete("hero.png")).resolves.toMatchObject(
        expected
      );
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("initializes successfully when token is supplied explicitly", () => {
      const provider = new VercelBlobStorageProvider(testToken);
      expect(provider.getUrl("file.png")).toBe(
        "https://blob.vercel-storage.com/file.png"
      );
    });

    it("initializes successfully when token is read from getEnv()", () => {
      vi.spyOn(envModule, "getEnv").mockReturnValue({
        ...envModule.getEnv(),
        BLOB_READ_WRITE_TOKEN: testToken,
      });

      const provider = new VercelBlobStorageProvider();
      expect(provider.getUrl("file.png")).toBe(
        "https://blob.vercel-storage.com/file.png"
      );
    });

    it("uploads file to Vercel Blob storage via PUT request", async () => {
      const provider = new VercelBlobStorageProvider(testToken);
      const fileBuffer = Buffer.from("cloud payload");

      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
            url: "https://abc.public.blob.vercel-storage.com/cloud-hero.png",
            pathname: "cloud-hero.png",
          }),
          { status: 200, statusText: "OK" }
        )
      );

      const result = await provider.upload(
        fileBuffer,
        "cloud-hero.png",
        "image/png"
      );

      expect(fetchSpy).toHaveBeenCalledWith(
        "https://blob.vercel-storage.com/cloud-hero.png",
        {
          method: "PUT",
          headers: {
            authorization: `Bearer ${testToken}`,
            "x-content-type": "image/png",
            "x-add-random-suffix": "false",
          },
          body: expect.any(Uint8Array),
        }
      );

      expect(result).toEqual(
        createSuccess({
          url: "https://abc.public.blob.vercel-storage.com/cloud-hero.png",
          key: "cloud-hero.png",
        })
      );
    });

    it("uses filename as key if response does not contain pathname", async () => {
      const provider = new VercelBlobStorageProvider(testToken);

      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
            url: "https://abc.public.blob.vercel-storage.com/file.jpg",
          }),
          { status: 200, statusText: "OK" }
        )
      );

      const result = await provider.upload(
        Buffer.from("data"),
        "file.jpg",
        "image/jpeg"
      );
      expect(result.success && result.data.key).toBe("file.jpg");
    });

    it("returns UPLOAD_FAILED when Vercel Blob upload HTTP request fails", async () => {
      const provider = new VercelBlobStorageProvider(testToken);

      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          statusText: "Unauthorized",
        })
      );

      await expect(
        provider.upload(Buffer.from("data"), "hero.png", "image/png")
      ).resolves.toMatchObject({
        success: false,
        error: {
          code: "UPLOAD_FAILED",
          message: "Vercel Blob upload failed: Unauthorized",
        },
      });
    });

    it("returns UPLOAD_FAILED instead of throwing on a network error", async () => {
      const provider = new VercelBlobStorageProvider(testToken);
      const networkError = new TypeError("fetch failed");
      vi.spyOn(globalThis, "fetch").mockRejectedValue(networkError);

      await expect(
        provider.upload(Buffer.from("data"), "hero.png", "image/png")
      ).resolves.toMatchObject({
        success: false,
        error: { code: "UPLOAD_FAILED", details: networkError },
      });
    });

    it("returns DELETE_FAILED when Vercel Blob delete HTTP request fails", async () => {
      const provider = new VercelBlobStorageProvider(testToken);
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("{}", { status: 503, statusText: "Service Unavailable" })
      );

      await expect(provider.delete("hero.png")).resolves.toMatchObject({
        success: false,
        error: {
          code: "DELETE_FAILED",
          message: "Vercel Blob delete failed: Service Unavailable",
        },
      });
    });

    it("deletes file from Vercel Blob storage via POST request", async () => {
      const provider = new VercelBlobStorageProvider(testToken);

      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          statusText: "OK",
        })
      );

      await expect(
        provider.delete(
          "https://abc.public.blob.vercel-storage.com/cloud-hero.png"
        )
      ).resolves.toEqual(createSuccess(null));

      expect(fetchSpy).toHaveBeenCalledWith(
        "https://blob.vercel-storage.com/delete",
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${testToken}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            urls: ["https://abc.public.blob.vercel-storage.com/cloud-hero.png"],
          }),
        }
      );
    });

    it("returns key as-is from getUrl if it is already an absolute HTTP/HTTPS URL", () => {
      const provider = new VercelBlobStorageProvider(testToken);
      const absoluteUrl =
        "https://abc.public.blob.vercel-storage.com/image.png";
      const httpUrl = "http://localhost:3000/api/media/image.png";

      expect(provider.getUrl(absoluteUrl)).toBe(absoluteUrl);
      expect(provider.getUrl(httpUrl)).toBe(httpUrl);
    });

    it("prefixes key with blob domain from getUrl if key is relative", () => {
      const provider = new VercelBlobStorageProvider(testToken);
      expect(provider.getUrl("relative-key.png")).toBe(
        "https://blob.vercel-storage.com/relative-key.png"
      );
    });
  });

  describe("getMediaStorageProvider & setMediaStorageProvider", () => {
    it("returns LocalStorageProvider by default when BLOB_READ_WRITE_TOKEN is unconfigured", () => {
      vi.spyOn(envModule, "getEnv").mockReturnValue({
        ...envModule.getEnv(),
        BLOB_READ_WRITE_TOKEN: undefined,
      });

      const provider = getMediaStorageProvider();
      expect(provider.success && provider.data).toBeInstanceOf(
        LocalStorageProvider
      );
    });

    it("returns VercelBlobStorageProvider when BLOB_READ_WRITE_TOKEN is configured in env", () => {
      vi.spyOn(envModule, "getEnv").mockReturnValue({
        ...envModule.getEnv(),
        BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_env_token_999",
      });

      const provider = getMediaStorageProvider();
      expect(provider.success && provider.data).toBeInstanceOf(
        VercelBlobStorageProvider
      );
    });

    it("allows overriding active provider via setMediaStorageProvider", () => {
      const customProvider: MediaStorageProvider = {
        upload: vi.fn(),
        delete: vi.fn(),
        getUrl: (key) => `https://custom-cdn.com/${key}`,
      };

      setMediaStorageProvider(customProvider);
      const active = getMediaStorageProvider();

      expect(active).toEqual(createSuccess(customProvider));
      expect(active.success && active.data.getUrl("asset.png")).toBe(
        "https://custom-cdn.com/asset.png"
      );
    });

    it("restores default environment provider when setMediaStorageProvider(null) is called", () => {
      const customProvider: MediaStorageProvider = {
        upload: vi.fn(),
        delete: vi.fn(),
        getUrl: vi.fn(),
      };

      setMediaStorageProvider(customProvider);
      expect(getMediaStorageProvider()).toEqual(createSuccess(customProvider));

      setMediaStorageProvider(null);
      vi.spyOn(envModule, "getEnv").mockReturnValue({
        ...envModule.getEnv(),
        BLOB_READ_WRITE_TOKEN: undefined,
      });

      const restored = getMediaStorageProvider();
      expect(restored.success && restored.data).toBeInstanceOf(
        LocalStorageProvider
      );
    });
  });

  describe("Storage Environment Boundaries", () => {
    it("uses local disk storage in test environments when cloud credentials are omitted", async () => {
      // Simulate environment where BLOB_READ_WRITE_TOKEN is absent
      vi.spyOn(envModule, "getEnv").mockReturnValue({
        ...envModule.getEnv(),
        BLOB_READ_WRITE_TOKEN: "",
      });

      const resolved = getMediaStorageProvider();
      if (!resolved.success) throw new Error("expected a local provider");
      const activeProvider = resolved.data;
      expect(activeProvider).toBeInstanceOf(LocalStorageProvider);

      // Verify file operations work cleanly using local fallback
      vi.spyOn(fs, "existsSync").mockReturnValue(true);
      const writeFileSpy = vi
        .spyOn(fs.promises, "writeFile")
        .mockResolvedValue(undefined);

      const result = await activeProvider.upload(
        Buffer.from("fallback asset"),
        "fallback-image.png",
        "image/png"
      );

      expect(result.success && result.data.url).toBe(
        "/api/media/fallback-image.png"
      );
      expect(writeFileSpy).toHaveBeenCalledWith(
        expect.stringContaining("fallback-image.png"),
        expect.any(Buffer)
      );
    });

    it("rejects cloud upload failures without writing to ephemeral local storage", async () => {
      const cloudToken = "vercel_blob_rw_primary_123";
      const primaryCloudProvider = new VercelBlobStorageProvider(cloudToken);
      setMediaStorageProvider(primaryCloudProvider);

      // Mock cloud upload failure (e.g. 500 internal server error or network failure)
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ error: "Storage service unavailable" }), {
          status: 500,
          statusText: "Internal Server Error",
        })
      );

      const writeFileSpy = vi
        .spyOn(fs.promises, "writeFile")
        .mockResolvedValue(undefined);

      const fileBuffer = Buffer.from("resilient asset content");
      await expect(
        ProjectImageService.saveMediaAsset(
          "resilient-hero.png",
          fileBuffer,
          "image/png"
        )
      ).resolves.toMatchObject({
        success: false,
        error: {
          code: "UPLOAD_FAILED",
          message: "Vercel Blob upload failed: Internal Server Error",
        },
      });

      expect(writeFileSpy).not.toHaveBeenCalled();
    });

    it("does not select local disk storage for production deployments without cloud credentials", () => {
      vi.spyOn(envModule, "getEnv").mockReturnValue({
        ...envModule.getEnv(),
        NODE_ENV: "production",
        VERCEL_ENV: "production",
        BLOB_READ_WRITE_TOKEN: undefined,
      });

      expect(getMediaStorageProvider()).toMatchObject({
        success: false,
        error: {
          code: "STORAGE_UNCONFIGURED",
          message:
            "BLOB_READ_WRITE_TOKEN is required for media storage in production or preview environments",
          recoverable: false,
        },
      });
    });

    it("returns no asset for cloud providers without read support instead of reading local disk", async () => {
      vi.spyOn(envModule, "getEnv").mockReturnValue({
        ...envModule.getEnv(),
        NODE_ENV: "production",
        VERCEL_ENV: "production",
        BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_cloud_read_123",
      });
      const localReadSpy = vi
        .spyOn(fs.promises, "readFile")
        .mockResolvedValue(Buffer.from("stale local asset"));

      await expect(
        ProjectImageService.getMediaAsset("project-laser-loon.png")
      ).resolves.toEqual(createSuccess(null));

      expect(localReadSpy).not.toHaveBeenCalled();
    });

    it("returns cloud read errors as READ_FAILED without retrying against local disk", async () => {
      vi.spyOn(envModule, "getEnv").mockReturnValue({
        ...envModule.getEnv(),
        NODE_ENV: "production",
        VERCEL_ENV: "production",
        BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_cloud_read_123",
      });
      const readFailure = new Error("Cloud media read failed");
      const cloudProvider: MediaStorageProvider = {
        upload: vi.fn(),
        delete: vi.fn(),
        getUrl: (key) => `https://cdn.example.com/${key}`,
        getAsset: vi.fn().mockResolvedValue(
          createFailure("READ_FAILED", "Cloud media read failed", {
            details: readFailure,
          })
        ),
      };
      setMediaStorageProvider(cloudProvider);
      const localReadSpy = vi
        .spyOn(fs.promises, "readFile")
        .mockResolvedValue(Buffer.from("stale local asset"));

      await expect(
        ProjectImageService.getMediaAsset("project-laser-loon.png")
      ).resolves.toMatchObject({
        success: false,
        error: { code: "READ_FAILED", details: readFailure },
      });

      expect(localReadSpy).not.toHaveBeenCalled();
    });

    it("contains a provider that throws despite the result contract", async () => {
      const providerError = new Error("custom provider exploded");
      setMediaStorageProvider({
        upload: vi.fn().mockRejectedValue(providerError),
        delete: vi.fn().mockRejectedValue(providerError),
        getUrl: (key) => key,
        getAsset: vi.fn().mockRejectedValue(providerError),
      });

      await expect(
        ProjectImageService.saveMediaAsset(
          "a.png",
          Buffer.from("x"),
          "image/png"
        )
      ).resolves.toMatchObject({
        success: false,
        error: { code: "UPLOAD_FAILED", details: providerError },
      });
      await expect(
        ProjectImageService.getMediaAsset("a.png")
      ).resolves.toMatchObject({
        success: false,
        error: { code: "READ_FAILED", details: providerError },
      });
      await expect(
        ProjectImageService.deleteMediaAsset("a.png")
      ).resolves.toMatchObject({
        success: false,
        error: { code: "DELETE_FAILED", details: providerError },
      });
    });

    it("returns DELETE_FAILED for production cloud delete failures without deleting from local disk", async () => {
      vi.spyOn(envModule, "getEnv").mockReturnValue({
        ...envModule.getEnv(),
        NODE_ENV: "production",
        VERCEL_ENV: "production",
        BLOB_READ_WRITE_TOKEN: "test-blob-token",
      });
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ error: "Storage service unavailable" }), {
          status: 503,
          statusText: "Service Unavailable",
        })
      );
      const localDeleteSpy = vi
        .spyOn(fs.promises, "unlink")
        .mockResolvedValue(undefined);

      await expect(
        ProjectImageService.deleteMediaAsset(
          "https://abc.public.blob.vercel-storage.com/project-laser-loon.png"
        )
      ).resolves.toMatchObject({
        success: false,
        error: { code: "DELETE_FAILED" },
      });

      expect(localDeleteSpy).not.toHaveBeenCalled();
    });

    it("continues to fail production delete closed when cloud storage credentials are missing", async () => {
      vi.spyOn(envModule, "getEnv").mockReturnValue({
        ...envModule.getEnv(),
        NODE_ENV: "production",
        VERCEL_ENV: "production",
        BLOB_READ_WRITE_TOKEN: undefined,
      });

      await expect(
        ProjectImageService.deleteMediaAsset("project-laser-loon.png")
      ).resolves.toMatchObject({
        success: false,
        error: {
          code: "STORAGE_UNCONFIGURED",
          message:
            "BLOB_READ_WRITE_TOKEN is required for media storage in production or preview environments",
        },
      });
    });
  });
});
