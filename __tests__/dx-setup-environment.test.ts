// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import {
  ENV_KEY_CLASSIFICATION,
  PLACEHOLDER_MARKERS,
  SETUP_PROFILES,
  classifyEnvKey,
  createNonInteractivePrompter,
  deriveUnpooledUrl,
  evaluateProfileReadiness,
  formatEnvAssignment,
  generateCronSecret,
  isPlaceholderValue,
  parseEnvValues,
  redactSecrets,
  runSetupWorkflow,
  upsertEnvContent,
  writeFileAtomic,
  type AtomicWriteIo,
  type SetupPrompter,
} from "@/lib/dx/setup";
import { getDeclaredEnvKeys } from "@/lib/dx/env-guard";

const ROOT = process.cwd();

/** A prompter that answers from fixed queues and records every question. */
function scriptedPrompter(answers: {
  confirm?: boolean[];
  input?: string[];
  secret?: string[];
  choose?: string[];
}) {
  const asked: { kind: string; question: string }[] = [];
  const prompter: SetupPrompter = {
    interactive: true,
    async confirm(question) {
      asked.push({ kind: "confirm", question });
      return answers.confirm?.shift() ?? false;
    },
    async input(question) {
      asked.push({ kind: "input", question });
      return answers.input?.shift() ?? "";
    },
    async secret(question) {
      asked.push({ kind: "secret", question });
      return answers.secret?.shift() ?? "";
    },
    async choose(question, _choices, fallback) {
      asked.push({ kind: "choose", question });
      return (answers.choose?.shift() as typeof fallback) ?? fallback;
    },
  };
  return { prompter, asked };
}

const TEMPLATE = [
  "# Database",
  'DATABASE_URL="postgresql://local_user:local_secret@localhost:5432/portfolio_dev"',
  'DATABASE_URL_UNPOOLED="postgresql://local_user:local_secret@localhost:5432/portfolio_dev"',
  'DIRECT_URL="postgresql://local_user:local_secret@localhost:5432/portfolio_dev"',
  'CRON_SECRET="dev_cron_secret_token"',
  'GITHUB_TOKEN=""',
  "",
].join("\n");

describe("setup environment stage (#983)", () => {
  let dir: string;
  const quiet = () => undefined;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "dx-setup-env-"));
    fs.writeFileSync(path.join(dir, "package-lock.json"), "{}");
    fs.writeFileSync(
      path.join(dir, "package.json"),
      JSON.stringify({ engines: { node: ">=18.0.0" } })
    );
    fs.writeFileSync(path.join(dir, ".env.example"), TEMPLATE);
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const run = (options: Partial<Parameters<typeof runSetupWorkflow>[0]> = {}) =>
    runSetupWorkflow({
      workspaceRoot: dir,
      skipDb: true,
      skipIntegrations: true,
      log: quiet,
      run: async () => ({ code: 0, stdout: "", stderr: "" }),
      ...options,
    });

  describe("key classification", () => {
    it("classifies every key in the repository's .env.example explicitly", () => {
      const template = parseEnvValues(
        fs.readFileSync(path.join(ROOT, ".env.example"), "utf-8")
      );
      const unclassified = Object.keys(template).filter(
        (key) => !(key in ENV_KEY_CLASSIFICATION)
      );
      expect(unclassified).toEqual([]);
    });

    it("classifies every key the lib/env.ts schema declares except the runtime-set ones", () => {
      const { allKeys } = getDeclaredEnvKeys();
      const missing = allKeys.filter(
        (key) =>
          !(key in ENV_KEY_CLASSIFICATION) &&
          !["NODE_ENV", "VERCEL_ENV"].includes(key)
      );
      expect(missing).toEqual([]);
    });

    it("treats unknown credential-looking keys as secrets", () => {
      expect(classifyEnvKey("NEW_SERVICE_API_KEY").secret).toBe(true);
      expect(classifyEnvKey("NEW_SERVICE_TOKEN").secret).toBe(true);
      expect(classifyEnvKey("NEXT_PUBLIC_NEW_FLAG").kind).toBe("public");
      expect(classifyEnvKey("FEATURE_COLOUR").secret).toBe(false);
    });

    it("keeps placeholder markers in step with the production preflight", () => {
      const preflight = fs.readFileSync(
        path.join(ROOT, "scripts", "vercel-production-preflight.js"),
        "utf-8"
      );
      const block = preflight.match(
        /const PLACEHOLDER_MARKERS = \[([\s\S]*?)\];/
      );
      const jsMarkers = [...(block?.[1] ?? "").matchAll(/"([^"]+)"/g)].map(
        (match) => match[1]
      );
      expect(jsMarkers.length).toBeGreaterThan(0);
      expect([...PLACEHOLDER_MARKERS].sort()).toEqual(jsMarkers.sort());
    });
  });

  describe("placeholder detection", () => {
    it("treats empty values, template values and marker values as placeholders", () => {
      expect(isPlaceholderValue(undefined)).toBe(true);
      expect(isPlaceholderValue("  ")).toBe(true);
      expect(isPlaceholderValue("sk_test_example_secret_key")).toBe(true);
      expect(isPlaceholderValue("dev_cron_secret_token")).toBe(true);
      expect(isPlaceholderValue("same", "same")).toBe(true);
      expect(isPlaceholderValue("postgresql://me:pw@db.neon.tech/app")).toBe(
        false
      );
    });
  });

  describe("upserts", () => {
    it("replaces a key in place and keeps comments and unrelated values byte for byte", () => {
      const before = '# keep me\nA="1"\n\n# section\nB=two # inline\nC="3"\n';
      const after = upsertEnvContent(before, { B: "new" });
      expect(after).toBe('# keep me\nA="1"\n\n# section\nB="new"\nC="3"\n');
    });

    it("appends new keys and is idempotent", () => {
      const once = upsertEnvContent('A="1"\n', { D: "4" });
      expect(once).toBe('A="1"\nD="4"\n');
      expect(upsertEnvContent(once, { D: "4" })).toBe(once);
    });

    it("updates the last assignment when a key repeats", () => {
      const after = upsertEnvContent('A="1"\nA="2"\n', { A: "3" });
      expect(after).toBe('A="1"\nA="3"\n');
      expect(parseEnvValues(after).A).toBe("3");
    });

    it("escapes $ so dotenv expansion keeps passwords intact, and round-trips", () => {
      const line = formatEnvAssignment("PGPASSWORD", "pa$$word");
      expect(line).toBe('PGPASSWORD="pa\\$\\$word"');
      expect(parseEnvValues(line).PGPASSWORD).toBe("pa$$word");
    });

    it("refuses values that cannot round-trip", () => {
      expect(() => formatEnvAssignment("A", 'x"y')).toThrow(/edit .env.local/);
      expect(() => formatEnvAssignment("A", "x\ny")).toThrow();
    });
  });

  describe("atomic writes", () => {
    it("leaves the original file untouched and removes the temp file when the rename fails", () => {
      const target = path.join(dir, ".env.local");
      fs.writeFileSync(target, 'A="original"\n');
      const written: string[] = [];
      const removed: string[] = [];
      const io: AtomicWriteIo = {
        writeFileSync: (file, data, options) => {
          written.push(file);
          fs.writeFileSync(file, data, options);
        },
        renameSync: () => {
          throw new Error("disk full");
        },
        rmSync: (file, options) => {
          removed.push(file);
          fs.rmSync(file, options);
        },
      };
      expect(() => writeFileAtomic(target, 'A="new"\n', io)).toThrow(
        "disk full"
      );
      expect(fs.readFileSync(target, "utf-8")).toBe('A="original"\n');
      expect(removed).toEqual(written);
      expect(fs.existsSync(written[0])).toBe(false);
    });

    it("creates the file owner-readable only", () => {
      const target = path.join(dir, ".env.local");
      writeFileAtomic(target, 'A="1"\n');
      expect(fs.statSync(target).mode & 0o777).toBe(0o600);
    });
  });

  describe("secrets", () => {
    it("generates a 256-bit URL-safe CRON_SECRET", () => {
      const secret = generateCronSecret();
      expect(secret).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(generateCronSecret()).not.toBe(secret);
    });

    it("redacts secret values but not public ones", () => {
      const text = "token abcd1234 at https://example.test";
      expect(
        redactSecrets(text, {
          GITHUB_TOKEN: "abcd1234",
          NEXT_PUBLIC_APP_URL: "https://example.test",
        })
      ).toBe("token [redacted] at https://example.test");
    });

    it("asks for secrets with hidden input and never puts a value in a question", async () => {
      const { prompter, asked } = scriptedPrompter({
        secret: ["postgresql://me:hunter2@db.acme-host.tech/app"],
      });
      const result = await run({
        prompter,
        skipDb: false,
        processEnv: {},
        profile: "local-minimal",
      });
      const databaseQuestion = asked.find((entry) =>
        entry.question.startsWith("DATABASE_URL")
      );
      expect(databaseQuestion?.kind).toBe("secret");
      expect(JSON.stringify(asked)).not.toContain("hunter2");
      expect(JSON.stringify(result)).not.toContain("hunter2");
    });
  });

  describe("profiles", () => {
    it("requires different keys per profile", () => {
      const values = {
        DATABASE_URL: "postgresql://me:pw@db.neon.tech/app",
        CRON_SECRET: generateCronSecret(),
      };
      expect(
        evaluateProfileReadiness(SETUP_PROFILES["local-minimal"], values)
          .requiredReady
      ).toBe(true);
      expect(
        evaluateProfileReadiness(SETUP_PROFILES["hosted-development"], values)
          .missingRequired
      ).toEqual(["DATABASE_URL_UNPOOLED"]);
      expect(
        evaluateProfileReadiness(SETUP_PROFILES.deployment, values)
          .missingRequired
      ).toEqual([
        "DATABASE_URL_UNPOOLED",
        "UPSTASH_REDIS_REST_URL",
        "UPSTASH_REDIS_REST_TOKEN",
      ]);
    });

    it("stops requiring database keys with --skip-db", () => {
      const readiness = evaluateProfileReadiness(
        SETUP_PROFILES["local-minimal"],
        { CRON_SECRET: generateCronSecret() },
        {},
        { skipDb: true }
      );
      expect(readiness.requiredReady).toBe(true);
    });

    it("derives the direct Neon endpoint from the pooled one", () => {
      expect(
        deriveUnpooledUrl(
          "postgresql://u:p@ep-cool-1-pooler.us-east-2.aws.neon.tech/app?sslmode=require"
        )
      ).toBe(
        "postgresql://u:p@ep-cool-1.us-east-2.aws.neon.tech/app?sslmode=require"
      );
      expect(deriveUnpooledUrl("https://not-postgres")).toBeNull();
    });
  });

  describe("runEnvironmentStage via runSetupWorkflow", () => {
    it("creates .env.local, generates CRON_SECRET and reports template creation separately from readiness", async () => {
      const result = await run();
      const env = result.environment!;
      expect(env.templateCreated).toBe(true);
      expect(env.schemaValid).toBe(true);
      expect(env.requiredReady).toBe(true);
      expect(env.written).toEqual(["CRON_SECRET"]);
      const values = parseEnvValues(
        fs.readFileSync(path.join(dir, ".env.local"), "utf-8")
      );
      expect(values.CRON_SECRET).not.toBe("dev_cron_secret_token");
      expect(JSON.stringify(result)).not.toContain(values.CRON_SECRET);
    });

    it("reports missing required values as manual work in non-interactive runs", async () => {
      const result = await run({
        skipDb: false,
        processEnv: {},
        applySchema: false,
      });
      expect(result.environment?.requiredReady).toBe(false);
      expect(result.environment?.missingRequired).toEqual(["DATABASE_URL"]);
      const stage = result.stages.find((entry) => entry.id === "environment");
      expect(stage?.status).toBe("manual");
      expect(result.summary.manual).toContain("environment");
    });

    it("fails the stage when a present value breaks the schema", async () => {
      fs.writeFileSync(
        path.join(dir, ".env.local"),
        'UPSTASH_REDIS_REST_URL="not a url"\nCRON_SECRET="a-real-secret-value-that-is-long-enough-123"\n'
      );
      const result = await run();
      expect(result.environment?.schemaValid).toBe(false);
      expect(result.environment?.schemaErrors.join(" ")).toContain(
        "UPSTASH_REDIS_REST_URL"
      );
      expect(result.success).toBe(false);
      expect(result.summary.failed).toContain("environment");
    });

    it("preserves existing real values and unrelated keys across reruns", async () => {
      fs.writeFileSync(
        path.join(dir, ".env.local"),
        '# mine\nMY_OWN_FLAG="keep"\nCRON_SECRET="a-real-secret-value-that-is-long-enough-123"\n'
      );
      await run();
      const content = fs.readFileSync(path.join(dir, ".env.local"), "utf-8");
      expect(content).toBe(
        '# mine\nMY_OWN_FLAG="keep"\nCRON_SECRET="a-real-secret-value-that-is-long-enough-123"\n'
      );
      const again = await run();
      expect(again.environment?.written).toEqual([]);
      expect(again.environment?.kept).toContain("CRON_SECRET");
    });

    it("asks by name before replacing a real value and keeps it on no", async () => {
      fs.writeFileSync(
        path.join(dir, ".env.local"),
        'DATABASE_URL="postgresql://me:keepme@db.neon.tech/app"\n'
      );
      const { prompter, asked } = scriptedPrompter({ confirm: [false] });
      const result = await runSetupWorkflow({
        workspaceRoot: dir,
        skipDb: true,
        log: quiet,
        prompter,
        integrations: ["postgres"],
        run: async () => ({ code: 0, stdout: "", stderr: "" }),
        verify: [],
      });
      const replace = asked.find((entry) =>
        entry.question.includes("DATABASE_URL is already set")
      );
      expect(replace?.kind).toBe("confirm");
      expect(replace?.question).not.toContain("keepme");
      expect(
        parseEnvValues(fs.readFileSync(path.join(dir, ".env.local"), "utf-8"))
          .DATABASE_URL
      ).toBe("postgresql://me:keepme@db.neon.tech/app");
      expect(JSON.stringify(result)).not.toContain("keepme");
    });

    it("backs up .env.local before --force-env replaces it", async () => {
      fs.writeFileSync(path.join(dir, ".env.local"), 'OLD="value"\n');
      const result = await run({
        forceEnv: true,
        now: () => new Date("2026-10-03T12:00:00.000Z"),
      });
      const backup = result.environment?.backupPath;
      expect(backup).toBe(".env.local.backup-2026-10-03T12-00-00-000Z");
      expect(fs.readFileSync(path.join(dir, backup!), "utf-8")).toBe(
        'OLD="value"\n'
      );
      expect(
        fs.readFileSync(path.join(dir, ".env.local"), "utf-8")
      ).not.toContain("OLD=");
    });

    it("points DIRECT_URL at the configured database so migrations follow it", async () => {
      fs.writeFileSync(
        path.join(dir, ".env.local"),
        TEMPLATE.replace(
          /^DATABASE_URL=.*$/m,
          'DATABASE_URL="postgresql://u:p@ep-x-pooler.eu.aws.neon.tech/app"'
        )
      );
      await run({
        skipDb: false,
        profile: "hosted-development",
        processEnv: {},
      });
      const values = parseEnvValues(
        fs.readFileSync(path.join(dir, ".env.local"), "utf-8")
      );
      expect(values.DATABASE_URL_UNPOOLED).toBe(
        "postgresql://u:p@ep-x.eu.aws.neon.tech/app"
      );
      expect(values.DIRECT_URL).toBe(values.DATABASE_URL_UNPOOLED);
    });

    it("writes nothing in a dry run", async () => {
      const result = await run({ dryRun: true });
      expect(fs.existsSync(path.join(dir, ".env.local"))).toBe(false);
      expect(fs.existsSync(path.join(dir, ".setup-state.json"))).toBe(false);
      expect(result.environment?.templateCreated).toBe(true);
      expect(result.environment?.written).toEqual([]);
    });

    it("never collects values without a person", async () => {
      const prompter = createNonInteractivePrompter(true);
      expect(await prompter.secret("x")).toBe("");
      expect(await prompter.confirm("risky?", false)).toBe(false);
      expect(await prompter.confirm("safe?", true)).toBe(true);
      expect(await createNonInteractivePrompter().confirm("safe?", true)).toBe(
        false
      );
    });
  });
});
