import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { StructuredLogger, logger } from "@/lib/logger";
import * as Sentry from "@sentry/nextjs";

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

describe("StructuredLogger", () => {
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleDebugSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    consoleDebugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exports a default singleton logger instance", () => {
    expect(logger).toBeInstanceOf(StructuredLogger);
  });

  it("logs info messages with structured metadata to console and Sentry breadcrumbs", async () => {
    const testLogger = new StructuredLogger();
    const entry = testLogger.info("System initialized", { module: "auth" });

    expect(entry.level).toBe("info");
    expect(entry.message).toBe("System initialized");
    expect(entry.meta).toEqual({ module: "auth" });
    expect(consoleInfoSpy).toHaveBeenCalledWith("System initialized", {
      module: "auth",
    });
    await new Promise((r) => setTimeout(r, 10));
    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
      category: "logger",
      message: "System initialized",
      level: "info",
      data: { module: "auth" },
    });
  });

  it("logs debug messages to console.debug", () => {
    const testLogger = new StructuredLogger();
    const entry = testLogger.debug("Cache miss", { key: "user_1" });

    expect(entry.level).toBe("debug");
    expect(entry.message).toBe("Cache miss");
    expect(consoleDebugSpy).toHaveBeenCalledWith("Cache miss", {
      key: "user_1",
    });
  });

  it("logs warning messages with errors or metadata", async () => {
    const testLogger = new StructuredLogger();
    const testErr = new Error("Quota near limit");
    const entry = testLogger.warn("Rate limit approaching", testErr, {
      threshold: 90,
    });

    expect(entry.level).toBe("warn");
    expect(entry.message).toBe("Rate limit approaching");
    expect(consoleWarnSpy).toHaveBeenCalled();
    await new Promise((r) => setTimeout(r, 0));
    expect(Sentry.captureException).toHaveBeenCalledWith(testErr, {
      level: "warning",
      extra: { message: "Rate limit approaching", threshold: 90 },
    });
  });

  it("logs error messages and captures exception in Sentry", async () => {
    const testLogger = new StructuredLogger();
    const testErr = new Error("Database connection failed");
    const entry = testLogger.error("Failed DB write", testErr, {
      route: "/api/contact",
    });

    expect(entry.level).toBe("error");
    expect(entry.message).toBe("Failed DB write");
    expect(consoleErrorSpy).toHaveBeenCalled();
    await new Promise((r) => setTimeout(r, 0));
    expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error), {
      extra: { message: "Failed DB write", route: "/api/contact" },
    });
  });

  it("captures Sentry message when error method is called without an Error instance", async () => {
    const testLogger = new StructuredLogger();
    testLogger.error("Unhandled state");

    await new Promise((r) => setTimeout(r, 0));
    expect(Sentry.captureMessage).toHaveBeenCalledWith("Unhandled state", {
      level: "error",
      extra: undefined,
    });
  });

  it("respects silent option by omitting console output", () => {
    const testLogger = new StructuredLogger({ silent: true });
    testLogger.info("Silent log");

    expect(consoleInfoSpy).not.toHaveBeenCalled();
  });

  it("respects enableTelemetry: false by omitting Sentry calls", () => {
    const testLogger = new StructuredLogger({ enableTelemetry: false });
    testLogger.error("Local error", new Error("Local test"));

    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("preserves actionable stack trace for Sentry in production while sanitizing console output", async () => {
    vi.stubEnv("NODE_ENV", "production");

    try {
      const testLogger = new StructuredLogger();
      const prodError = new Error(
        "Database query failed: /Users/admin/app/secret.ts"
      );
      prodError.stack =
        "Error: Database query failed\n    at query (/Users/admin/app/db.ts:10:5)\n    at process (/Users/admin/app/main.ts:20:3)";

      testLogger.error("Production DB failure", prodError);

      await new Promise((r) => setTimeout(r, 0));
      // Sentry must receive the original error with intact stack trace
      expect(Sentry.captureException).toHaveBeenCalledWith(prodError, {
        extra: { message: "Production DB failure" },
      });

      // Console error must receive sanitized error with deep stack stripped
      const consoleArg = consoleErrorSpy.mock.calls[0]?.[1] as Error;
      expect(consoleArg).toBeDefined();
      expect(consoleArg.stack).not.toContain("at query");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("bypasses telemetry dispatch when skipTelemetry option is passed in meta", () => {
    const testLogger = new StructuredLogger();
    const testErr = new Error("Handled elsewhere");

    testLogger.error("Client boundary error", testErr, { skipTelemetry: true });

    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  describe("metadata sanitization (#1475)", () => {
    it("scrubs paths from metadata that warn() receives as its second argument", async () => {
      const testLogger = new StructuredLogger();
      const meta = { file: "/var/task/lib/db.ts", attempt: 2 };

      const entry = testLogger.warn("Retrying", meta);

      expect(entry.meta).toEqual({ file: "[scrubbed]", attempt: 2 });
      expect(consoleWarnSpy).toHaveBeenCalledWith("Retrying", {
        file: "[scrubbed]",
        attempt: 2,
      });
      await new Promise((r) => setTimeout(r, 0));
      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({ data: { file: "[scrubbed]", attempt: 2 } })
      );
      // The caller's object is copied, never mutated.
      expect(meta.file).toBe("/var/task/lib/db.ts");
    });

    it("walks nested objects and arrays and survives circular references", () => {
      const testLogger = new StructuredLogger();
      const meta: Record<string, unknown> = {
        nested: { paths: ["/opt/admin/secret.json", "ok"] },
      };
      meta.self = meta;

      const entry = testLogger.info("Loaded", meta);

      expect(entry.meta).toEqual({
        nested: { paths: ["[scrubbed]", "ok"] },
        self: "[circular]",
      });
    });

    it("sanitizes errors nested in metadata in production", async () => {
      vi.stubEnv("NODE_ENV", "production");
      try {
        const testLogger = new StructuredLogger();
        const cause = new Error("failed at /var/task/lib/db.ts");

        const entry = testLogger.error("Wrapped", undefined, { cause });

        const logged = (entry.meta as { cause: Error }).cause;
        expect(logged).not.toBe(cause);
        expect(logged.message).toBe("failed at [scrubbed]");
        await new Promise((r) => setTimeout(r, 0));
        expect(Sentry.captureMessage).toHaveBeenCalledWith("Wrapped", {
          level: "error",
          extra: { cause: logged },
        });
      } finally {
        vi.unstubAllEnvs();
      }
    });

    it("still honours skipTelemetry", () => {
      const testLogger = new StructuredLogger();

      testLogger.warn("Denied", new Error("NotAllowedError"), {
        skipTelemetry: true,
      });

      expect(Sentry.captureException).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalled();
    });
  });
});
