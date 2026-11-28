import fs from "node:fs";
import path from "node:path";

/**
 * Shared Vercel configuration and Preview environment isolation policy.
 *
 * Drives `checkVercelBuildCommands` in `lib/dx/doctor.ts` and
 * `scripts/vercel-preview-preflight.js` from one contract. Never interpolate
 * environment variable values into problem reasons or summaries.
 */

/** Expected `vercel.json` deployment and Hobby cron contract. */
export const VERCEL_CONFIG_POLICY = {
  framework: "nextjs",
  installCommand: "npm ci",
  buildCommand: "npm run build",
  buildScriptPath: "scripts/build.js",
  ignoreCommand: "node scripts/vercel-ignore-build.js",
  ignoreScriptPath: "scripts/vercel-ignore-build.js",
  gitDeploymentEnabled: false,
  cron: {
    path: "/api/cron/maintenance",
    schedule: "0 0 * * *",
    routeFilePath: "app/api/cron/maintenance/route.ts",
  },
} as const;

/** Result of validating `vercel.json` and its referenced script/route targets. */
export interface VercelConfigValidationResult {
  readonly ok: boolean;
  readonly parseError?: string;
  readonly missingCommands: string[];
  readonly violations: string[];
}

/**
 * Validates `vercel.json` commands, script/route targets, `framework`,
 * `git.deploymentEnabled`, and the single daily Hobby cron schedule.
 */
export function validateVercelConfig(
  root: string
): VercelConfigValidationResult {
  const vercelJsonPath = path.join(root, "vercel.json");
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(vercelJsonPath, "utf8"));
  } catch {
    return {
      ok: false,
      parseError: "vercel.json is missing, unreadable or invalid JSON.",
      missingCommands: [],
      violations: ["vercel.json is missing, unreadable or invalid JSON."],
    };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {
      ok: false,
      parseError: "vercel.json must contain a JSON object.",
      missingCommands: [],
      violations: ["vercel.json must contain a JSON object."],
    };
  }

  const config = parsed as Record<string, unknown>;
  const commandKeys = [
    "installCommand",
    "buildCommand",
    "ignoreCommand",
  ] as const;

  const missingCommands = commandKeys.filter((key) => {
    const command = config[key];
    return typeof command !== "string" || command.trim() === "";
  });

  if (missingCommands.length > 0) {
    const message = `Declare nonempty commands in vercel.json for ${missingCommands.join(", ")}.`;
    return {
      ok: false,
      missingCommands: [...missingCommands],
      violations: [message],
    };
  }

  const violations: string[] = [];

  if (config.framework !== VERCEL_CONFIG_POLICY.framework) {
    violations.push(
      `vercel.json: expected framework "${VERCEL_CONFIG_POLICY.framework}", found ${JSON.stringify(config.framework)}.`
    );
  }

  if (config.installCommand !== VERCEL_CONFIG_POLICY.installCommand) {
    violations.push(
      `vercel.json: expected installCommand "${VERCEL_CONFIG_POLICY.installCommand}", found ${JSON.stringify(config.installCommand)}.`
    );
  }

  if (config.buildCommand !== VERCEL_CONFIG_POLICY.buildCommand) {
    violations.push(
      `vercel.json: expected buildCommand "${VERCEL_CONFIG_POLICY.buildCommand}", found ${JSON.stringify(config.buildCommand)}.`
    );
  } else {
    const pkgPath = path.join(root, "package.json");
    if (!fs.existsSync(pkgPath)) {
      violations.push(
        "package.json is missing; buildCommand 'npm run build' has no target."
      );
    } else {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as {
          scripts?: Record<string, unknown>;
        };
        const buildScript = pkg.scripts?.build;
        if (typeof buildScript !== "string" || buildScript.trim() === "") {
          violations.push(
            "package.json: missing scripts.build target for vercel.json buildCommand."
          );
        } else if (
          buildScript !== `node ${VERCEL_CONFIG_POLICY.buildScriptPath}`
        ) {
          violations.push(
            `package.json: expected scripts.build to be "node ${VERCEL_CONFIG_POLICY.buildScriptPath}", found ${JSON.stringify(buildScript)}.`
          );
        }
      } catch {
        violations.push("package.json is unreadable or invalid JSON.");
      }
    }

    if (!fs.existsSync(path.join(root, VERCEL_CONFIG_POLICY.buildScriptPath))) {
      violations.push(
        `Missing build script target '${VERCEL_CONFIG_POLICY.buildScriptPath}'.`
      );
    }
  }

  if (config.ignoreCommand !== VERCEL_CONFIG_POLICY.ignoreCommand) {
    violations.push(
      `vercel.json: expected ignoreCommand "${VERCEL_CONFIG_POLICY.ignoreCommand}", found ${JSON.stringify(config.ignoreCommand)}.`
    );
  } else if (
    !fs.existsSync(path.join(root, VERCEL_CONFIG_POLICY.ignoreScriptPath))
  ) {
    violations.push(
      `Missing ignoreCommand script target '${VERCEL_CONFIG_POLICY.ignoreScriptPath}'.`
    );
  }

  const gitConfig = config.git;
  const gitDeploymentEnabled =
    gitConfig && typeof gitConfig === "object" && !Array.isArray(gitConfig)
      ? (gitConfig as Record<string, unknown>).deploymentEnabled
      : undefined;
  if (gitDeploymentEnabled !== VERCEL_CONFIG_POLICY.gitDeploymentEnabled) {
    violations.push(
      `vercel.json: expected git.deploymentEnabled to be false, found ${JSON.stringify(gitDeploymentEnabled)}.`
    );
  }

  const crons = config.crons;
  if (!Array.isArray(crons) || crons.length !== 1) {
    violations.push(
      `vercel.json: expected exactly 1 cron entry for Vercel Hobby, found ${Array.isArray(crons) ? crons.length : JSON.stringify(crons)}.`
    );
  } else {
    const entry = crons[0] as Record<string, unknown> | null;
    const cronPath =
      entry && typeof entry === "object" ? entry.path : undefined;
    const cronSchedule =
      entry && typeof entry === "object" ? entry.schedule : undefined;

    if (cronPath !== VERCEL_CONFIG_POLICY.cron.path) {
      violations.push(
        `vercel.json: expected cron path "${VERCEL_CONFIG_POLICY.cron.path}", found ${JSON.stringify(cronPath)}.`
      );
    } else if (
      !fs.existsSync(path.join(root, VERCEL_CONFIG_POLICY.cron.routeFilePath))
    ) {
      violations.push(
        `Missing cron route target '${VERCEL_CONFIG_POLICY.cron.routeFilePath}'.`
      );
    }

    if (cronSchedule !== VERCEL_CONFIG_POLICY.cron.schedule) {
      violations.push(
        `vercel.json: expected daily Hobby cron schedule "${VERCEL_CONFIG_POLICY.cron.schedule}", found ${JSON.stringify(cronSchedule)}.`
      );
    }
  }

  return {
    ok: violations.length === 0,
    missingCommands: [],
    violations,
  };
}

/**
 * The production Neon compute endpoint. Both pooled and direct hostnames
 * contain it; recorded in `docs/reference/neon-capacity-inventory.md`.
 */
export const PRODUCTION_NEON_ENDPOINT = "ep-young-mouse-ap1zkh0m";

/**
 * Exact variable names forbidden in Vercel Preview deployments (ADR 0071).
 * Includes production service credentials, the clinical warehouse database URL,
 * and `DIRECT_URL` (which overrides `prisma.config.ts` datasource resolution).
 */
export const PRODUCTION_ONLY: readonly string[] = [
  "CRON_SECRET",
  "RESEND_API_KEY",
  "RESEND_WEBHOOK_SECRET",
  "QSTASH_TOKEN",
  "QSTASH_CURRENT_SIGNING_KEY",
  "QSTASH_NEXT_SIGNING_KEY",
  "UPSTASH_REDIS_REST_TOKEN",
  "KV_REST_API_TOKEN",
  "KV_REST_API_READ_ONLY_TOKEN",
  "KV_URL",
  "REDIS_URL",
  "SENTRY_AUTH_TOKEN",
  "BLOB_READ_WRITE_TOKEN",
  "APP_DATABASE_URL",
  "WAREHOUSE_DATABASE_URL",
  "DIRECT_URL",
];

const CUSTOM_BLOCKED_REASONS: Readonly<Record<string, string>> = {
  WAREHOUSE_DATABASE_URL:
    "is the clinical warehouse database credential and must not be set in Preview",
  DIRECT_URL:
    "overrides Prisma's connection URL (prisma.config.ts) and must not be set in Vercel",
};

/** Neon and Vercel Postgres integration prefixes scoped to Production only. */
export const PRODUCTION_POSTGRES_PREFIXES: readonly string[] = [
  "POSTGRES_",
  "PG",
];

/** Retired legacy AWS integration prefixes (ADR 0070, migrated to Neon in #3207/#3208). */
export const LEGACY_AWS_INTEGRATION_PREFIXES: readonly string[] = [
  "DSQL_",
  "DYNAMODB_",
];

/** One Preview isolation violation, naming only the variable and a value-free reason. */
export interface PreviewEnvProblem {
  readonly name: string;
  readonly reason: string;
}

/** Outcome of `checkVercelPreviewEnv`. Neither `problems` nor `summary` contains secret values. */
export interface PreviewEnvCheckResult {
  readonly problems: PreviewEnvProblem[];
  readonly summary: string[];
}

function isSet(
  env: Readonly<Record<string, string | undefined>>,
  name: string
): env is Record<string, string> {
  const value = env[name];
  return typeof value === "string" && value.trim() !== "";
}

/** True only when running inside a Vercel Preview build (`VERCEL=1` and `VERCEL_ENV=preview`). */
export function shouldRunPreviewPreflight(
  env: Readonly<Record<string, string | undefined>>
): boolean {
  return env.VERCEL === "1" && env.VERCEL_ENV === "preview";
}

/**
 * Checks a Preview build environment for production endpoints, credentials,
 * Production-scoped Postgres aliases, legacy AWS integration prefixes, and
 * Clerk live keys. Never includes any variable value in its return object.
 */
export function checkVercelPreviewEnv(
  env: Readonly<Record<string, string | undefined>>
): PreviewEnvCheckResult {
  const problems: PreviewEnvProblem[] = [];
  const reported = new Set<string>();

  const record = (name: string, reason: string) => {
    if (reported.has(name)) return;
    reported.add(name);
    problems.push({ name, reason });
  };

  const sortedNames = Object.keys(env).sort();

  for (const name of sortedNames) {
    if (isSet(env, name) && env[name].includes(PRODUCTION_NEON_ENDPOINT)) {
      record(name, "names the production Neon endpoint");
    }
  }

  for (const name of PRODUCTION_ONLY) {
    if (isSet(env, name)) {
      record(
        name,
        CUSTOM_BLOCKED_REASONS[name] ??
          "is a production-only credential and must not be set in Preview"
      );
    }
  }

  for (const name of sortedNames) {
    if (!isSet(env, name)) continue;
    if (
      LEGACY_AWS_INTEGRATION_PREFIXES.some((prefix) => name.startsWith(prefix))
    ) {
      record(
        name,
        "belongs to a retired legacy AWS integration (ADR 0070) and must not be set in Preview"
      );
    } else if (
      PRODUCTION_POSTGRES_PREFIXES.some((prefix) => name.startsWith(prefix))
    ) {
      record(
        name,
        "is a Production-scoped Neon/Postgres integration variable and must not be set in Preview"
      );
    }
  }

  if (
    isSet(env, "CLERK_SECRET_KEY") &&
    env.CLERK_SECRET_KEY.startsWith("sk_live_")
  ) {
    record(
      "CLERK_SECRET_KEY",
      "is a Clerk production key (sk_live_); use a development key"
    );
  }
  if (
    isSet(env, "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY") &&
    env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.startsWith("pk_live_")
  ) {
    record(
      "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
      "is a Clerk production key (pk_live_); use a development key"
    );
  }

  const summary = [
    isSet(env, "DATABASE_URL")
      ? "Database: a non-production Neon endpoint."
      : "Database: none. Database-backed pages use the built-in fallback content.",
    "Cache: none. Rate limits are per instance and telemetry is not buffered.",
    "Email, QStash, cron, warehouse and AWS: off.",
  ];

  return { problems, summary };
}
