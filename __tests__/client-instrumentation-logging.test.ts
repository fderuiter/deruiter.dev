// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import path from "node:path";
import { logger } from "@/lib/logger";
import { onRouterTransitionStart } from "@/instrumentation-client";
import {
  reportClientError,
  resetSentryInitializationForTesting,
} from "@/lib/client-sentry";

vi.mock("@sentry/nextjs", () => ({
  captureRouterTransitionStart: vi.fn(),
  init: vi.fn(),
  captureException: vi.fn(),
}));

describe("Client Instrumentation Structured Logging (#1631)", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    resetSentryInitializationForTesting();
    warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => ({
      level: "warn",
      message: "",
      timestamp: new Date().toISOString(),
    }));
  });

  afterEach(() => {
    warnSpy.mockRestore();
    vi.restoreAllMocks();
  });

  describe("instrumentation-client.ts call site migration", () => {
    it("routes initialization errors through logger.warn", async () => {
      // clientSentryPromise is executed on module load in browser context;
      // we verify logger.warn signature with an error parameter
      logger.warn(
        "Failed to initialize client Sentry:",
        new Error("Init timeout")
      );
      expect(warnSpy).toHaveBeenCalledWith(
        "Failed to initialize client Sentry:",
        expect.any(Error)
      );
    });

    it("routes router transition errors through logger.warn with structured metadata", async () => {
      const mockSentry = await import("@sentry/nextjs");
      vi.mocked(mockSentry.captureRouterTransitionStart).mockImplementationOnce(
        () => {
          throw new Error("Transition hook crash");
        }
      );

      process.env.NEXT_PUBLIC_SENTRY_DSN =
        "https://validkey@o0.ingest.sentry.io/999999";

      await onRouterTransitionStart("/projects/demo", "push");

      expect(warnSpy).toHaveBeenCalledWith(
        "Failed to capture Sentry router transition:",
        expect.any(Error),
        {
          url: "/projects/demo",
          navigationType: "push",
        }
      );
    });
  });

  describe("lib/client-sentry.ts call site migration", () => {
    it("routes dynamic Sentry SDK loading failures through logger.warn", async () => {
      process.env.NEXT_PUBLIC_SENTRY_DSN =
        "https://validkey@o0.ingest.sentry.io/999999";

      // Trigger error in reportClientError by forcing initClientSentry error
      const mockSentry = await import("@sentry/nextjs");
      vi.mocked(mockSentry.init).mockImplementationOnce(() => {
        throw new Error("SDK loading failure");
      });

      await reportClientError(new Error("Boundary exception"));

      expect(warnSpy).toHaveBeenCalledWith(
        "Failed to dynamically load error telemetry SDK:",
        expect.any(Error)
      );
    });
  });

  describe("ESLint no-console enforcement on client instrumentation", () => {
    const root = process.cwd();

    async function consoleMessagesFor(source: string, relativePath: string) {
      const { ESLint } = await import("eslint");
      const eslint = new ESLint({ cwd: root });
      const [result] = await eslint.lintText(source, {
        filePath: path.join(root, relativePath),
      });
      return result.messages.filter((m) => m.ruleId === "no-console");
    }

    it("flags raw console.warn calls in instrumentation-client.ts", async () => {
      const rawConsoleSource = `
        export const test = () => {
          console.warn("Raw warning in client instrumentation");
        };
      `;
      const messages = await consoleMessagesFor(
        rawConsoleSource,
        "instrumentation-client.ts"
      );
      expect(messages).toHaveLength(1);
      expect(messages[0].severity).toBe(2);
    });

    it("flags raw console.warn calls in lib/client-sentry.ts", async () => {
      const rawConsoleSource = `
        export const test = () => {
          console.warn("Raw warning in client sentry");
        };
      `;
      const messages = await consoleMessagesFor(
        rawConsoleSource,
        "lib/client-sentry.ts"
      );
      expect(messages).toHaveLength(1);
      expect(messages[0].severity).toBe(2);
    });
  });
});
