// @vitest-environment node
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { fromPartial } from "@total-typescript/shoehorn";
import { createApiHandler, serviceFailureResponse } from "@/lib/route-wrapper";
import { createFailure } from "@/lib/services/service-result";
import {
  ProcessRetryQueueHandler,
  RunMaintenanceHandler,
  UploadProjectImageHandler,
  type MaintenanceAdapters,
  type ProcessRetryQueueDeps,
  type UploadProjectImageDeps,
} from "@/lib/services";

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

const WORKSPACE_ROOT = process.cwd();

function buildMultiFrameError(label: string): Error {
  const dbPath = path.join(WORKSPACE_ROOT, "lib", "db.ts");
  const slicePath = path.join(
    WORKSPACE_ROOT,
    "lib",
    "services",
    "slice",
    "handler.ts"
  );
  const routePath = path.join(WORKSPACE_ROOT, "lib", "route-wrapper.ts");
  const err = new Error(`${label} at ${dbPath}`);
  err.stack = [
    `Error: ${label} at ${dbPath}`,
    `    at queryDatabase (${dbPath}:42:11)`,
    `    at Handler.execute (${slicePath}:88:19)`,
    `    at RouteBoundary (${routePath}:120:7)`,
  ].join("\n");
  return err;
}

function assertScrubbedSingleLineConsoleCalls(calls: unknown[][]): void {
  expect(calls.length).toBeGreaterThan(0);
  for (const args of calls) {
    for (const arg of args) {
      if (typeof arg === "string") {
        expect(arg).not.toContain(WORKSPACE_ROOT);
        expect(arg).not.toContain("\n    at ");
      }
    }
  }
}

describe("Production Sentry Multi-Frame Stack Retention & Console Scrubbing", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "production");
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("retains multi-frame Error.stack for Sentry in serviceFailureResponse and createApiHandler while scrubbing console logs", async () => {
    const sliceErr = buildMultiFrameError("Storage failure");
    const failure = createFailure(
      "STORAGE_UNAVAILABLE",
      "Database unavailable",
      { recoverable: true, details: sliceErr }
    );

    const res = serviceFailureResponse(failure, {
      logContext: "Boundary slice failed:",
    });
    expect(res.status).toBe(503);

    const unhandledErr = buildMultiFrameError("Unhandled route crash");
    const wrapped = createApiHandler(
      async () => {
        throw unhandledErr;
      },
      { auth: "public" }
    );
    const crashRes = await wrapped(
      new NextRequest("http://localhost:3000/api/test"),
      { params: Promise.resolve({}) }
    );
    expect(crashRes.status).toBe(500);

    await new Promise((r) => setTimeout(r, 15));

    const capturedErrors = vi
      .mocked(Sentry.captureException)
      .mock.calls.map((call) => call[0]);
    expect(capturedErrors).toContain(sliceErr);
    expect(capturedErrors).toContain(unhandledErr);

    for (const captured of [sliceErr, unhandledErr]) {
      expect(captured.stack?.split("\n").length).toBeGreaterThanOrEqual(4);
    }

    assertScrubbedSingleLineConsoleCalls(consoleErrorSpy.mock.calls);
  });

  it("forwards intact Error objects from RunMaintenanceHandler, UploadProjectImageHandler, and ProcessRetryQueueHandler to Sentry", async () => {
    const maintErr = buildMultiFrameError("Maintenance phase exception");
    const maintAdapters = fromPartial<MaintenanceAdapters>({
      syncTelemetry: async () => ({
        success: true,
        data: { processed: 0, inserted: 0 },
      }),
      dispatchNewsletter: async () => ({
        success: false,
        error: {
          code: "DISPATCH_FAILED",
          message: "Newsletter failed",
          recoverable: true,
          details: maintErr,
        },
      }),
      processEmailRetry: async () => ({
        success: true,
        data: { processed: 0, succeeded: 0, failed: 0 },
      }),
      runRetention: async () => ({
        success: true,
        data: { rollupsUpserted: 0, rawEventsDeleted: 0 },
      }),
    });

    await new RunMaintenanceHandler({ adapters: maintAdapters }).execute();

    const rollbackErr = buildMultiFrameError("Orphan media cleanup failure");
    const pngMagic = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    ]);
    const uploadDeps = fromPartial<UploadProjectImageDeps>({
      getCaseStudyHandler: {
        execute: async () => ({ success: true, data: null }),
      },
      saveMediaAssetHandler: {
        execute: async () => ({
          success: true,
          data: "/api/media/orphan.png",
        }),
      },
      updateCaseStudyImageHandler: {
        execute: async () => ({
          success: false,
          error: {
            code: "PERSISTENCE_FAILED",
            message: "DB write failed",
            recoverable: true,
          },
        }),
      },
      deleteMediaAssetHandler: {
        execute: async () => ({
          success: false,
          error: {
            code: "STORAGE_DELETE_FAILED",
            message: "Delete failed",
            recoverable: true,
            details: rollbackErr,
          },
        }),
      },
    });
    await new UploadProjectImageHandler(uploadDeps).execute({
      slug: "crf",
      fileBuffer: pngMagic,
      mimeType: "image/png",
    });

    const retryErr = buildMultiFrameError("Queue lease query crashed");
    const retryDeps = fromPartial<ProcessRetryQueueDeps>({
      leaseRows: async () => {
        throw retryErr;
      },
    });
    await new ProcessRetryQueueHandler(retryDeps).execute({ maxBatchSize: 1 });

    await new Promise((r) => setTimeout(r, 15));

    const captured = vi
      .mocked(Sentry.captureException)
      .mock.calls.map((call) => call[0]);
    expect(captured).toContain(maintErr);
    expect(captured).toContain(rollbackErr);
    expect(captured).toContain(retryErr);

    for (const err of [maintErr, rollbackErr, retryErr]) {
      expect(err.stack?.split("\n").length).toBeGreaterThanOrEqual(4);
    }

    assertScrubbedSingleLineConsoleCalls([
      ...consoleErrorSpy.mock.calls,
      ...consoleWarnSpy.mock.calls,
    ]);
  });
});
