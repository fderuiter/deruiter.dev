import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import path from "node:path";
import * as Sentry from "@sentry/nextjs";
import { CaseStudyService } from "@/lib/services/case-study-service";
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

  beforeEach(() => {
    vi.clearAllMocks();
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("sanitizes the database error and reports it to Sentry as a warning", async () => {
    const dbError = new Error(
      "connect failed while loading /home/deploy/app/lib/db.ts"
    );
    vi.mocked(prisma.caseStudy.findMany).mockRejectedValue(dbError);

    const studies = await CaseStudyService.getPublishedCaseStudies();
    expect(studies.length).toBeGreaterThan(0);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [message, loggedError] = warnSpy.mock.calls[0] as [string, Error];
    expect(message).toBe(
      "CaseStudyService.getPublishedCaseStudies: Database query failed, using static fallbacks:"
    );
    expect(loggedError).not.toBe(dbError);
    expect(loggedError.message).toBe("connect failed while loading [scrubbed]");
    expect(loggedError.message).not.toContain("/home/deploy");

    expect(Sentry.captureException).toHaveBeenCalledWith(
      dbError,
      expect.objectContaining({ level: "warning" })
    );
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
    "lib/services/probe-service.ts",
    "lib/services/garmin/probe/handler.ts",
    "lib/services/email-service.ts",
    "lib/probe-utils.ts",
    "lib/patrol/probe-engine.ts",
    "hooks/useProbe.ts",
    "app/probe/page.tsx",
    "components/ProbeWidget.tsx",
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
    "lib/client-sentry.ts",
    "lib/build-integrity.ts",
    "hooks/useConsoleArt.ts",
    "instrumentation-client.ts",
  ])(
    "allows console output in %s",
    async (file) => {
      const messages = await consoleMessagesFor(file);
      expect(messages).toHaveLength(0);
    },
    60_000
  );
});
