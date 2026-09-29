/* eslint-disable */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import child_process from "child_process";

// Everything the production preflight (scripts/vercel-production-preflight.js)
// requires, with fake values, so production-path tests reach the steps they
// exercise. The preflight's own cases live in vercel-production-preflight.test.ts.
function setProductionConfig() {
  process.env.VERCEL = "1";
  process.env.VERCEL_ENV = "production";
  process.env.VERCEL_TOKEN = "tok-fake-vercel";
  process.env.DATABASE_URL = "postgresql://pooled.neon.test/db";
  process.env.DATABASE_URL_UNPOOLED = "postgresql://unpooled.neon.test/db";
  process.env.CRON_SECRET = "cron-fake";
  process.env.UPSTASH_REDIS_REST_URL = "https://cache.upstash.test";
  process.env.UPSTASH_REDIS_REST_TOKEN = "tok-fake";
  process.env.NODE_OPTIONS = "--experimental-require-module";
}

describe("build.js script execution", () => {
  let originalEnv: NodeJS.ProcessEnv;
  let exitMock: any;
  let spawnSpy: any;
  let execFileSpy: any;

  beforeEach(() => {
    // Clear require cache for scripts/build.js so it executes on each require call
    delete require.cache[require.resolve("../scripts/build.js")];

    originalEnv = { ...process.env };
    exitMock = vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new Error(`Process exited with code ${code}`);
    });
    spawnSpy = vi
      .spyOn(child_process, "spawnSync")
      .mockImplementation(() => ({ status: 0 }) as any);
    execFileSpy = vi
      .spyOn(child_process, "execFileSync")
      .mockImplementation((_prog: any, args: any) => {
        if (
          args &&
          Array.isArray(args) &&
          args.includes("scripts/vercel-headroom.ts")
        ) {
          return JSON.stringify({
            hasCriticalAlerts: false,
            meters: {
              functionsStorage: {
                resource: "Functions Storage",
                used: 2.0,
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
        }
        return "" as any;
      });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ result: "PONG" }),
      }))
    );
  });

  afterEach(() => {
    process.env = originalEnv;
    exitMock.mockRestore();
    spawnSpy.mockRestore();
    execFileSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it("runs generate, check:migrations, and next build offline without prisma migrate deploy", async () => {
    process.env.VERCEL_ENV = "preview";
    process.env.DATABASE_URL = "postgresql://db:5432";

    await expect(require("../scripts/build.js")).rejects.toThrow(
      "Process exited with code 0"
    );

    // It should have called prisma generate, check:migrations, and next build
    expect(spawnSpy).toHaveBeenCalledWith(
      "npx",
      ["prisma", "generate"],
      expect.any(Object)
    );
    expect(spawnSpy).toHaveBeenCalledWith(
      "npm",
      ["run", "check:migrations"],
      expect.any(Object)
    );
    expect(spawnSpy).toHaveBeenCalledWith(
      "npx",
      ["next", "build", "--webpack"],
      expect.any(Object)
    );

    // It MUST NOT execute live migration deploy
    expect(spawnSpy).not.toHaveBeenCalledWith(
      "npx",
      ["prisma", "migrate", "deploy"],
      expect.any(Object)
    );

    // It should exit with 0
    expect(exitMock).toHaveBeenCalledWith(0);
  });

  it("never executes prisma migrate deploy off Vercel, even if VERCEL_ENV is production", async () => {
    delete (process.env as any).VERCEL;
    process.env.VERCEL_ENV = "production";
    process.env.DATABASE_URL = "postgresql://db:5432";

    await expect(require("../scripts/build.js")).rejects.toThrow(
      "Process exited with code 0"
    );

    // It should have called prisma generate, generate-openapi, check:migrations, and then next build
    expect(spawnSpy).toHaveBeenCalledWith(
      "npx",
      ["prisma", "generate"],
      expect.any(Object)
    );
    expect(spawnSpy).toHaveBeenCalledWith(
      "npx",
      ["tsx", "scripts/generate-openapi.ts"],
      expect.any(Object)
    );
    expect(spawnSpy).toHaveBeenCalledWith(
      "npm",
      ["run", "check:migrations"],
      expect.any(Object)
    );
    expect(spawnSpy).toHaveBeenCalledWith(
      "npx",
      ["next", "build", "--webpack"],
      expect.any(Object)
    );

    // It MUST NOT execute live migration deploy in static compilation
    expect(spawnSpy).not.toHaveBeenCalledWith(
      "npx",
      ["prisma", "migrate", "deploy"],
      expect.any(Object)
    );

    // Verify ordering: check:migrations happens BEFORE next build
    const calls = spawnSpy.mock.calls.map(
      (c: any[]) => `${c[0]} ${c[1].join(" ")}`
    );
    const checkMigrationsIndex = calls.findIndex((c: string) =>
      c.includes("check:migrations")
    );
    const nextBuildIndex = calls.findIndex((c: string) =>
      c.includes("next build")
    );

    expect(checkMigrationsIndex).toBeGreaterThan(-1);
    expect(nextBuildIndex).toBeGreaterThan(checkMigrationsIndex);

    // It should exit with 0
    expect(exitMock).toHaveBeenCalledWith(0);
  });

  it("applies migrations on Vercel production builds, through the unpooled endpoint, before next build", async () => {
    setProductionConfig();

    await expect(require("../scripts/build.js")).rejects.toThrow(
      "Process exited with code 0"
    );

    const calls = spawnSpy.mock.calls.map(
      (c: any[]) => `${c[0]} ${c[1].join(" ")}`
    );
    const migrateIndex = calls.indexOf("npx prisma migrate deploy");
    expect(migrateIndex).toBeGreaterThan(
      calls.indexOf("npm run check:migrations")
    );
    expect(calls.indexOf("npx next build --webpack")).toBeGreaterThan(
      migrateIndex
    );
    expect(spawnSpy.mock.calls[migrateIndex][2].env.DIRECT_URL).toBe(
      "postgresql://unpooled.neon.test/db"
    );
    expect(exitMock).toHaveBeenCalledWith(0);
  });

  it("does not migrate from a Vercel preview build", async () => {
    process.env.VERCEL = "1";
    process.env.VERCEL_ENV = "preview";
    process.env.DATABASE_URL_UNPOOLED = "postgresql://unpooled.example/db";

    await expect(require("../scripts/build.js")).rejects.toThrow(
      "Process exited with code 0"
    );

    expect(spawnSpy).not.toHaveBeenCalledWith(
      "npx",
      ["prisma", "migrate", "deploy"],
      expect.any(Object)
    );
  });

  it("stops a Vercel production build whose configuration fails the preflight before any step runs", async () => {
    setProductionConfig();
    delete (process.env as any).CRON_SECRET;
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await expect(require("../scripts/build.js")).rejects.toThrow(
      "Process exited with code 1"
    );

    expect(exitMock).toHaveBeenCalledWith(1);
    // Nothing ran: no client generation, no migration, no compile, and the
    // offline dummy CRON_SECRET was never substituted for the missing one.
    expect(spawnSpy).not.toHaveBeenCalled();
    expect(process.env.CRON_SECRET).toBeUndefined();
    expect(errorSpy.mock.calls.flat().join("\n")).toContain(
      "CRON_SECRET is not set"
    );
    errorSpy.mockRestore();
    logSpy.mockRestore();
  });

  it("fails a Vercel production build that has no unpooled endpoint", async () => {
    setProductionConfig();
    delete (process.env as any).DATABASE_URL_UNPOOLED;
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(require("../scripts/build.js")).rejects.toThrow(
      "Process exited with code 1"
    );

    expect(exitMock).toHaveBeenCalledWith(1);
    expect(spawnSpy).not.toHaveBeenCalledWith(
      "npx",
      ["next", "build", "--webpack"],
      expect.any(Object)
    );
    errorSpy.mockRestore();
  });

  it("sets dummy DATABASE_URL and DIRECT_URL if none are provided", async () => {
    process.env.VERCEL_ENV = "preview";
    delete (process.env as any).DATABASE_URL;
    delete (process.env as any).DIRECT_URL;

    await expect(require("../scripts/build.js")).rejects.toThrow(
      "Process exited with code 0"
    );

    expect(process.env.DATABASE_URL).toBe(
      "postgresql://dummy:dummy@localhost:5432/dummy"
    );
    expect(process.env.DIRECT_URL).toBe(
      "postgresql://dummy:dummy@localhost:5432/dummy"
    );

    // Guard against credential leakage. scripts/build.js loads .env.local so a
    // local production build reaches the real database (issue #859), but it must
    // never do so under test: this assertion would otherwise print a live
    // connection string into the failure output.
    expect(process.env.DATABASE_URL).not.toContain("neon.tech");
    expect(process.env.DATABASE_URL).toContain("dummy");
  });

  it("fails immediately if a build step fails", async () => {
    process.env.VERCEL_ENV = "preview";

    // Mock spawnSync to fail on prisma generate (the first call)
    spawnSpy.mockImplementationOnce(() => ({ status: 123 }) as any);

    await expect(require("../scripts/build.js")).rejects.toThrow(
      "Process exited with code 123"
    );

    // It should have tried prisma generate
    expect(spawnSpy).toHaveBeenCalledWith(
      "npx",
      ["prisma", "generate"],
      expect.any(Object)
    );

    // It should NOT have tried next build
    expect(spawnSpy).not.toHaveBeenCalledWith(
      "npx",
      ["next", "build"],
      expect.any(Object)
    );

    // It should exit with the failed code (123)
    expect(exitMock).toHaveBeenCalledWith(123);
  });

  it("stops before migration and redacts a rejected Upstash token", async () => {
    setProductionConfig();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 401 }))
    );

    await expect(require("../scripts/build.js")).rejects.toThrow(
      "Process exited with code 1"
    );

    expect(exitMock).toHaveBeenCalledWith(1);
    expect(spawnSpy).not.toHaveBeenCalled();
    const output = errorSpy.mock.calls.flat().join("\n");
    expect(output).toContain("UPSTASH_REDIS_REST_TOKEN was rejected");
    expect(output).not.toContain("tok-fake");
    errorSpy.mockRestore();
  });
});
