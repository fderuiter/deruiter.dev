import { createRequire } from "module";
import { afterEach, describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const {
  CANONICAL_URL,
  checkVercelProductionEnv,
  runVercelProductionPreflight,
  shouldRunPreflight,
  verifyUpstashCredentials,
  verifyVercelHeadroomCapacity,
} = require("../scripts/vercel-production-preflight.js");

type Env = Record<string, string | undefined>;
interface Problem {
  name: string;
  reason: string;
}

// Fake, deliberately short values: nothing here is, or is shaped like, a real
// credential that the secret scanners would have to allowlist.
function validProductionEnv(): Env {
  return {
    VERCEL: "1",
    VERCEL_ENV: "production",
    DATABASE_URL: "postgresql://app@pooled.neon.test/portfolio",
    DATABASE_URL_UNPOOLED: "postgresql://app@direct.neon.test/portfolio",
    CRON_SECRET: "cron-fake-7Q2",
    UPSTASH_REDIS_REST_URL: "https://cache.upstash.test",
    UPSTASH_REDIS_REST_TOKEN: "tok-fake-9Z",
    NODE_OPTIONS: "--experimental-require-module",
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

afterEach(() => {
  vi.restoreAllMocks();
});

describe("when the preflight runs", () => {
  it("runs only for Vercel production builds", () => {
    expect(shouldRunPreflight({ VERCEL: "1", VERCEL_ENV: "production" })).toBe(
      true
    );
  });

  it.each([
    ["a local build", {}],
    ["a local build with VERCEL_ENV=production", { VERCEL_ENV: "production" }],
    ["CI", { CI: "true", GITHUB_ACTIONS: "true" }],
    ["a Vercel preview build", { VERCEL: "1", VERCEL_ENV: "preview" }],
    ["a Vercel development build", { VERCEL: "1", VERCEL_ENV: "development" }],
  ])("skips %s without logging, even with nothing configured", (_, env) => {
    const logger = silentLogger();
    expect(runVercelProductionPreflight(env, logger)).toBe(true);
    expect(logger.log).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });
});

describe("required configuration", () => {
  it("passes a valid Vercel production configuration", () => {
    const logger = silentLogger();
    expect(checkVercelProductionEnv(validProductionEnv()).problems).toEqual([]);
    expect(runVercelProductionPreflight(validProductionEnv(), logger)).toBe(
      true
    );
    expect(logger.error).not.toHaveBeenCalled();
  });

  it.each([
    "DATABASE_URL",
    "DATABASE_URL_UNPOOLED",
    "CRON_SECRET",
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
    "NODE_OPTIONS",
  ])("fails when %s is missing or blank", (name) => {
    const missing = { ...validProductionEnv(), [name]: undefined };
    const blank = { ...validProductionEnv(), [name]: "  " };
    expect(names(checkVercelProductionEnv(missing).problems)).toEqual([name]);
    expect(names(checkVercelProductionEnv(blank).problems)).toEqual([name]);
  });

  it("reports every missing variable at once and fails the run", () => {
    const logger = silentLogger();
    const env = { VERCEL: "1", VERCEL_ENV: "production" };
    expect(runVercelProductionPreflight(env, logger)).toBe(false);
    const output = loggedText(logger);
    for (const name of [
      "DATABASE_URL_UNPOOLED",
      "CRON_SECRET",
      "NODE_OPTIONS",
    ]) {
      expect(output).toContain(`${name} is not set`);
    }
    expect(output).toContain("docs/how-to/release-and-deploy.md");
  });

  it("requires the server-rendering flag in NODE_OPTIONS (#995)", () => {
    const env = {
      ...validProductionEnv(),
      NODE_OPTIONS: "--max-old-space-size=4096",
    };
    expect(names(checkVercelProductionEnv(env).problems)).toEqual([
      "NODE_OPTIONS",
    ]);
    const combined = {
      ...validProductionEnv(),
      NODE_OPTIONS: "--max-old-space-size=4096 --experimental-require-module",
    };
    expect(checkVercelProductionEnv(combined).problems).toEqual([]);
  });
});

describe("unsafe values", () => {
  it.each([
    ["DATABASE_URL", "postgresql://app@localhost:5432/portfolio"],
    ["DATABASE_URL_UNPOOLED", "postgresql://app@127.0.0.1/portfolio"],
    ["DATABASE_URL", "mysql://app@db.neon.test/portfolio"],
    ["DATABASE_URL", "not a url"],
    ["UPSTASH_REDIS_REST_URL", "http://cache.upstash.test"],
    ["UPSTASH_REDIS_REST_URL", "https://localhost:8079"],
  ])("rejects %s = %s", (name, value) => {
    const env = { ...validProductionEnv(), [name]: value };
    expect(names(checkVercelProductionEnv(env).problems)).toContain(name);
  });

  it.each([
    ["CRON_SECRET", "dummy-secret-for-compilation"],
    ["CRON_SECRET", "dev_cron_secret_token"],
    ["UPSTASH_REDIS_REST_TOKEN", "example_dev_token"],
    ["DATABASE_URL", "postgresql://local_user@db.neon.test/portfolio_dev"],
    ["RESEND_API_KEY", "re_placeholder"],
  ])("rejects the placeholder %s = %s", (name, value) => {
    const env = { ...validProductionEnv(), [name]: value };
    const problem = checkVercelProductionEnv(env).problems.find(
      (p: Problem) => p.name === name
    );
    expect(problem?.reason).toMatch(/placeholder/);
  });

  it("rejects Clerk development keys", () => {
    const env = {
      ...validProductionEnv(),
      CLERK_SECRET_KEY: "sk_test_fake",
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_fake",
    };
    expect(names(checkVercelProductionEnv(env).problems).sort()).toEqual([
      "CLERK_SECRET_KEY",
      "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
    ]);
  });

  it("accepts NEXT_PUBLIC_APP_URL only as the canonical domain", () => {
    const check = (value: string) =>
      names(
        checkVercelProductionEnv({
          ...validProductionEnv(),
          NEXT_PUBLIC_APP_URL: value,
        }).problems
      );
    expect(check("https://deruiter.dev")).toEqual([]);
    expect(check("https://deruiter.dev/")).toEqual([]);
    expect(check("https://www.deruiter.dev")).toEqual(["NEXT_PUBLIC_APP_URL"]);
    expect(check("https://portfolio.vercel.app")).toEqual([
      "NEXT_PUBLIC_APP_URL",
    ]);
    expect(check("http://localhost:3000")).toEqual(["NEXT_PUBLIC_APP_URL"]);
  });

  it("uses the same canonical URL as resolveBaseUrl", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    const { resolveBaseUrl } = await import("@/lib/domain");
    expect(resolveBaseUrl()).toBe(CANONICAL_URL);
    vi.unstubAllEnvs();
  });
});

describe("optional integrations", () => {
  it("notes, without failing, each unset optional integration", () => {
    const { problems, notes } = checkVercelProductionEnv(validProductionEnv());
    expect(problems).toEqual([]);
    expect(names(notes).sort()).toEqual([
      "BLOB_READ_WRITE_TOKEN",
      "NEXT_PUBLIC_SENTRY_DSN",
      "RESEND_API_KEY",
      "RESEND_WEBHOOK_SECRET",
    ]);
  });

  it("drops the note once an optional integration is configured", () => {
    const env = { ...validProductionEnv(), RESEND_API_KEY: "re_fake" };
    expect(names(checkVercelProductionEnv(env).notes)).not.toContain(
      "RESEND_API_KEY"
    );
  });

  it("requires both Clerk keys once the admin area is configured", () => {
    const env = {
      ...validProductionEnv(),
      ADMIN_EMAILS: "owner@deruiter.test",
    };
    expect(names(checkVercelProductionEnv(env).problems).sort()).toEqual([
      "CLERK_SECRET_KEY",
      "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
    ]);
    const complete = {
      ...env,
      CLERK_SECRET_KEY: "sk_live_fake",
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_fake",
    };
    expect(checkVercelProductionEnv(complete).problems).toEqual([]);
  });

  it("requires the rest of the Sentry upload trio once any of it is set", () => {
    const env = { ...validProductionEnv(), SENTRY_ORG: "deruiter" };
    expect(names(checkVercelProductionEnv(env).problems).sort()).toEqual([
      "SENTRY_AUTH_TOKEN",
      "SENTRY_PROJECT",
    ]);
  });
});

describe("secret redaction", () => {
  // Every value is distinctive, so any echo of one is visible in the output.
  const sentinels: Env = {
    VERCEL: "1",
    VERCEL_ENV: "production",
    DATABASE_URL: "postgresql://sentinelUserA@localhost/sentinelDbA",
    DATABASE_URL_UNPOOLED: "sentinel-not-a-url-B",
    CRON_SECRET: "dummy-sentinel-C",
    UPSTASH_REDIS_REST_URL: "http://sentinel-host-D.test",
    UPSTASH_REDIS_REST_TOKEN: "example-sentinel-E",
    NODE_OPTIONS: "--sentinel-flag-F",
    CLERK_SECRET_KEY: "sk_test_sentG",
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_sentinelH",
    SENTRY_AUTH_TOKEN: "sentinel-token-I",
    RESEND_API_KEY: "placeholder-sentinel-J",
    NEXT_PUBLIC_APP_URL: "https://sentinel-K.test",
  };

  it("never prints a value, on success or on failure", () => {
    const failing = silentLogger();
    expect(runVercelProductionPreflight(sentinels, failing)).toBe(false);

    const passing = silentLogger();
    const valid = validProductionEnv();
    expect(runVercelProductionPreflight(valid, passing)).toBe(true);

    const output = `${loggedText(failing)}\n${loggedText(passing)}`;
    // The valid NODE_OPTIONS is the flag the remediation message names, so it
    // is the one value allowed to appear; the sentinel NODE_OPTIONS is not.
    const { NODE_OPTIONS: _flag, ...validSecrets } = valid;
    const values = [
      ...Object.entries(sentinels),
      ...Object.entries(validSecrets),
    ]
      .filter(([name]) => name !== "VERCEL" && name !== "VERCEL_ENV")
      .map(([, value]) => value as string);
    for (const value of values) {
      expect(output).not.toContain(value);
    }
    // The distinctive fragments of each value must not leak either.
    expect(output).not.toMatch(/sentinel/i);
  });

  it("returns reasons that name the variable, not its value", () => {
    const { problems, notes } = checkVercelProductionEnv(sentinels);
    const serialized = JSON.stringify([...problems, ...notes]);
    expect(serialized).not.toMatch(/sentinel/i);
    expect(problems.length).toBeGreaterThan(0);
  });
});

describe("Upstash production authentication", () => {
  it("accepts credentials only after Upstash returns PONG", async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () =>
        new Response(JSON.stringify({ result: "PONG" }), { status: 200 })
    );

    await expect(
      verifyUpstashCredentials(validProductionEnv(), fetchImpl)
    ).resolves.toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledWith(
      new URL("https://cache.upstash.test/ping"),
      expect.objectContaining({
        method: "GET",
        headers: { Authorization: "Bearer tok-fake-9Z" },
      })
    );
  });

  it("names a rejected token without returning or logging its value", async () => {
    const secret = "fake-upstash-token-7Q2";
    const fetchImpl = vi.fn<typeof fetch>(
      async () => new Response("Unauthorized", { status: 401 })
    );

    const result = await verifyUpstashCredentials(
      { ...validProductionEnv(), UPSTASH_REDIS_REST_TOKEN: secret },
      fetchImpl
    );

    expect(result).toEqual({
      ok: false,
      name: "UPSTASH_REDIS_REST_TOKEN",
      reason: "was rejected by Upstash",
    });
    expect(JSON.stringify(result)).not.toContain(secret);
  });

  it("names a REST URL failure and redacts fetch errors", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new Error("fake-upstash-token-7Q2");
    });

    const result = await verifyUpstashCredentials(
      validProductionEnv(),
      fetchImpl
    );

    expect(result).toEqual({
      ok: false,
      name: "UPSTASH_REDIS_REST_URL",
      reason: "could not complete a PING within 3 seconds",
    });
    expect(JSON.stringify(result)).not.toContain("fake-upstash-token-7Q2");
  });
});

describe("Vercel Headroom Capacity Preflight Check", () => {
  const healthyJson = JSON.stringify({
    hasCriticalAlerts: false,
    meters: {
      functionsStorage: {
        resource: "Functions Storage",
        used: 2.5,
        limit: 10.0,
        unit: "GB",
        severity: "healthy",
        isStale: false,
        isUnreadable: false,
      },
      deploymentStorage: {
        resource: "Deployment Storage",
        used: 1.0,
        limit: 10.0,
        unit: "GB",
        severity: "healthy",
        isStale: false,
        isUnreadable: false,
      },
      buildTime: {
        resource: "Build Time",
        used: 10.0,
        limit: 100.0,
        unit: "hours",
        severity: "healthy",
        isStale: false,
        isUnreadable: false,
      },
    },
  });

  it("returns true when headroom capacity check passes (healthy outcome)", async () => {
    const logger = silentLogger();
    const env = { ...validProductionEnv(), VERCEL_TOKEN: "valid_token" };
    const mockExec = vi.fn().mockReturnValue(healthyJson);
    const result = await verifyVercelHeadroomCapacity(env, logger, mockExec);
    expect(result).toBe(true);
    expect(logger.error).not.toHaveBeenCalled();
    expect(mockExec).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining([
        "scripts/vercel-headroom.ts",
        "--strict",
        "--json",
      ]),
      expect.any(Object)
    );
  });

  it("returns false and logs error when critical threshold is breached (critical outcome)", async () => {
    const logger = silentLogger();
    const env = { ...validProductionEnv(), VERCEL_TOKEN: "valid_token" };
    const criticalJson = JSON.stringify({
      hasCriticalAlerts: true,
      meters: {
        functionsStorage: {
          resource: "Functions Storage",
          used: 9.8,
          limit: 10.0,
          unit: "GB",
          severity: "critical",
          isStale: false,
          isUnreadable: false,
        },
      },
    });
    const mockExec = vi.fn().mockImplementation(() => {
      const err = new Error("Command failed") as Error & { stdout?: string };
      err.stdout = criticalJson;
      throw err;
    });
    const result = await verifyVercelHeadroomCapacity(env, logger, mockExec);
    expect(result).toBe(false);
    expect(loggedText(logger)).toContain(
      "Critical Vercel storage or build time headroom threshold breached"
    );
  });

  it("returns false and logs error when capacity check fails to load or execute (load-failure outcome)", async () => {
    const logger = silentLogger();
    const env = { ...validProductionEnv(), VERCEL_TOKEN: "valid_token" };
    const mockExec = vi.fn().mockImplementation(() => {
      throw new Error("MODULE_NOT_FOUND");
    });
    const result = await verifyVercelHeadroomCapacity(env, logger, mockExec);
    expect(result).toBe(false);
    expect(loggedText(logger)).toContain(
      "Vercel headroom check failed to execute"
    );
    expect(loggedText(logger)).toContain("MODULE_NOT_FOUND");
  });

  it("returns false and logs error when capacity measurement is unreadable (unavailable outcome)", async () => {
    const logger = silentLogger();
    const env = { ...validProductionEnv(), VERCEL_TOKEN: "valid_token" };
    const unreadableJson = JSON.stringify({
      hasCriticalAlerts: false,
      meters: {
        functionsStorage: {
          resource: "Functions Storage",
          used: null,
          limit: 10.0,
          unit: "GB",
          severity: "unreadable",
          isStale: false,
          isUnreadable: true,
        },
      },
    });
    const mockExec = vi.fn().mockReturnValue(unreadableJson);
    const result = await verifyVercelHeadroomCapacity(env, logger, mockExec);
    expect(result).toBe(false);
    expect(loggedText(logger)).toContain(
      "Critical Vercel storage or build time headroom threshold breached (>=95%) or meters are stale/unreadable"
    );
  });

  it("returns false and logs error when returned meter is stale", async () => {
    const logger = silentLogger();
    const env = { ...validProductionEnv(), VERCEL_TOKEN: "valid_token" };
    const staleJson = JSON.stringify({
      hasCriticalAlerts: false,
      meters: {
        functionsStorage: {
          resource: "Functions Storage",
          used: 2.0,
          limit: 10.0,
          unit: "GB",
          severity: "stale",
          isStale: true,
          isUnreadable: false,
        },
      },
    });
    const mockExec = vi.fn().mockReturnValue(staleJson);
    const result = await verifyVercelHeadroomCapacity(env, logger, mockExec);
    expect(result).toBe(false);
    expect(loggedText(logger)).toContain("stale/unreadable");
  });

  it("returns false in production when VERCEL_TOKEN is not set and check cannot run", async () => {
    const logger = silentLogger();
    const env: Env = { VERCEL: "1", VERCEL_ENV: "production" };
    delete env.VERCEL_TOKEN;
    const result = await verifyVercelHeadroomCapacity(env, logger);
    expect(result).toBe(false);
    expect(loggedText(logger)).toContain("VERCEL_TOKEN is not set");
  });

  it("executes headroom script via actual process boundary and fails when snapshot inventory has critical meter", async () => {
    const logger = silentLogger();
    const env: Env = {
      ...validProductionEnv(),
      VERCEL_TOKEN: "test_token_123",
    };
    const result = await verifyVercelHeadroomCapacity(env, logger);
    expect(result).toBe(false);
    expect(loggedText(logger)).toContain(
      "Critical Vercel storage or build time headroom threshold breached"
    );
  });
});
