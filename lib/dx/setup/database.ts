import { isPlaceholderValue } from "./environment";
import type { SetupPrompter } from "./prompts";
import type { CommandRunner } from "./providers/publish";
import type { DatabaseStatus, DatabaseStepRecord } from "./types";

/** A database target with everything secret stripped out. */
export interface DatabaseIdentity {
  host: string;
  port: string;
  database: string;
  /** `host:port/database`: the only form ever shown or logged. */
  redacted: string;
  local: boolean;
}

const LOCAL_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "[::1]",
  "host.docker.internal",
]);

/**
 * Parses a Postgres URL into a redacted identity. The user name, password
 * and query string never leave this function. Returns null for anything
 * that is not a postgres:// URL.
 */
export function parseDatabaseIdentity(
  url: string | undefined
): DatabaseIdentity | null {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) return null;
  const host = parsed.hostname;
  const port = parsed.port || "5432";
  const database =
    decodeURIComponent(parsed.pathname.replace(/^\//, "")) || "postgres";
  return {
    host,
    port,
    database,
    redacted: `${host}:${port}/${database}`,
    local: LOCAL_HOSTS.has(host) || host.endsWith(".local"),
  };
}

/**
 * Resolves the URL Prisma's CLI will actually connect to, mirroring
 * `prisma.config.ts`: the replay overrides first (process environment
 * only, because replay mode skips `.env.local`), then the direct endpoints,
 * then the pooled one. A variable already in the process environment wins
 * over `.env.local`, exactly as dotenv does. Checking any other URL would
 * let the production guard inspect one database while Prisma mutates
 * another.
 */
export function resolvePrismaDatabaseUrl(
  fileValues: Readonly<Record<string, string>>,
  processEnv: Readonly<Record<string, string | undefined>>
): string | undefined {
  for (const key of ["MIGRATION_REPLAY_URL", "DISPOSABLE_DATABASE_URL"]) {
    const value = processEnv[key];
    if (value && value.trim() !== "") return value;
  }
  for (const key of ["DIRECT_URL", "DATABASE_URL_UNPOOLED", "DATABASE_URL"]) {
    const value = processEnv[key] ?? fileValues[key];
    if (value && value.trim() !== "") return value;
  }
  return undefined;
}

const PRODUCTION_TOKEN = /(^|[^a-z])(prod|production|live|primary)([^a-z]|$)/i;

/**
 * Flags obvious production targets. This is a guard, not a proof: a hosted
 * database with a neutral name is not detected, which is why every hosted
 * mutation also asks first.
 */
export function detectProductionTarget(
  identity: DatabaseIdentity,
  context: {
    profileAllowsMutation: boolean;
    vercelEnv?: string;
    nodeEnv?: string;
  }
): string[] {
  const reasons: string[] = [];
  if (!context.profileAllowsMutation) {
    reasons.push("the deployment profile never mutates a database");
  }
  if (context.vercelEnv === "production")
    reasons.push("VERCEL_ENV is production");
  if (context.nodeEnv === "production") reasons.push("NODE_ENV is production");
  if (!identity.local && PRODUCTION_TOKEN.test(identity.host)) {
    reasons.push("the host name says production");
  }
  if (PRODUCTION_TOKEN.test(identity.database)) {
    reasons.push("the database name says production");
  }
  return reasons;
}

/**
 * How the schema reaches a target. A local database is disposable, so it
 * gets `prisma db push`, which syncs the schema without writing migration
 * history. Any hosted database gets `prisma migrate deploy`, the committed
 * migration workflow production uses, so its history never diverges.
 */
export function schemaCommandFor(identity: DatabaseIdentity): string[] {
  return identity.local
    ? ["prisma", "db", "push"]
    : ["prisma", "migrate", "deploy"];
}

function step(
  status: DatabaseStepRecord["status"],
  detail: string,
  recovery?: string
): DatabaseStepRecord {
  return recovery ? { status, detail, recovery } : { status, detail };
}

/** Inputs to {@link runDatabaseStage}. */
export interface DatabaseStageOptions {
  databaseUrl: string | undefined;
  profileAllowsMutation: boolean;
  prompter: SetupPrompter;
  run: CommandRunner;
  root: string;
  dryRun: boolean;
  /** Apply the schema without asking (non-interactive opt-in). */
  applySchema: boolean;
  /** Seed sample data without asking (non-interactive opt-in). */
  seed: boolean;
  skipSeed: boolean;
  /** Exact host the person allows despite production markers. */
  allowProductionHost?: string;
  vercelEnv?: string;
  nodeEnv?: string;
  log: (line: string) => void;
}

/**
 * Generates the Prisma client, then (each step asked separately) applies
 * the schema and seeds sample data. Refuses both mutations on a production
 * target unless `allowProductionHost` names that exact host and a person
 * confirms it. Every step records whether it ran and how to recover it.
 */
export async function runDatabaseStage(
  options: DatabaseStageOptions
): Promise<DatabaseStatus> {
  const { prompter, run, root, dryRun, log } = options;
  const status: DatabaseStatus = {
    target: null,
    productionTarget: false,
    productionReasons: [],
    generate: step("not-attempted", ""),
    schema: step("not-attempted", ""),
    seed: step("not-attempted", ""),
  };

  if (dryRun) {
    status.generate = step(
      "skipped",
      "Dry run: would run npx prisma generate."
    );
  } else {
    const generate = await run("npx", ["prisma", "generate"], { cwd: root });
    status.generate =
      generate.code === 0
        ? step("succeeded", "Prisma client generated.")
        : step("failed", "prisma generate failed.", "npx prisma generate");
  }

  const identity = parseDatabaseIdentity(options.databaseUrl);
  if (identity && isPlaceholderValue(options.databaseUrl)) {
    const detail = `The database URL Prisma would use (${identity.redacted}) is still the example value, so nothing was applied.`;
    status.target = identity.redacted;
    status.schema = step("needs-manual-recovery", detail, "npm run setup");
    status.seed = step("skipped", detail);
    log(detail);
    return status;
  }
  if (!identity) {
    const detail =
      "DATABASE_URL is not a postgres:// URL, so nothing was applied.";
    status.schema = step("needs-manual-recovery", detail, "npm run setup");
    status.seed = step("skipped", detail);
    return status;
  }
  status.target = identity.redacted;
  log(
    `Database target: ${identity.redacted}${identity.local ? " (local)" : ""}`
  );

  const reasons = detectProductionTarget(identity, {
    profileAllowsMutation: options.profileAllowsMutation,
    vercelEnv: options.vercelEnv,
    nodeEnv: options.nodeEnv,
  });
  status.productionTarget = reasons.length > 0;
  status.productionReasons = reasons;

  if (status.productionTarget) {
    const named = options.allowProductionHost === identity.host;
    const confirmed =
      named &&
      prompter.interactive &&
      (await prompter.input(
        `Type the host name to confirm mutating ${identity.redacted}:`
      )) === identity.host;
    if (!confirmed) {
      const detail = `Refused: ${identity.redacted} looks like production (${reasons.join("; ")}).`;
      const recovery = `npm run setup -- --allow-production-db ${identity.host}`;
      status.schema = step("needs-manual-recovery", detail, recovery);
      status.seed = step("skipped", detail, recovery);
      log(detail);
      return status;
    }
  }

  const schemaArgs = schemaCommandFor(identity);
  const schemaCommand = `npx ${schemaArgs.join(" ")}`;
  const wantsSchema =
    options.applySchema ||
    (await prompter.confirm(
      `Apply the schema to ${identity.redacted} with ${schemaCommand}?`,
      identity.local
    ));
  if (!wantsSchema) {
    status.schema = step("skipped", "Not confirmed.", schemaCommand);
  } else if (dryRun) {
    status.schema = step("skipped", `Dry run: would run ${schemaCommand}.`);
  } else {
    const result = await run("npx", schemaArgs, { cwd: root });
    status.schema =
      result.code === 0
        ? step("succeeded", `${schemaCommand} finished.`)
        : step(
            "failed",
            `${schemaCommand} failed; check that the database is reachable and DATABASE_URL_UNPOOLED is a direct connection.`,
            schemaCommand
          );
  }

  const seedCommand = "npx prisma db seed";
  if (options.skipSeed) {
    status.seed = step("skipped", "Skipped (--skip-db-seed).", seedCommand);
  } else if (status.schema.status !== "succeeded" && !dryRun) {
    status.seed = step(
      "skipped",
      "The schema was not applied, so seeding was not attempted.",
      seedCommand
    );
  } else {
    const wantsSeed =
      options.seed ||
      (await prompter.confirm(
        `Load sample data into ${identity.redacted}?`,
        identity.local
      ));
    if (!wantsSeed) {
      status.seed = step("skipped", "Not confirmed.", seedCommand);
    } else if (dryRun) {
      status.seed = step("skipped", `Dry run: would run ${seedCommand}.`);
    } else {
      const result = await run("npx", ["prisma", "db", "seed"], { cwd: root });
      status.seed =
        result.code === 0
          ? step("succeeded", "Sample data loaded.")
          : step(
              "failed",
              "Seeding failed. The seed connects through the Neon driver; a plain PostgreSQL server needs a Neon-compatible WebSocket proxy.",
              seedCommand
            );
    }
  }
  return status;
}
