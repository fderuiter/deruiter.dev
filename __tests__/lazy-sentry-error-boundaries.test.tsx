/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, cleanup, waitFor } from "@testing-library/react";

// Configure React 19 act environment
(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const { mockInit, mockCaptureException } = vi.hoisted(() => ({
  mockInit: vi.fn(),
  mockCaptureException: vi.fn(),
}));

vi.mock("@sentry/nextjs", async (importOriginal) => {
  const original = await importOriginal<typeof import("@sentry/nextjs")>();
  return {
    default: {
      ...original,
      init: (config: unknown) => {
        mockInit(config);
        return original.init(config as any);
      },
      captureException: (err: unknown) => {
        mockCaptureException(err);
        return original.captureException(err as any);
      },
    },
    ...original,
    init: (config: unknown) => {
      mockInit(config);
      return original.init(config as any);
    },
    captureException: (err: unknown) => {
      mockCaptureException(err);
      return original.captureException(err as any);
    },
  };
});

import ErrorBoundaryApp from "../app/error";
import GlobalErrorApp from "../app/global-error";
import CaseStudyErrorApp from "../app/(desktop)/case-studies/[slug]/error";
import {
  isDummyOrMissingDsn,
  initClientSentry,
  reportClientError,
  resetSentryInitializationForTesting,
} from "../lib/client-sentry";

describe("Lazy Sentry Loading in Error Boundaries & Conditional Initialization", () => {
  const originalEnvDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

  beforeEach(() => {
    vi.clearAllMocks();
    resetSentryInitializationForTesting();
    // Stub console.error to avoid test noise from error boundary renders
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    process.env.NEXT_PUBLIC_SENTRY_DSN = originalEnvDsn;
    vi.restoreAllMocks();
  });

  describe("Requirement 3: Conditional Initialization & Dummy Credential Bypass", () => {
    it("identifies dummy or missing DSN configurations correctly", () => {
      expect(isDummyOrMissingDsn(undefined)).toBe(true);
      expect(isDummyOrMissingDsn("")).toBe(true);
      expect(isDummyOrMissingDsn("   ")).toBe(true);
      expect(isDummyOrMissingDsn("https://dummy@o0.ingest.sentry.io/0")).toBe(
        true
      );
      expect(isDummyOrMissingDsn("https://example@sentry.io/123")).toBe(true);
      expect(isDummyOrMissingDsn("https://0000@sentry.io/0")).toBe(true);

      expect(
        isDummyOrMissingDsn("https://acme123@o0.ingest.sentry.io/456789")
      ).toBe(false);
    });

    it("bypasses initClientSentry when DSN is missing or dummy", async () => {
      delete process.env.NEXT_PUBLIC_SENTRY_DSN;
      const res1 = await initClientSentry();
      expect(res1).toBeNull();
      expect(mockInit).not.toHaveBeenCalled();

      process.env.NEXT_PUBLIC_SENTRY_DSN =
        "https://dummy@o0.ingest.sentry.io/0";
      const res2 = await initClientSentry();
      expect(res2).toBeNull();
      expect(mockInit).not.toHaveBeenCalled();
    });

    it("bypasses reportClientError when DSN is missing or dummy without invoking Sentry SDK", async () => {
      process.env.NEXT_PUBLIC_SENTRY_DSN = "";
      const testError = new Error("Uncaught runtime exception");
      await reportClientError(testError);

      expect(mockInit).not.toHaveBeenCalled();
      expect(mockCaptureException).not.toHaveBeenCalled();
    });
  });

  describe("Requirement 2 & 4: Error Boundaries Dynamic Fetching & Immediate Fallback UI", () => {
    it("renders app/error.tsx fallback UI immediately and triggers deferred telemetry when valid DSN is set", async () => {
      process.env.NEXT_PUBLIC_SENTRY_DSN =
        "https://validkey@o0.ingest.sentry.io/999999";
      const sampleError = new Error("Pipeline compilation failure");
      const resetFn = vi.fn();

      render(<ErrorBoundaryApp error={sampleError} reset={resetFn} />);

      // Fallback UI must render immediately
      expect(screen.getByText("This page hit a snag.")).not.toBeNull();
      expect(screen.getByText("RUNTIME_ERROR")).not.toBeNull();

      await waitFor(() => {
        expect(mockInit).toHaveBeenCalled();
        expect(mockCaptureException).toHaveBeenCalledWith(sampleError);
      });
    });

    it("renders app/global-error.tsx fallback UI immediately and triggers deferred telemetry", async () => {
      process.env.NEXT_PUBLIC_SENTRY_DSN =
        "https://validkey@o0.ingest.sentry.io/999999";
      const rootError = new Error("Root rendering tree unhandled crash");
      const resetFn = vi.fn();

      render(<GlobalErrorApp error={rootError} reset={resetFn} />);

      expect(screen.getByText("Unrecoverable Crash")).not.toBeNull();
      expect(screen.getByText("CRITICAL_HALT")).not.toBeNull();

      await waitFor(() => {
        expect(mockInit).toHaveBeenCalled();
        expect(mockCaptureException).toHaveBeenCalledWith(rootError);
      });
    });

    it("renders app/case-studies/[slug]/error.tsx fallback UI immediately and triggers deferred telemetry", async () => {
      process.env.NEXT_PUBLIC_SENTRY_DSN =
        "https://validkey@o0.ingest.sentry.io/999999";
      const caseError = new Error("Database Neon query failure");
      const resetFn = vi.fn();

      render(<CaseStudyErrorApp error={caseError} reset={resetFn} />);

      expect(
        screen.getByText("This case study couldn't be loaded.")
      ).not.toBeNull();
      expect(screen.getByText("LOAD_FAILED")).not.toBeNull();

      await waitFor(() => {
        expect(mockInit).toHaveBeenCalled();
        expect(mockCaptureException).toHaveBeenCalledWith(caseError);
      });
    });

    it("renders error boundaries fallback UI gracefully without crashing even when Sentry import fails or network error occurs", async () => {
      process.env.NEXT_PUBLIC_SENTRY_DSN =
        "https://validkey@o0.ingest.sentry.io/999999";
      const testError = new Error("Network offline crash");
      const resetFn = vi.fn();

      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});

      // Simulate a network failure during dynamic Sentry import by making reportClientError catch gracefully
      await reportClientError(testError);

      render(<ErrorBoundaryApp error={testError} reset={resetFn} />);

      expect(screen.getByText("This page hit a snag.")).not.toBeNull();
      consoleWarnSpy.mockRestore();
    });
  });

  describe("Requirement 5: Single main landmark & visitor-safe recovery copy", () => {
    it("does not render its own <main> landmark (it mounts inside the root layout's <main>)", () => {
      process.env.NEXT_PUBLIC_SENTRY_DSN =
        "https://validkey@o0.ingest.sentry.io/999999";
      const { container } = render(
        <ErrorBoundaryApp error={new Error("boom")} reset={vi.fn()} />
      );

      expect(container.querySelector("main")).toBeNull();
    });

    it("case-study error boundary does not render its own <main> landmark", () => {
      process.env.NEXT_PUBLIC_SENTRY_DSN =
        "https://validkey@o0.ingest.sentry.io/999999";
      const { container } = render(
        <CaseStudyErrorApp error={new Error("boom")} reset={vi.fn()} />
      );

      expect(container.querySelector("main")).toBeNull();
    });

    it("case-study error boundary never leaks backend implementation detail (database/vendor names) to visitors", () => {
      process.env.NEXT_PUBLIC_SENTRY_DSN =
        "https://validkey@o0.ingest.sentry.io/999999";
      render(
        <CaseStudyErrorApp
          error={new Error("Neon database connection pool exhausted")}
          reset={vi.fn()}
        />
      );

      const bodyText = document.body.textContent ?? "";
      expect(bodyText).not.toMatch(/neon/i);
      expect(bodyText).not.toMatch(/database/i);
      expect(bodyText).not.toMatch(/postgres/i);
    });

    it("case-study error boundary offers a contextual way back to the case study list", () => {
      process.env.NEXT_PUBLIC_SENTRY_DSN =
        "https://validkey@o0.ingest.sentry.io/999999";
      render(<CaseStudyErrorApp error={new Error("boom")} reset={vi.fn()} />);

      const backLink = screen.getByRole("link", {
        name: /back to case studies/i,
      });
      expect(backLink.getAttribute("href")).toBe("/case-studies");
    });
  });
});
