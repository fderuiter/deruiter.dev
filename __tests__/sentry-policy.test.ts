// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import {
  MAX_PRODUCTION_TRACES_SAMPLE_RATE,
  SENTRY_DATA_COLLECTION,
  isBenignClientNoise,
  isReportableEnvironment,
  resolveTracesSampleRate,
} from "@/lib/sentry-policy";

describe("Sentry quota and noise policy", () => {
  describe("trace sampling", () => {
    it("clamps production to the ADR 0036 ceiling", () => {
      expect(resolveTracesSampleRate(true)).toBe(
        MAX_PRODUCTION_TRACES_SAMPLE_RATE
      );
      expect(MAX_PRODUCTION_TRACES_SAMPLE_RATE).toBeLessThanOrEqual(0.05);
    });

    it("samples nothing outside production", () => {
      // NODE_ENV is "production" for preview builds too, so a preview must not
      // be able to reach a non-zero rate.
      expect(resolveTracesSampleRate(false)).toBe(0);
    });

    it("never returns full sampling", () => {
      expect(resolveTracesSampleRate(true)).not.toBe(1);
      expect(resolveTracesSampleRate(false)).not.toBe(1);
    });
  });

  describe("environment reporting gate", () => {
    it("reports only from a production deployment", () => {
      expect(isReportableEnvironment(true)).toBe(true);
      expect(isReportableEnvironment(false)).toBe(false);
    });

    it("drops the local development errors that spend the error budget", () => {
      // A developer running next dev against the production DSN previously
      // billed hot-reload aborts and local Redis timeouts to the 5k allowance.
      const timeout = new Error("Redis buffer enqueue timed out after 2000ms");
      const beforeSend = (error: unknown) =>
        !isReportableEnvironment(false) || isBenignClientNoise(error)
          ? null
          : error;
      expect(beforeSend(timeout)).toBeNull();
    });
  });

  describe("benign client noise", () => {
    it("drops aborted requests", () => {
      const abort = new Error("The operation was aborted");
      abort.name = "AbortError";
      expect(isBenignClientNoise(abort)).toBe(true);
    });

    it("drops both ResizeObserver notifications", () => {
      expect(
        isBenignClientNoise(new Error("ResizeObserver loop limit exceeded"))
      ).toBe(true);
      expect(
        isBenignClientNoise(
          new Error(
            "ResizeObserver loop completed with undelivered notifications."
          )
        )
      ).toBe(true);
    });

    it("drops faults originating in browser extensions", () => {
      const extensionError = new Error("undefined is not an object");
      extensionError.stack = "at chrome-extension://abcdef/content.js:1:1";
      expect(isBenignClientNoise(extensionError)).toBe(true);
      expect(
        isBenignClientNoise(new Error("x"), "moz-extension://xyz/inject.js")
      ).toBe(true);
    });

    it("still drops simulated game engine exceptions", () => {
      const gameError = new Error("simulated");
      gameError.name = "GameEngineException";
      expect(isBenignClientNoise(gameError)).toBe(true);
    });

    it("drops streaming responses aborted by the visitor", () => {
      expect(
        isBenignClientNoise(new Error("The destination stream closed early."))
      ).toBe(true);
    });

    it("keeps real application errors", () => {
      expect(
        isBenignClientNoise(new TypeError("cannot read x of undefined"))
      ).toBe(false);
      expect(isBenignClientNoise(new Error("Database connection failed"))).toBe(
        false
      );
      expect(isBenignClientNoise(undefined)).toBe(false);
      expect(isBenignClientNoise(null)).toBe(false);
      // A buffer timeout drops a telemetry event outright, so production must
      // still see it once the environment gate allows the event through.
      expect(
        isBenignClientNoise(
          new Error("Redis buffer enqueue timed out after 2000ms")
        )
      ).toBe(false);
    });
  });

  describe("data collection (Sentry 11 replaces sendDefaultPii)", () => {
    it("collects no user info, cookies, headers, bodies or query params", () => {
      expect(SENTRY_DATA_COLLECTION).toEqual({
        userInfo: false,
        cookies: false,
        httpHeaders: false,
        httpBodies: [],
        urlQueryParams: false,
      });
    });

    it.each([
      "lib/client-sentry.ts",
      "sentry.server.config.ts",
      "sentry.edge.config.ts",
    ])("%s opts out of PII through the shared policy", (file) => {
      const source = readFileSync(path.resolve(process.cwd(), file), "utf8");
      expect(source).toContain("dataCollection: SENTRY_DATA_COLLECTION");
      expect(source).not.toContain("sendDefaultPii");
    });
  });
});
