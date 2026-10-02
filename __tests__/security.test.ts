// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  validateRouteInitialization,
  validateSyncRequest,
} from "@/lib/security";
import { NextRequest } from "next/server";

describe("Telemetry Sync Route Security Utilities", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.unstubAllEnvs();
  });

  describe("validateRouteInitialization", () => {
    it("should allow initialization in development when CRON_SECRET is missing", () => {
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("CRON_SECRET", "");
      expect(() => validateRouteInitialization()).not.toThrow();
    });

    it("should allow initialization in test when CRON_SECRET is missing", () => {
      vi.stubEnv("NODE_ENV", "test");
      vi.stubEnv("CRON_SECRET", "");
      expect(() => validateRouteInitialization()).not.toThrow();
    });

    it("should fail initialization in production when CRON_SECRET is missing", () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("CRON_SECRET", "");
      expect(() => validateRouteInitialization()).toThrowError(
        "Route initialization failed: Required validation secret is missing."
      );
    });

    it("stays fail-closed on a CI runner, which exports CI=true for every job", () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("CI", "true");
      vi.stubEnv("NEXT_PHASE", "");
      vi.stubEnv("PLAYWRIGHT_TEST", "");
      vi.stubEnv("CRON_SECRET", "");
      expect(() => validateRouteInitialization()).toThrowError(
        "Route initialization failed: Required validation secret is missing."
      );
    });

    it("should allow initialization in production when CRON_SECRET is present", () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("CRON_SECRET", "super_secret_key");
      expect(() => validateRouteInitialization()).not.toThrow();
    });
  });

  describe("validateSyncRequest", () => {
    it("should reject requests in production if CRON_SECRET is missing", () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("CRON_SECRET", "");

      const req = new NextRequest("http://localhost/api/telemetry/sync");
      const result = validateSyncRequest(req);

      expect(result.isValid).toBe(false);
      expect(result.errorResponse).toBeDefined();
      expect(result.errorResponse?.status).toBe(401);
    });

    it("should reject requests in production with missing authorization header when CRON_SECRET is configured", () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("CRON_SECRET", "prod_secret");

      const req = new NextRequest("http://localhost/api/telemetry/sync");
      const result = validateSyncRequest(req);

      expect(result.isValid).toBe(false);
      expect(result.errorResponse?.status).toBe(401);
    });

    it("should reject requests in production with mismatched credentials", () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("CRON_SECRET", "prod_secret");

      const req = new NextRequest("http://localhost/api/telemetry/sync", {
        headers: {
          authorization: "Bearer wrong_secret",
        },
      });
      const result = validateSyncRequest(req);

      expect(result.isValid).toBe(false);
      expect(result.errorResponse?.status).toBe(401);
    });

    it("should accept requests in production with correct credentials", () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("CRON_SECRET", "prod_secret");

      const req = new NextRequest("http://localhost/api/telemetry/sync", {
        headers: {
          authorization: "Bearer prod_secret",
        },
      });
      const result = validateSyncRequest(req);

      expect(result.isValid).toBe(true);
      expect(result.errorResponse).toBeUndefined();
    });

    it("should accept requests in development without header when CRON_SECRET is missing", () => {
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("CRON_SECRET", "");

      const req = new NextRequest("http://localhost/api/telemetry/sync");
      const result = validateSyncRequest(req);

      expect(result.isValid).toBe(true);
      expect(result.errorResponse).toBeUndefined();
    });

    it("should reject requests in development with mismatched credentials when CRON_SECRET is configured", () => {
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("CRON_SECRET", "dev_secret");

      const req = new NextRequest("http://localhost/api/telemetry/sync", {
        headers: {
          authorization: "Bearer wrong_dev_secret",
        },
      });
      const result = validateSyncRequest(req);

      expect(result.isValid).toBe(false);
      expect(result.errorResponse?.status).toBe(401);
    });

    it("should accept requests in development with correct credentials when CRON_SECRET is configured", () => {
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("CRON_SECRET", "dev_secret");

      const req = new NextRequest("http://localhost/api/telemetry/sync", {
        headers: {
          authorization: "Bearer dev_secret",
        },
      });
      const result = validateSyncRequest(req);

      expect(result.isValid).toBe(true);
      expect(result.errorResponse).toBeUndefined();
    });
  });
});
