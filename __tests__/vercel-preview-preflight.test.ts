// @vitest-environment node
import { createRequire } from "module";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const {
  PRODUCTION_NEON_ENDPOINT,
  PRODUCTION_ONLY,
  checkVercelPreviewEnv,
  runVercelPreviewPreflight,
  shouldRunPreviewPreflight,
} = require("../scripts/vercel-preview-preflight.js");

type Env = Record<string, string | undefined>;
interface Problem {
  name: string;
  reason: string;
}

// Fake, deliberately short values: nothing here is shaped like a real
// credential that the secret scanners would have to allowlist.
function previewEnv(extra: Env = {}): Env {
  return {
    VERCEL: "1",
    VERCEL_ENV: "preview",
    NODE_OPTIONS: "--experimental-require-module",
    ...extra,
  };
}

function names(problems: Problem[]): string[] {
  return problems.map((problem) => problem.name);
}

function silentLogger() {
  return { log: vi.fn(), error: vi.fn() };
}

function loggedText(logger: ReturnType<typeof silentLogger>): string {
  return [...logger.log.mock.calls, ...logger.error.mock.calls]
    .flat()
    .join("\n");
}

describe("when the preview preflight runs", () => {
  it("runs only for Vercel preview builds", () => {
    expect(
      shouldRunPreviewPreflight({ VERCEL: "1", VERCEL_ENV: "preview" })
    ).toBe(true);
    expect(
      shouldRunPreviewPreflight({ VERCEL: "1", VERCEL_ENV: "production" })
    ).toBe(false);
    expect(shouldRunPreviewPreflight({ VERCEL_ENV: "preview" })).toBe(false);
    expect(shouldRunPreviewPreflight({})).toBe(false);
  });

  it("passes production, CI and local builds through untouched", () => {
    const logger = silentLogger();
    expect(
      runVercelPreviewPreflight(
        { VERCEL: "1", VERCEL_ENV: "production", RESEND_API_KEY: "re-fake" },
        logger
      )
    ).toBe(true);
    expect(runVercelPreviewPreflight({ CI: "true" }, logger)).toBe(true);
    expect(logger.log).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });
});

describe("a preview with no services", () => {
  it("passes and says it serves fallback content", () => {
    const logger = silentLogger();
    expect(runVercelPreviewPreflight(previewEnv(), logger)).toBe(true);
    const text = loggedText(logger);
    expect(text).toContain("Database: none");
    expect(text).toContain("Preview isolation preflight passed.");
  });

  it("passes with a development Clerk instance", () => {
    const { problems } = checkVercelPreviewEnv(
      previewEnv({
        CLERK_SECRET_KEY: "sk_test_fake",
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_fake",
      })
    );
    expect(problems).toEqual([]);
  });

  it("passes with a database on a non-production endpoint", () => {
    const { problems, summary } = checkVercelPreviewEnv(
      previewEnv({
        DATABASE_URL: "postgresql://app@ep-preview-fake-pooler.neon.test/db",
      })
    );
    expect(problems).toEqual([]);
    expect(summary.join(" ")).toContain("non-production Neon endpoint");
  });
});

describe("a preview that could reach production", () => {
  it("fails when any variable names the production Neon endpoint", () => {
    const { problems } = checkVercelPreviewEnv(
      previewEnv({
        DATABASE_URL: `postgresql://app@${PRODUCTION_NEON_ENDPOINT}-pooler.neon.test/db`,
        PGHOST: `${PRODUCTION_NEON_ENDPOINT}.neon.test`,
      })
    );
    expect(names(problems)).toEqual(["DATABASE_URL", "PGHOST"]);
  });

  it.each(PRODUCTION_ONLY as string[])("fails when %s is set", (name) => {
    const { problems } = checkVercelPreviewEnv(
      previewEnv({ [name]: "fake-value" })
    );
    expect(names(problems)).toContain(name);
  });

  it("fails on the production AWS integration variables", () => {
    const { problems } = checkVercelPreviewEnv(
      previewEnv({
        DSQL_AWS_ROLE_ARN: "arn:aws:iam::000000000000:role/fake",
        DYNAMODB_TABLE_NAME: "fake",
      })
    );
    expect(names(problems)).toEqual([
      "DSQL_AWS_ROLE_ARN",
      "DYNAMODB_TABLE_NAME",
    ]);
  });

  it("fails on Clerk production keys", () => {
    const { problems } = checkVercelPreviewEnv(
      previewEnv({
        CLERK_SECRET_KEY: "sk_live_fake",
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_fake",
      })
    );
    expect(names(problems)).toEqual([
      "CLERK_SECRET_KEY",
      "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
    ]);
  });

  it("ignores variables that are set but empty", () => {
    const { problems } = checkVercelPreviewEnv(
      previewEnv({ RESEND_API_KEY: "  ", CRON_SECRET: "" })
    );
    expect(problems).toEqual([]);
  });

  it("names the variable and never prints its value", () => {
    const secret = "re-fake-SHOULD-NOT-APPEAR";
    const logger = silentLogger();
    expect(
      runVercelPreviewPreflight(
        previewEnv({
          RESEND_API_KEY: secret,
          // Assembled from parts so the secret scanner sees no URL with a password.
          DATABASE_URL: [
            "postgresql://owner",
            ":pw-SHOULD-NOT-APPEAR",
            `@${PRODUCTION_NEON_ENDPOINT}.neon.test/db`,
          ].join(""),
        }),
        logger
      )
    ).toBe(false);
    const text = loggedText(logger);
    expect(text).toContain("RESEND_API_KEY");
    expect(text).toContain("DATABASE_URL");
    expect(text).not.toContain("SHOULD-NOT-APPEAR");
  });
});

describe("the recorded production endpoint", () => {
  it("matches the Neon capacity inventory", () => {
    const inventory = readFileSync(
      path.resolve(process.cwd(), "docs/reference/neon-capacity-inventory.md"),
      "utf8"
    );
    expect(inventory).toContain(PRODUCTION_NEON_ENDPOINT);
  });
});

describe("scripts/build.js", () => {
  it("runs the preview preflight before it substitutes offline values", () => {
    const source = readFileSync(
      path.resolve(process.cwd(), "scripts/build.js"),
      "utf8"
    );
    const preflight = source.indexOf("runVercelPreviewPreflight(process.env)");
    const dummy = source.indexOf("Using a dummy");
    expect(preflight).toBeGreaterThan(-1);
    expect(preflight).toBeLessThan(dummy);
  });
});
