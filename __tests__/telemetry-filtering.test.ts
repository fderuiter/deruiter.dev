// @vitest-environment node
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock Sentry.init to intercept the config passed to it
const { mockInit } = vi.hoisted(() => ({
  mockInit: vi.fn(),
}));

vi.mock("@sentry/nextjs", async (importOriginal) => {
  const original = await importOriginal<typeof import("@sentry/nextjs")>();
  return {
    default: {
      ...original,
      init: (config: any) => {
        mockInit(config);
        return original.init(config);
      },
    },
    ...original,
    init: (config: any) => {
      mockInit(config);
      return original.init(config);
    },
  };
});

import { GameEngineException } from "../lib/exceptions";
import { resetSentryInitializationForTesting } from "../lib/client-sentry";

describe("Sentry Telemetry Filtering for Game Engine Exceptions", () => {
  const originalVercelEnv = process.env.VERCEL_ENV;

  beforeEach(() => {
    mockInit.mockClear();
    resetSentryInitializationForTesting();
    // beforeSend drops every event outside a production deployment, so the
    // noise-filter assertions below can only be reached from production.
    process.env.VERCEL_ENV = "production";
  });

  afterEach(() => {
    if (originalVercelEnv === undefined) {
      delete process.env.VERCEL_ENV;
    } else {
      process.env.VERCEL_ENV = originalVercelEnv;
    }
  });

  it("should filter out GameEngineException in Client config", async () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN =
      "https://validkey@o0.ingest.sentry.io/123456";
    // Dynamically require to ensure we trigger Sentry.init on clean mock
    const { initClientSentry, clientSentryPromise } =
      await import("../instrumentation-client");
    await clientSentryPromise;
    await initClientSentry();
    expect(mockInit).toHaveBeenCalled();
    const config = mockInit.mock.calls[0][0];
    expect(config.beforeSend).toBeDefined();

    // Test beforeSend behavior
    const gameError = new GameEngineException("A mock game engine crash");
    const stdError = new Error("A standard runtime exception");

    const event = { event_id: "1" };

    // Should discard GameEngineException
    const resultForGame = config.beforeSend(event, {
      originalException: gameError,
    });
    expect(resultForGame).toBeNull();

    // Should preserve standard errors
    const resultForStd = config.beforeSend(event, {
      originalException: stdError,
    });
    expect(resultForStd).toEqual(event);
  });

  it("should bypass Client telemetry initialization when DSN is missing or dummy", async () => {
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;
    const { initClientSentry, reportClientError } =
      await import("../lib/client-sentry");

    // Reset mock
    mockInit.mockClear();

    // Missing DSN
    await initClientSentry();
    expect(mockInit).not.toHaveBeenCalled();

    // Dummy DSN
    process.env.NEXT_PUBLIC_SENTRY_DSN = "https://dummy@o0.ingest.sentry.io/0";
    await reportClientError(new Error("Test crash"));
    expect(mockInit).not.toHaveBeenCalled();
  });

  it("should filter out GameEngineException in Server config", async () => {
    await import("../sentry.server.config");
    expect(mockInit).toHaveBeenCalled();
    // Get the most recent call
    const config = mockInit.mock.calls[mockInit.mock.calls.length - 1][0];
    expect(config.beforeSend).toBeDefined();

    const gameError = new GameEngineException("A mock game engine crash");
    const stdError = new Error("A standard runtime exception");

    const event = { event_id: "2" };

    const resultForGame = config.beforeSend(event, {
      originalException: gameError,
    });
    expect(resultForGame).toBeNull();

    const resultForStd = config.beforeSend(event, {
      originalException: stdError,
    });
    expect(resultForStd).toEqual(event);
  });

  it("should filter out GameEngineException in Edge config", async () => {
    await import("../sentry.edge.config");
    expect(mockInit).toHaveBeenCalled();
    const config = mockInit.mock.calls[mockInit.mock.calls.length - 1][0];
    expect(config.beforeSend).toBeDefined();

    const gameError = new GameEngineException("A mock game engine crash");
    const stdError = new Error("A standard runtime exception");

    const event = { event_id: "3" };

    const resultForGame = config.beforeSend(event, {
      originalException: gameError,
    });
    expect(resultForGame).toBeNull();

    const resultForStd = config.beforeSend(event, {
      originalException: stdError,
    });
    expect(resultForStd).toEqual(event);
  });

  it("should drop every event outside a production deployment", async () => {
    // The config modules run their init at import time, and an earlier test
    // already imported this one, so the registry must be reset to re-run it.
    vi.resetModules();
    await import("../sentry.server.config");
    const config = mockInit.mock.calls[mockInit.mock.calls.length - 1][0];

    for (const vercelEnv of ["preview", "development", undefined]) {
      if (vercelEnv === undefined) {
        delete process.env.VERCEL_ENV;
      } else {
        process.env.VERCEL_ENV = vercelEnv;
      }

      const result = config.beforeSend(
        { event_id: "4" },
        { originalException: new Error("A standard runtime exception") }
      );
      expect(result).toBeNull();
    }
  });

  it("should initialize GameEngineException with default message", () => {
    const error = new GameEngineException();
    expect(error.message).toBe("Simulated gameplay failure");
  });
});
