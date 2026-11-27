// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import path from "node:path";
import * as Sentry from "@sentry/nextjs";
import {
  ListCaseStudySummariesHandler,
  SubmitCaseStudyReactionHandler,
} from "@/lib/services";
import { serviceFailureResponse } from "@/lib/route-wrapper";
import { prisma } from "@/lib/db";

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

// Runtime production: the services only log their fallbacks there, and
// sanitizeError only scrubs there. isBuildPhase() is false so the build
// integrity guard does not throw.
vi.mock("@/lib/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/env")>();
  const prodEnv = {
    ...actual.env,
    NODE_ENV: "production",
    VERCEL_ENV: "production",
  };
  return {
    ...actual,
    env: prodEnv,
    getEnv: () => prodEnv,
    isBuildPhase: () => false,
  };
});

vi.mock("@/lib/db", () => ({
  prisma: {
    caseStudy: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/redis", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/redis")>();
  return {
    ...actual,
    isRedisConfigured: () => false,
  };
});

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
}));

describe("Service fallbacks log through the StructuredLogger (#1137)", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("sanitizes the database error and reports it to Sentry as a warning", async () => {
    const dbError = new Error(
      "connect failed while loading /home/deploy/site/lib/db.ts"
    );
    vi.mocked(prisma.caseStudy.findMany).mockRejectedValue(dbError);

    const result = await new ListCaseStudySummariesHandler().execute();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.length).toBeGreaterThan(0);
    }

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [message, loggedError] = warnSpy.mock.calls[0] as [string, Error];
    expect(message).toBe(
      "ListCaseStudySummariesHandler: Database query failed, using static fallbacks:"
    );
    expect(loggedError).not.toBe(dbError);
    expect(loggedError.message).toBe("connect failed while loading [scrubbed]");
    expect(loggedError.message).not.toContain("/home/deploy");

    await new Promise((r) => setTimeout(r, 0));
    expect(Sentry.captureException).toHaveBeenCalledWith(
      dbError,
      expect.objectContaining({ level: "warning" })
    );
  });

  it("forwards full multi-frame Error stack traces to Sentry when serviceFailureResponse logs a 5xx failure", async () => {
    function innerDbDriverCall(): never {
      throw new Error("connection terminated at /srv/deploy/db-driver.ts");
    }
    function outerRepositoryCall(): Error {
      try {
        innerDbDriverCall();
      } catch (err) {
        return err as Error;
      }
    }

    const multiFrameError = outerRepositoryCall();
    const originalFrameCount = (multiFrameError.stack ?? "").split("\n").length;
    expect(originalFrameCount).toBeGreaterThan(2);

    const reactionHandler = new SubmitCaseStudyReactionHandler({
      reactions: {
        createMany: vi.fn().mockRejectedValue(multiFrameError),
        groupBy: vi.fn().mockRejectedValue(multiFrameError),
        findMany: vi.fn().mockRejectedValue(multiFrameError),
      },
    });

    const failure = await reactionHandler.execute({
      caseStudySlug: "clinical-data-mapper",
      reactionType: "insightful",
      connectionHash: "abcdef1234567890",
    });

    expect(failure.success).toBe(false);
    if (failure.success) return;

    const response = serviceFailureResponse(failure, {
      logContext: "Case study reaction persistence failed:",
    });
    expect(response.status).toBe(503);

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const [, consoleLoggedErr] = errorSpy.mock.calls[0] as [string, Error];
    expect(consoleLoggedErr.message).toContain("[scrubbed]");

    await new Promise((r) => setTimeout(r, 0));
    expect(Sentry.captureException).toHaveBeenCalledWith(
      multiFrameError,
      expect.anything()
    );
    const captured = vi.mocked(Sentry.captureException).mock
      .calls[0]?.[0] as Error;
    expect(captured).toBe(multiFrameError);
    expect(captured.stack).toContain("innerDbDriverCall");
    expect(captured.stack).toContain("outerRepositoryCall");
  });
});

describe("ESLint no-console boundary (#1137)", () => {
  const root = process.cwd();
  const source = 'export const report = () => console.warn("notice");\n';

  async function consoleMessagesFor(relativePath: string) {
    const { ESLint } = await import("eslint");
    const eslint = new ESLint({ cwd: root });
    const [result] = await eslint.lintText(source, {
      filePath: path.join(root, relativePath),
    });
    return result.messages.filter((m) => m.ruleId === "no-console");
  }

  it.each([
    "lib/services/case-study/list-published-case-studies/handler.ts",
    "lib/services/garmin/probe/handler.ts",
    "lib/services/email/send-raw-email/handler.ts",
    "lib/probe-utils.ts",
    "lib/patrol/probe-engine.ts",
    "hooks/useProbe.ts",
    "app/probe/page.tsx",
    "components/ProbeWidget.tsx",
    "lib/client-sentry.ts",
    "instrumentation-client.ts",
  ])(
    "flags direct console calls in %s",
    async (file) => {
      const messages = await consoleMessagesFor(file);
      expect(messages).toHaveLength(1);
      expect(messages[0].severity).toBe(2);
    },
    60_000
  );

  it.each([
    "scripts/probe-cli.ts",
    "lib/dx/probe-bench.ts",
    "lib/logger.ts",
    "lib/env.ts",
    "lib/build-integrity.ts",
    "hooks/useConsoleArt.ts",
  ])(
    "allows console output in %s",
    async (file) => {
      const messages = await consoleMessagesFor(file);
      expect(messages).toHaveLength(0);
    },
    60_000
  );
});
