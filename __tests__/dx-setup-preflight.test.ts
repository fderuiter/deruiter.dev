// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import {
  SETUP_STAGE_IDS,
  SetupCancelledError,
  createNonInteractivePrompter,
  detectProductionTarget,
  parseDatabaseIdentity,
  parseShellStages,
  parseVerifyFlag,
  readSetupState,
  resolvePrismaDatabaseUrl,
  runSetupWorkflow,
  schemaCommandFor,
  type CommandRunner,
  type SetupOptions,
  type SetupPrompter,
} from "@/lib/dx/setup";
import { satisfiesVersionRange } from "@/lib/dx/preflight";

/**
 * Builds a credentialed connection string at run time, so the suite never
 * commits a credential-shaped literal for the history secret audit to flag.
 */
function connectionString(
  host: string,
  { user = "me", password = "pw", path: pathAndQuery = "/app" } = {}
): string {
  const url = new URL(`postgresql://${host}${pathAndQuery}`);
  url.username = user;
  url.password = password;
  return url.toString();
}

const LOCAL_URL = "postgresql://me:localpw@localhost:5433/devdb";
const HOSTED_URL = connectionString("ep-calm-1.eu.aws.neon.tech", {
  password: "hostedpw",
  path: "/appdev",
});
const PROD_URL = connectionString("prod-db.acme-corp.tech", {
  password: "prodpw",
});

function fakeRunner(failing: string[] = []) {
  const calls: string[] = [];
  const run: CommandRunner = async (command, args) => {
    const line = [command, ...args].join(" ");
    calls.push(line);
    const fails = failing.some((prefix) => line.startsWith(prefix));
    return {
      code: fails ? 1 : 0,
      stdout: line === "npm --version" ? "10.9.2\n" : "",
      stderr: fails ? `failed using ${HOSTED_URL}\n` : "",
    };
  };
  return { run, calls };
}

function answering(confirms: boolean[], typed: string[] = []): SetupPrompter {
  return {
    interactive: true,
    confirm: async () => confirms.shift() ?? false,
    input: async () => typed.shift() ?? "",
    secret: async () => "",
    choose: async (_question, _choices, fallback) => fallback,
  };
}

describe("setup preflight, database safety and recovery (#985)", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "dx-setup-preflight-"));
    fs.writeFileSync(path.join(dir, "package-lock.json"), "{}");
    fs.writeFileSync(
      path.join(dir, "package.json"),
      JSON.stringify({ engines: { node: ">=18.0.0" } })
    );
    fs.writeFileSync(
      path.join(dir, ".env.example"),
      'DATABASE_URL="postgresql://local_user:local_secret@localhost:5432/portfolio_dev"\nCRON_SECRET="dev_cron_secret_token"\n'
    );
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const withDatabase = (url: string) =>
    fs.writeFileSync(
      path.join(dir, ".env.local"),
      `DATABASE_URL="${url}"\nCRON_SECRET="a-real-secret-value-that-is-long-enough-123"\n`
    );

  const run = (options: SetupOptions) =>
    runSetupWorkflow({
      workspaceRoot: dir,
      skipIntegrations: true,
      processEnv: {},
      log: () => undefined,
      ...options,
    });

  describe("database identity", () => {
    it("redacts everything but host, port and database", () => {
      const identity = parseDatabaseIdentity(
        connectionString("db.acme.tech:6543", {
          user: "user",
          password: "hunter2",
          path: "/app?sslmode=require&password=x",
        })
      );
      expect(identity?.redacted).toBe("db.acme.tech:6543/app");
      expect(JSON.stringify(identity)).not.toContain("hunter2");
      expect(parseDatabaseIdentity("mysql://x")).toBeNull();
      expect(parseDatabaseIdentity(LOCAL_URL)?.local).toBe(true);
    });

    it("flags obvious production targets", () => {
      const context = { profileAllowsMutation: true };
      expect(
        detectProductionTarget(parseDatabaseIdentity(PROD_URL)!, context)
      ).toEqual(["the host name says production"]);
      expect(
        detectProductionTarget(parseDatabaseIdentity(HOSTED_URL)!, {
          ...context,
          vercelEnv: "production",
        })
      ).toEqual(["VERCEL_ENV is production"]);
      expect(
        detectProductionTarget(parseDatabaseIdentity(HOSTED_URL)!, {
          profileAllowsMutation: false,
        })
      ).toEqual(["the deployment profile never mutates a database"]);
      expect(
        detectProductionTarget(parseDatabaseIdentity(HOSTED_URL)!, context)
      ).toEqual([]);
    });

    it("uses db push only for local databases and committed migrations elsewhere", () => {
      expect(schemaCommandFor(parseDatabaseIdentity(LOCAL_URL)!)).toEqual([
        "prisma",
        "db",
        "push",
      ]);
      expect(schemaCommandFor(parseDatabaseIdentity(HOSTED_URL)!)).toEqual([
        "prisma",
        "migrate",
        "deploy",
      ]);
    });

    it("guards the URL Prisma actually uses, in prisma.config.ts order", () => {
      const file = {
        DATABASE_URL: "a",
        DATABASE_URL_UNPOOLED: "b",
        DIRECT_URL: "c",
      };
      expect(resolvePrismaDatabaseUrl(file, {})).toBe("c");
      expect(resolvePrismaDatabaseUrl({ DATABASE_URL: "a" }, {})).toBe("a");
      expect(resolvePrismaDatabaseUrl(file, { DIRECT_URL: "shell" })).toBe(
        "shell"
      );
      expect(
        resolvePrismaDatabaseUrl(file, { DISPOSABLE_DATABASE_URL: "d" })
      ).toBe("d");
      expect(
        resolvePrismaDatabaseUrl(
          { MIGRATION_REPLAY_URL: "ignored", DATABASE_URL: "a" },
          {}
        )
      ).toBe("a");
    });
  });

  describe("database stage", () => {
    it("asks separately before the schema and before seeding", async () => {
      withDatabase(LOCAL_URL);
      const { run: runner, calls } = fakeRunner();
      const result = await run({
        prompter: answering([true, false]),
        run: runner,
      });
      expect(calls).toEqual(["npx prisma generate", "npx prisma db push"]);
      expect(result.database?.schema.status).toBe("succeeded");
      expect(result.database?.seed).toEqual({
        status: "skipped",
        detail: "Not confirmed.",
        recovery: "npx prisma db seed",
      });
      expect(result.database?.target).toBe("localhost:5433/devdb");
    });

    it("applies committed migrations to a hosted database only with explicit opt-in when non-interactive", async () => {
      withDatabase(HOSTED_URL);
      const declined = fakeRunner();
      const quiet = await run({ run: declined.run, acceptDefaults: true });
      expect(declined.calls).toEqual(["npx prisma generate"]);
      expect(quiet.database?.schema.status).toBe("skipped");

      const opted = fakeRunner();
      const applied = await run({
        run: opted.run,
        applySchema: true,
        seed: true,
      });
      expect(opted.calls).toEqual([
        "npx prisma generate",
        "npx prisma migrate deploy",
        "npx prisma db seed",
      ]);
      expect(
        applied.stages.find((stage) => stage.id === "database")?.status
      ).toBe("completed");
    });

    it("lets --yes apply and seed a local database (its safe default)", async () => {
      withDatabase(LOCAL_URL);
      const { run: runner, calls } = fakeRunner();
      await run({ run: runner, acceptDefaults: true });
      expect(calls).toEqual([
        "npx prisma generate",
        "npx prisma db push",
        "npx prisma db seed",
      ]);
    });

    it("refuses schema and seed on a production target, even with opt-in flags", async () => {
      withDatabase(PROD_URL);
      const { run: runner, calls } = fakeRunner();
      const result = await run({ run: runner, applySchema: true, seed: true });
      expect(calls).toEqual(["npx prisma generate"]);
      expect(result.database?.productionTarget).toBe(true);
      expect(result.database?.schema.status).toBe("needs-manual-recovery");
      expect(result.database?.schema.recovery).toBe(
        "npm run setup -- --allow-production-db prod-db.acme-corp.tech"
      );
      expect(result.summary.manual).toContain("database");
      expect(JSON.stringify(result)).not.toContain("prodpw");
    });

    it("allows a production target only for the named host and a typed confirmation", async () => {
      withDatabase(PROD_URL);
      const wrongHost = fakeRunner();
      await run({
        run: wrongHost.run,
        applySchema: true,
        allowProductionDb: "other.host",
        prompter: answering([], ["prod-db.acme-corp.tech"]),
      });
      expect(wrongHost.calls).toEqual(["npx prisma generate"]);

      const notTyped = fakeRunner();
      await run({
        run: notTyped.run,
        applySchema: true,
        allowProductionDb: "prod-db.acme-corp.tech",
        prompter: answering([], ["yes"]),
      });
      expect(notTyped.calls).toEqual(["npx prisma generate"]);

      const confirmed = fakeRunner();
      await run({
        run: confirmed.run,
        applySchema: true,
        allowProductionDb: "prod-db.acme-corp.tech",
        prompter: answering([false], ["prod-db.acme-corp.tech"]),
      });
      expect(confirmed.calls).toContain("npx prisma migrate deploy");
    });

    it("never mutates a database under the deployment profile", async () => {
      withDatabase(HOSTED_URL);
      const { run: runner, calls } = fakeRunner();
      const result = await run({
        run: runner,
        profile: "deployment",
        applySchema: true,
      });
      expect(calls).toEqual(["npx prisma generate"]);
      expect(result.database?.productionReasons).toContain(
        "the deployment profile never mutates a database"
      );
    });

    it("refuses when Prisma would still use the example URL", async () => {
      const { run: runner, calls } = fakeRunner();
      const result = await run({ run: runner, applySchema: true });
      expect(calls).toEqual(["npx prisma generate"]);
      expect(result.database?.schema.status).toBe("needs-manual-recovery");
      expect(result.database?.schema.detail).toMatch(/example value/);
    });

    it("records a failed schema step with its recovery command and skips seeding", async () => {
      withDatabase(HOSTED_URL);
      const { run: runner } = fakeRunner(["npx prisma migrate"]);
      const result = await run({ run: runner, applySchema: true, seed: true });
      expect(result.database?.schema).toMatchObject({
        status: "failed",
        recovery: "npx prisma migrate deploy",
      });
      expect(result.database?.seed.status).toBe("skipped");
      expect(result.success).toBe(false);
      expect(result.summary.failed).toEqual(["database"]);
    });

    it("runs no command at all in a dry run", async () => {
      withDatabase(LOCAL_URL);
      const { run: runner, calls } = fakeRunner();
      await run({ run: runner, dryRun: true, applySchema: true, seed: true });
      expect(calls).toEqual([]);
    });
  });

  describe("stages, skips and resume", () => {
    it("reports every stage in order with shell stages first", async () => {
      withDatabase(LOCAL_URL);
      const { run: runner } = fakeRunner();
      const result = await run({
        run: runner,
        skipDb: true,
        shellStages: parseShellStages(
          "platform=completed=linux;toolchain=completed=ok;dependencies=skipped=symlink"
        ),
      });
      expect(result.stages.map((stage) => stage.id)).toEqual(SETUP_STAGE_IDS);
      expect(result.summary.skipped).toEqual([
        "dependencies",
        "integrations",
        "database",
        "verification",
      ]);
    });

    it("parses the shell hand-off defensively", () => {
      expect(
        parseShellStages(
          "platform=completed=a=b;bogus=completed;toolchain=weird"
        )
      ).toEqual([{ id: "platform", status: "completed", detail: "a=b" }]);
      expect(parseShellStages(undefined)).toEqual([]);
    });

    it("stops after a failed lockfile check", async () => {
      fs.writeFileSync(path.join(dir, "yarn.lock"), "");
      const result = await run({ skipDb: true });
      expect(result.success).toBe(false);
      expect(result.stages.map((stage) => stage.id)).toEqual([
        "toolchain",
        "lockfile",
      ]);
    });

    it("skips completed stages with --resume and remembers the profile", async () => {
      withDatabase(LOCAL_URL);
      const first = fakeRunner();
      await run({
        run: first.run,
        acceptDefaults: true,
        profile: "local-minimal",
      });
      const state = readSetupState(dir);
      expect(state.stages.database?.status).toBe("completed");
      expect(JSON.stringify(state)).not.toContain("localpw");

      const second = fakeRunner();
      const resumed = await run({ run: second.run, resume: true });
      expect(second.calls).toEqual([]);
      expect(resumed.profile).toBe("local-minimal");
      expect(
        resumed.stages.find((stage) => stage.id === "database")?.detail
      ).toMatch(/--resume/);
    });

    it("ignores a corrupt or tampered state file", async () => {
      fs.writeFileSync(
        path.join(dir, ".setup-state.json"),
        JSON.stringify({
          version: 1,
          profile: "bogus",
          stages: { database: { status: "completed" } },
        })
      );
      expect(readSetupState(dir).profile).toBeUndefined();
      fs.writeFileSync(path.join(dir, ".setup-state.json"), "{not json");
      expect(readSetupState(dir).stages).toEqual({});
      const result = await run({ resume: true, skipDb: true });
      expect(result.profile).toBe("local-minimal");
    });

    it("records a cancellation and keeps progress for --resume", async () => {
      withDatabase(LOCAL_URL);
      const cancelling: SetupPrompter = {
        ...createNonInteractivePrompter(),
        interactive: true,
        confirm: async () => {
          throw new SetupCancelledError();
        },
      };
      const result = await run({ run: fakeRunner().run, prompter: cancelling });
      expect(result.success).toBe(false);
      expect(result.stages.at(-1)).toMatchObject({
        id: "database",
        status: "cancelled",
      });
      expect(readSetupState(dir).stages.environment?.status).toBe("completed");
    });
  });

  describe("verification", () => {
    it("parses --verify", () => {
      expect(parseVerifyFlag(true).levels).toHaveLength(7);
      expect(parseVerifyFlag("db,static").levels).toEqual(["static", "db"]);
      expect(parseVerifyFlag("static,bogus").unknown).toEqual(["bogus"]);
      expect(parseVerifyFlag(undefined).levels).toEqual([]);
    });

    it("runs only the requested checks without a person, cheapest first, and reports the rest as not-checked", async () => {
      withDatabase(LOCAL_URL);
      const { run: runner, calls } = fakeRunner();
      const result = await run({
        run: runner,
        skipDb: true,
        verify: ["prisma", "static", "env"],
      });
      expect(calls).toEqual(["npm --version", "npx prisma validate"]);
      expect(
        result.verification.map((check) => [check.id, check.status])
      ).toEqual([
        ["static", "passed"],
        ["env", "schema-valid"],
        ["prisma", "passed"],
        ["db", "not-checked"],
        ["providers", "not-checked"],
        ["doctor", "not-checked"],
        ["quality", "not-checked"],
      ]);
    });

    it("never calls schema validation live verification", async () => {
      withDatabase(LOCAL_URL);
      const result = await run({
        run: fakeRunner().run,
        skipDb: true,
        verify: ["env"],
      });
      expect(result.verification[1].detail).toMatch(
        /no provider was contacted/
      );
    });

    it("redacts secrets from failing command output", async () => {
      withDatabase(HOSTED_URL);
      const { run: runner } = fakeRunner(["npx prisma migrate status"]);
      const result = await run({ run: runner, skipDb: true, verify: ["db"] });
      const db = result.verification.find((check) => check.id === "db");
      expect(db?.status).toBe("failed");
      expect(db?.detail).toContain("[redacted]");
      expect(JSON.stringify(result)).not.toContain("hostedpw");
      expect(result.summary.failed).toEqual(["verification"]);
    });

    it("offers checks one by one and stops at the first no", async () => {
      withDatabase(LOCAL_URL);
      const { run: runner, calls } = fakeRunner();
      const result = await run({
        run: runner,
        skipDb: true,
        prompter: answering([true, true, false]),
      });
      expect(calls).toEqual(["npm --version"]);
      expect(
        result.verification.filter((check) => check.status !== "not-checked")
      ).toHaveLength(2);
    });

    it("probes configured providers only, with the injected fetch", async () => {
      fs.writeFileSync(
        path.join(dir, ".env.local"),
        'GITHUB_TOKEN="gh-real-token"\nCRON_SECRET="a-real-secret-value-that-is-long-enough-123"\n'
      );
      const urls: string[] = [];
      const result = await run({
        run: fakeRunner().run,
        skipDb: true,
        verify: ["providers"],
        fetch: async (url) => {
          urls.push(url);
          return { ok: true, status: 200, text: async () => "" };
        },
      });
      expect(urls).toEqual(["https://api.github.com/rate_limit"]);
      const github = result.verification.find(
        (check) => check.id === "providers:github"
      );
      expect(github?.status).toBe("live-verified");
      const vercel = result.verification.find(
        (check) => check.id === "providers:vercel"
      );
      expect(vercel?.status).toBe("schema-valid");
    });
  });

  describe("version ranges", () => {
    it("evaluates engines ranges with upper bounds and alternatives", () => {
      expect(satisfiesVersionRange("v24.1.0", ">=22.0.0 <25.0.0")).toBe(true);
      expect(satisfiesVersionRange("v25.0.0", ">=22.0.0 <25.0.0")).toBe(false);
      expect(satisfiesVersionRange("21.9.9", ">=22.0.0 <25.0.0")).toBe(false);
      expect(satisfiesVersionRange("18.2.0", "^18 || >=20")).toBe(true);
      expect(satisfiesVersionRange("19.0.0", "^18 || >=20")).toBe(false);
      expect(satisfiesVersionRange("22.22.0", "22.x")).toBe(true);
      expect(satisfiesVersionRange("20.0.0", "=18 || >=20")).toBe(true);
      expect(satisfiesVersionRange("10.9.2", ">=10.0.0")).toBe(true);
    });
  });
});
