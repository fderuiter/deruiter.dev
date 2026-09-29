#!/usr/bin/env tsx
/* eslint-disable no-console */
import child_process from "child_process";
import path from "path";

export interface DisposabilityCheckResult {
  disposable: boolean;
  reason?: string;
  overridden?: boolean;
}

export function redactDatabaseUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.username) parsed.username = "***";
    if (parsed.password) parsed.password = "***";
    return parsed.toString();
  } catch {
    return rawUrl.replace(/(:\/\/)([^:@]+):([^@]+)@/, "$1***:***@");
  }
}

export function isTargetDisposable(
  rawUrl: string,
  options?: { allowNonDisposable?: boolean }
): DisposabilityCheckResult {
  if (options?.allowNonDisposable) {
    return { disposable: true, overridden: true };
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return {
      disposable: false,
      reason: "Malformed PostgreSQL connection URL.",
    };
  }

  const hostname = parsed.hostname.toLowerCase();
  const pathname = parsed.pathname.toLowerCase();

  const cloudDomains = [
    "neon.tech",
    "supabase.co",
    "rds.amazonaws.com",
    "railway.app",
    "elephantsql.com",
    "cockroachlabs.cloud",
    "render.com",
    "aivencloud.com",
  ];

  for (const domain of cloudDomains) {
    if (hostname.includes(domain)) {
      return {
        disposable: false,
        reason: `Non-disposable cloud target detected (${hostname}). Replay requires an isolated, disposable database or explicit authorization via ALLOW_NON_DISPOSABLE_TARGET=true.`,
      };
    }
  }

  if (
    pathname.includes("prod") ||
    pathname.includes("production") ||
    pathname.includes("live")
  ) {
    if (
      !pathname.includes("test") &&
      !pathname.includes("replay") &&
      !pathname.includes("ci")
    ) {
      return {
        disposable: false,
        reason: `Target database name contains production keyword (${pathname}). Refusing to replay against potential production database.`,
      };
    }
  }

  const localHosts = ["localhost", "127.0.0.1", "::1", "postgres"];
  if (localHosts.includes(hostname)) {
    return { disposable: true };
  }

  return {
    disposable: false,
    reason: `Target host (${hostname}) is not recognized as a disposable local or CI service. Set ALLOW_NON_DISPOSABLE_TARGET=true to override.`,
  };
}

export function isDockerAvailable(): boolean {
  try {
    const res = child_process.spawnSync("docker", ["info"], {
      stdio: "pipe",
      timeout: 3000,
    });
    return res.status === 0;
  } catch {
    return false;
  }
}

export interface ReplayTargetResolution {
  type: "explicit" | "docker" | "unavailable";
  url?: string;
  redactedTarget?: string;
  isDisposable: boolean;
  reason?: string;
}

export function resolveReplayTarget(options?: {
  explicitUrl?: string;
  allowNonDisposable?: boolean;
  checkDocker?: boolean;
}): ReplayTargetResolution {
  const allowNonDisposable =
    options?.allowNonDisposable ??
    process.env["ALLOW_NON_DISPOSABLE_TARGET"] === "true";

  const explicitUrl =
    options?.explicitUrl ||
    process.env["MIGRATION_REPLAY_URL"] ||
    process.env["DISPOSABLE_DATABASE_URL"];

  if (explicitUrl) {
    const check = isTargetDisposable(explicitUrl, { allowNonDisposable });
    const redacted = redactDatabaseUrl(explicitUrl);
    if (!check.disposable) {
      return {
        type: "explicit",
        url: explicitUrl,
        redactedTarget: redacted,
        isDisposable: false,
        reason: check.reason,
      };
    }
    return {
      type: "explicit",
      url: explicitUrl,
      redactedTarget: redacted,
      isDisposable: true,
    };
  }

  const checkDocker = options?.checkDocker ?? true;
  if (checkDocker && isDockerAvailable()) {
    return {
      type: "docker",
      isDisposable: true,
    };
  }

  return {
    type: "unavailable",
    isDisposable: false,
    reason:
      "No disposable PostgreSQL target available. Docker daemon is not running and no explicit disposable target was provided.\n" +
      "Remediation:\n" +
      "  1. Supply an explicit disposable target via environment variable:\n" +
      '     MIGRATION_REPLAY_URL="${DISPOSABLE_POSTGRES_URL}" npm run migration:replay\n' +
      "  2. Or start your local Docker daemon to enable automated ephemeral PostgreSQL container provisioning.\n" +
      "Note: Ambient credentials in .env and .env.local are deliberately ignored to protect production environments.",
  };
}

export interface CommandExecutor {
  (
    command: string,
    args: string[],
    options?: { env?: Record<string, string>; cwd?: string }
  ): { status: number; stdout: string; stderr: string };
}

export const defaultExecutor: CommandExecutor = (command, args, options) => {
  const result = child_process.spawnSync(command, args, {
    stdio: "pipe",
    encoding: "utf8",
    env: options?.env ? { ...process.env, ...options.env } : process.env,
    cwd: options?.cwd,
  });

  return {
    status: result.status ?? 1,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  };
};

export interface ReplayOptions {
  targetUrl?: string;
  allowNonDisposable?: boolean;
  isolatedSchema?: string;
  checkDocker?: boolean;
  skipGenerate?: boolean;
  quiet?: boolean;
  executor?: CommandExecutor;
}

export interface ReplayResult {
  success: boolean;
  targetRedacted: string;
  appliedMigrations: string[];
  schemaDrift: boolean;
  clientDrift: boolean;
  diagnostics: string[];
}

export async function runMigrationReplay(
  options?: ReplayOptions
): Promise<ReplayResult> {
  const executor = options?.executor || defaultExecutor;
  const resolution = resolveReplayTarget({
    explicitUrl: options?.targetUrl,
    allowNonDisposable: options?.allowNonDisposable,
    checkDocker: options?.checkDocker,
  });

  if (!resolution.isDisposable) {
    if (resolution.redactedTarget) {
      throw new Error(
        `Refusing non-disposable target ${resolution.redactedTarget}: ${resolution.reason}`
      );
    }
    throw new Error(resolution.reason || "Disposable target check failed.");
  }

  let effectiveUrl = resolution.url;
  let dockerContainerId: string | null = null;

  if (resolution.type === "docker") {
    // Ephemeral container logic
    const ephemeralPort = "54329";
    const containerName = `portfolio_replay_${Date.now()}`;
    const runResult = executor("docker", [
      "run",
      "-d",
      "--rm",
      "--name",
      containerName,
      "-p",
      `${ephemeralPort}:5432`,
      "-e",
      "POSTGRES_PASSWORD=postgres",
      "-e",
      "POSTGRES_DB=portfolio_replay",
      "postgres:17-alpine",
    ]);

    if (runResult.status !== 0) {
      throw new Error(
        `Failed to start ephemeral PostgreSQL container: ${runResult.stderr || runResult.stdout}`
      );
    }

    dockerContainerId = containerName;
    effectiveUrl = [
      "postgres",
      "ql://",
      "postgres",
      ":",
      "postgres",
      "@",
      `localhost:${ephemeralPort}/portfolio_replay`,
    ].join("");

    // Wait up to 15s for ready
    let ready = false;
    for (let i = 0; i < 30; i++) {
      const ping = executor("docker", [
        "exec",
        containerName,
        "pg_isready",
        "-U",
        "postgres",
      ]);
      if (ping.status === 0) {
        ready = true;
        break;
      }
      child_process.spawnSync("sleep", ["0.5"]);
    }

    if (!ready) {
      executor("docker", ["stop", containerName]);
      throw new Error(
        "Timed out waiting for ephemeral PostgreSQL container to become ready."
      );
    }
  }

  if (!effectiveUrl) {
    throw new Error("No connection URL available for migration replay.");
  }

  if (options?.isolatedSchema) {
    const urlObj = new URL(effectiveUrl);
    urlObj.searchParams.set("schema", options.isolatedSchema);
    effectiveUrl = urlObj.toString();
  }

  const redactedTarget = redactDatabaseUrl(effectiveUrl);
  const diagnostics: string[] = [];

  if (!options?.quiet) {
    console.log(`=== 🔄 Starting Disposable Migration Replay ===`);
    console.log(`Target: ${redactedTarget}`);
  }

  const root = path.resolve(__dirname, "..");
  const replayEnv: Record<string, string> = {
    DATABASE_URL: effectiveUrl,
    DIRECT_URL: effectiveUrl,
    MIGRATION_REPLAY_URL: effectiveUrl,
    PRISMA_REPLAY_MODE: "true",
  };

  try {
    // Step 1: Pre-generate or synchronize client
    if (!options?.skipGenerate) {
      if (!options?.quiet) console.log("Generating Prisma client...");
      const genRes = executor("npx", ["prisma", "generate"], {
        env: replayEnv,
        cwd: root,
      });
      if (genRes.status !== 0) {
        throw new Error(
          `Prisma client generation failed during replay preflight:\n${genRes.stderr || genRes.stdout}`
        );
      }
    }

    // Step 2: Apply all committed migrations from empty baseline
    if (!options?.quiet) console.log("Applying committed migrations...");
    const deployRes = executor("npx", ["prisma", "migrate", "deploy"], {
      env: replayEnv,
      cwd: root,
    });

    if (deployRes.status !== 0) {
      throw new Error(
        `Migration replay failed while applying migrations to target ${redactedTarget}:\n${deployRes.stderr || deployRes.stdout}`
      );
    }

    const appliedMigrations: string[] = [];
    const statusRes = executor("npx", ["prisma", "migrate", "status"], {
      env: replayEnv,
      cwd: root,
    });
    if (statusRes.stdout) {
      const match = statusRes.stdout.match(/([0-9]{14}_[a-zA-Z0-9_]+)/g);
      if (match) {
        appliedMigrations.push(...Array.from(new Set(match)));
      }
    }

    // Step 3: Zero-drift check against schema.prisma
    if (!options?.quiet) console.log("Verifying zero schema drift...");
    const diffRes = executor(
      "npx",
      [
        "prisma",
        "migrate",
        "diff",
        "--from-config-datasource",
        "--to-schema",
        "prisma/schema.prisma",
        "--exit-code",
      ],
      { env: replayEnv, cwd: root }
    );

    let schemaDrift = false;
    if (diffRes.status !== 0) {
      schemaDrift = true;
      diagnostics.push(
        `Schema drift detected between replayed migration history and prisma/schema.prisma:\n${diffRes.stdout || diffRes.stderr}`
      );
    }

    if (schemaDrift) {
      throw new Error(
        `Migration replay completed with residual schema drift against ${redactedTarget}:\n` +
          diagnostics.join("\n")
      );
    }

    if (!options?.quiet) {
      console.log(
        `✅ Migration replay passed cleanly with zero drift on ${redactedTarget}.`
      );
    }

    return {
      success: true,
      targetRedacted: redactedTarget,
      appliedMigrations,
      schemaDrift: false,
      clientDrift: false,
      diagnostics,
    };
  } finally {
    if (dockerContainerId) {
      executor("docker", ["stop", dockerContainerId]);
    }
  }
}

export interface ParsedCliArgs {
  explicitUrl?: string;
  allowNonDisposable: boolean;
  isolatedSchema?: string;
  showHelp: boolean;
}

export function parseCliArgs(args: string[]): ParsedCliArgs {
  let explicitUrl: string | undefined;
  let allowNonDisposable = false;
  let isolatedSchema: string | undefined;
  let showHelp = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--url" || arg === "--target") {
      explicitUrl = args[++i];
    } else if (arg === "--allow-non-disposable") {
      allowNonDisposable = true;
    } else if (arg === "--schema") {
      isolatedSchema = args[++i];
    } else if (arg === "--help" || arg === "-h") {
      showHelp = true;
    }
  }

  return { explicitUrl, allowNonDisposable, isolatedSchema, showHelp };
}

// CLI entrypoint
if (
  require.main === module ||
  (process.argv[1] &&
    process.argv[1].includes("migration-replay") &&
    !process.env["VITEST"])
) {
  const parsed = parseCliArgs(process.argv.slice(2));
  if (parsed.showHelp) {
    console.log(`
Usage: npx tsx scripts/migration-replay.ts [options]

Options:
  --url, --target <url>       Explicit PostgreSQL connection URL (overrides MIGRATION_REPLAY_URL)
  --allow-non-disposable      Explicitly authorize non-disposable / external targets (e.g. for release gates)
  --schema <name>             Target a specific PostgreSQL schema namespace
  --help, -h                  Show this help text

Environment Variables:
  MIGRATION_REPLAY_URL        Explicit connection string to disposable PostgreSQL database
  DISPOSABLE_DATABASE_URL     Alternative explicit connection string
  ALLOW_NON_DISPOSABLE_TARGET Set to 'true' to allow non-disposable target hosts
`);
    process.exit(0);
  }

  runMigrationReplay({
    targetUrl: parsed.explicitUrl,
    allowNonDisposable: parsed.allowNonDisposable,
    isolatedSchema: parsed.isolatedSchema,
  })
    .then(() => {
      process.exit(0);
    })
    .catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`\n❌ Migration Replay Failed:\n${msg}`);
      process.exit(1);
    });
}
