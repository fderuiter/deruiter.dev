import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { getEnv } from "../env";
import { satisfiesVersionRange } from "./preflight";
import {
  collectEnvValue,
  isPlaceholderValue,
  parseEnvValues,
  runEnvironmentStage,
  SETUP_PROFILES,
  upsertEnvContent,
  writeFileAtomic,
} from "./setup/environment";
import { resolvePrismaDatabaseUrl, runDatabaseStage } from "./setup/database";
import {
  createNonInteractivePrompter,
  SetupCancelledError,
  type SetupPrompter,
} from "./setup/prompts";
import {
  PROVIDER_ADAPTERS,
  resolveProviderAdapters,
} from "./setup/providers/catalog";
import {
  publishToDestination,
  type CommandRunner,
} from "./setup/providers/publish";
import type {
  ProbeFetch,
  ProviderAdapter,
  PublishDestination,
} from "./setup/providers/types";
import {
  canResumePast,
  readSetupState,
  recordStage,
  writeSetupState,
} from "./setup/state";
import {
  SETUP_PROFILE_IDS,
  type DatabaseStatus,
  type IntegrationOutcome,
  type SetupProfileId,
  type SetupResult,
  type SetupStageId,
  type SetupStageRecord,
  type SetupStageStatus,
} from "./setup/types";
import { runVerification, type VerificationLevel } from "./setup/verification";

export * from "./setup/types";
export {
  ENV_KEY_CLASSIFICATION,
  PLACEHOLDER_MARKERS,
  SETUP_PROFILES,
  classifyEnvKey,
  deriveUnpooledUrl,
  evaluateProfileReadiness,
  formatEnvAssignment,
  generateCronSecret,
  isPlaceholderValue,
  isSetupProfileId,
  parseEnvAssignments,
  parseEnvValues,
  redactSecrets,
  upsertEnvContent,
  validateEnvironmentSchema,
  writeFileAtomic,
} from "./setup/environment";
export type {
  AtomicWriteIo,
  EnvAssignment,
  SetupProfile,
} from "./setup/environment";
export {
  detectProductionTarget,
  parseDatabaseIdentity,
  resolvePrismaDatabaseUrl,
  schemaCommandFor,
} from "./setup/database";
export type { DatabaseIdentity } from "./setup/database";
export {
  SetupCancelledError,
  createNonInteractivePrompter,
  createTerminalPrompter,
} from "./setup/prompts";
export type { SetupPrompter } from "./setup/prompts";
export {
  PROVIDER_ADAPTERS,
  resolveProviderAdapters,
} from "./setup/providers/catalog";
export {
  VERCEL_ENVIRONMENTS,
  publishToDestination,
} from "./setup/providers/publish";
export type {
  CommandResult,
  CommandRunner,
  PublishOutcome,
  PublishRequest,
  VercelEnvironment,
} from "./setup/providers/publish";
export type {
  ProbeContext,
  ProbeFetch,
  ProbeResult,
  ProviderAdapter,
  ProviderCapability,
  ProviderKey,
  ProviderPortability,
  PublishDestination,
} from "./setup/providers/types";
export { SETUP_STATE_FILE, readSetupState } from "./setup/state";
export type { SetupState } from "./setup/state";
export {
  VERIFICATION_LEVELS,
  parseVerifyFlag,
  runVerification,
} from "./setup/verification";
export type { VerificationLevel } from "./setup/verification";

function readEngines(root: string): { node?: string; npm?: string } {
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(root, "package.json"), "utf-8")
    ) as { engines?: { node?: string; npm?: string } };
    return pkg.engines ?? {};
  } catch {
    return {};
  }
}

/**
 * Checks the running Node.js against `engines.node` in the workspace's
 * `package.json`. Without a declared range, Node 22 or newer is accepted.
 */
export function validateNodeRuntime(root?: string): {
  valid: boolean;
  currentVersion: string;
  required: string;
} {
  const currentVersion = process.versions.node;
  const required = (root && readEngines(root).node) || ">=22.0.0";
  return {
    valid: satisfiesVersionRange(currentVersion, required),
    currentVersion,
    required,
  };
}

/**
 * Validate npm package manager enforcement
 */
export function validatePackageManager(): { valid: boolean; agent: string } {
  const agent = getEnv().npm_config_user_agent || "";
  const isBun =
    typeof (process.versions as Record<string, unknown>).bun !== "undefined" ||
    agent.startsWith("bun/");
  const isYarn = agent.startsWith("yarn/");
  const isPnpm = agent.startsWith("pnpm/");

  if (isBun || isYarn || isPnpm || (agent && !agent.startsWith("npm/"))) {
    return { valid: false, agent: agent || "unsupported package manager" };
  }
  return { valid: true, agent: agent || "npm" };
}

/**
 * Check lockfile integrity (package-lock.json must exist, no alternative lockfiles)
 */
export function validateLockfiles(root: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const pkgLock = path.join(root, "package-lock.json");
  if (!fs.existsSync(pkgLock)) {
    errors.push("Missing primary package-lock.json file.");
  }
  const prohibitedLocks = [
    "yarn.lock",
    "bun.lock",
    "bun.lockb",
    "pnpm-lock.yaml",
  ];
  for (const lock of prohibitedLocks) {
    if (fs.existsSync(path.join(root, lock))) {
      errors.push(`Prohibited alternative lockfile detected: ${lock}`);
    }
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Parses the `--shell-stages` hand-off from `scripts/setup.sh`, for example
 * `platform=completed;toolchain=completed;dependencies=skipped`. Unknown
 * stages or statuses are dropped.
 */
export function parseShellStages(
  value: string | undefined
): SetupStageRecord[] {
  if (!value) return [];
  const allowed: SetupStageStatus[] = [
    "completed",
    "skipped",
    "failed",
    "manual",
    "cancelled",
  ];
  const records: SetupStageRecord[] = [];
  for (const part of value.split(";")) {
    const [id, status, ...detail] = part.split("=");
    if (
      ["platform", "toolchain", "dependencies"].includes(id) &&
      (allowed as string[]).includes(status)
    ) {
      records.push({
        id: id as SetupStageId,
        status: status as SetupStageStatus,
        detail: detail.join("=") || "Reported by scripts/setup.sh.",
      });
    }
  }
  return records;
}

/** Runs a command without a shell; stdout and stderr are captured. */
export const runCommand: CommandRunner = (command, args, options = {}) =>
  new Promise((resolve) => {
    const child = spawn(command, [...args], {
      cwd: options.cwd,
      stdio: ["pipe", "pipe", "pipe"],
      shell: false,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", (error) =>
      resolve({ code: 127, stdout, stderr: stderr || error.message })
    );
    child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
    if (options.input !== undefined) child.stdin.write(options.input);
    child.stdin.end();
  });

/** Options for {@link runSetupWorkflow}. Every collaborator is injectable. */
export interface SetupOptions {
  workspaceRoot?: string;
  /** False runs without prompts. Kept for callers of the original API. */
  interactive?: boolean;
  /** With `interactive: false`, accept each question's safe default (`--yes`). */
  acceptDefaults?: boolean;
  profile?: SetupProfileId;
  dryRun?: boolean;
  resume?: boolean;
  skipDb?: boolean;
  skipDbSeed?: boolean;
  skipIntegrations?: boolean;
  /** Adapter ids to configure, e.g. `["clerk"]`. */
  integrations?: string[];
  /** Apply the schema without asking (`--apply-schema`). */
  applySchema?: boolean;
  /** Seed sample data without asking (`--seed`). */
  seed?: boolean;
  /** Exact database host allowed despite production markers. */
  allowProductionDb?: string;
  forceEnv?: boolean;
  verify?: VerificationLevel[];
  publish?: PublishDestination;
  publishEnvironment?: string;
  /** Stage results already reported by `scripts/setup.sh`. */
  shellStages?: SetupStageRecord[];
  prompter?: SetupPrompter;
  run?: CommandRunner;
  fetch?: ProbeFetch;
  log?: (line: string) => void;
  now?: () => Date;
  /**
   * The caller's process environment, consulted for database URL precedence
   * and production detection. The CLI passes `process.env`; omitted means none.
   */
  processEnv?: Readonly<Record<string, string | undefined>>;
}

function resolveRoot(options: SetupOptions): string {
  if (options.workspaceRoot) return options.workspaceRoot;
  if (getEnv().VITEST) {
    // Tests must never read the developer's real .env.local (#865).
    throw new Error(
      "runSetupWorkflow needs an explicit workspaceRoot under Vitest."
    );
  }
  return path.resolve(__dirname, "..", "..");
}

async function configureIntegration(
  adapter: ProviderAdapter,
  context: {
    root: string;
    prompter: SetupPrompter;
    dryRun: boolean;
    run: CommandRunner;
    publish?: PublishDestination;
    publishEnvironment?: string;
    log: (line: string) => void;
  }
): Promise<IntegrationOutcome> {
  const { root, prompter, log } = context;
  const envPath = path.join(root, ".env.local");
  const content = fs.existsSync(envPath)
    ? fs.readFileSync(envPath, "utf-8")
    : "";
  const values = parseEnvValues(content);
  const template = fs.existsSync(path.join(root, ".env.example"))
    ? parseEnvValues(fs.readFileSync(path.join(root, ".env.example"), "utf-8"))
    : {};

  log(`${adapter.name} (${adapter.capability})`);
  log(
    adapter.portability.portable
      ? `Portable: ${adapter.portability.note}`
      : `Platform-specific: ${adapter.portability.note}`
  );
  log(`If skipped: ${adapter.degraded}`);
  log(`Guide: ${adapter.docs}`);

  const updates: Record<string, string> = {};
  if (prompter.interactive) {
    const mode = await prompter.choose(
      "Guided dashboard steps, manual values, or skip",
      ["guided", "manual", "skip"] as const,
      "guided"
    );
    if (mode === "skip") {
      return {
        provider: adapter.id,
        status: "skipped",
        written: [],
        published: [],
        detail: adapter.degraded,
      };
    }
    for (const line of mode === "guided"
      ? adapter.guidedSteps
      : [adapter.manualPath]) {
      log(`  • ${line}`);
    }
    for (const key of adapter.keys) {
      const value = await collectEnvValue(
        key.name,
        prompter,
        values[key.name],
        template[key.name],
        key.hint
      );
      if (value !== undefined) updates[key.name] = value;
    }
  }

  const merged = { ...values, ...updates };
  const written = Object.keys(updates);
  if (written.length > 0 && !context.dryRun) {
    writeFileAtomic(envPath, upsertEnvContent(content, updates));
  }

  const check = adapter.validate(
    Object.fromEntries(
      Object.entries(merged).filter(
        ([key, value]) => !isPlaceholderValue(value, template[key])
      )
    )
  );

  const published: string[] = [];
  const destination =
    context.publish ??
    (prompter.interactive &&
    adapter.destinations.length > 0 &&
    check.status !== "not-checked"
      ? await prompter.choose(
          "Publish these values to a deployment destination",
          ["none", ...adapter.destinations] as const,
          "none"
        )
      : "none");
  if (destination !== "none" && adapter.destinations.includes(destination)) {
    const environment =
      context.publishEnvironment ??
      (destination === "vercel"
        ? await prompter.choose(
            "Vercel environment",
            ["development", "preview", "production"] as const,
            "development"
          )
        : await prompter.input(
            "GitHub Actions environment name (Enter for repository-wide):"
          ));
    if (context.dryRun) {
      log(`Dry run: would offer to publish to ${destination}.`);
    } else {
      const outcome = await publishToDestination(
        {
          destination,
          environment,
          values: merged,
          keys: adapter.keys.map((key) => key.name),
        },
        prompter,
        context.run
      );
      if (outcome.refused) log(`Not published: ${outcome.refused}`);
      if (outcome.published.length > 0) {
        published.push(`${destination}:${environment || "repository"}`);
        log(`Published ${outcome.published.join(", ")} to ${destination}.`);
      }
      if (outcome.failed.length > 0) {
        log(`Could not publish ${outcome.failed.join(", ")}.`);
      }
    }
  }

  const status: IntegrationOutcome["status"] =
    check.status === "not-checked"
      ? "degraded"
      : check.status === "failed"
        ? "manual"
        : "configured";
  return {
    provider: adapter.id,
    status,
    written: context.dryRun ? [] : written,
    published,
    detail: status === "degraded" ? adapter.degraded : check.detail,
  };
}

function databaseStageStatus(database: DatabaseStatus): {
  status: SetupStageStatus;
  detail: string;
} {
  const steps = [database.generate, database.schema, database.seed];
  const failed = steps.find((step) => step.status === "failed");
  if (failed) return { status: "failed", detail: failed.detail };
  const manual = steps.find((step) => step.status === "needs-manual-recovery");
  if (manual) return { status: "manual", detail: manual.detail };
  if (database.schema.status === "succeeded") {
    return {
      status: "completed",
      detail: `Schema applied to ${database.target}; seed ${database.seed.status}.`,
    };
  }
  return { status: "skipped", detail: database.schema.detail };
}

/**
 * Runs the application-level setup stages in order: toolchain, lockfile,
 * environment, integrations, database, verification. Each stage records a
 * status, the run never prints a credential value, and `.setup-state.json`
 * keeps non-secret progress so `--resume` can skip finished stages.
 */
export async function runSetupWorkflow(
  options: SetupOptions = {}
): Promise<SetupResult> {
  const root = resolveRoot(options);
  const log = options.log ?? ((line: string) => console.log(line));
  const now = options.now ?? (() => new Date());
  const run = options.run ?? runCommand;
  const prompter =
    options.prompter ??
    createNonInteractivePrompter(options.acceptDefaults ?? false);
  const dryRun = Boolean(options.dryRun);
  const state = readSetupState(root);
  let profileId: SetupProfileId | undefined =
    options.profile ?? (options.resume ? state.profile : undefined);
  if (!profileId && prompter.interactive) {
    for (const candidate of SETUP_PROFILE_IDS) {
      log(`${candidate}: ${SETUP_PROFILES[candidate].description}`);
    }
    profileId = await prompter.choose(
      "Environment profile",
      SETUP_PROFILE_IDS,
      "local-minimal"
    );
  }
  profileId = profileId ?? "local-minimal";
  const profile = SETUP_PROFILES[profileId];
  state.profile = profileId;

  const result: SetupResult = {
    success: false,
    profile: profile.id,
    dryRun,
    stages: [],
    environment: null,
    integrations: [],
    database: null,
    verification: [],
    summary: { completed: [], skipped: [], failed: [], manual: [] },
    errors: [],
  };

  const record = (
    id: SetupStageId,
    status: SetupStageStatus,
    detail: string
  ) => {
    const entry: SetupStageRecord = { id, status, detail };
    result.stages.push(entry);
    if (status === "failed" || status === "cancelled") {
      result.errors.push(`${id}: ${detail}`);
    }
    recordStage(state, entry, now());
  };
  const resumed = (id: SetupStageId) => {
    if (!options.resume || !canResumePast(state, id)) return false;
    result.stages.push({
      id,
      status: "completed",
      detail: "Completed in an earlier run (--resume).",
    });
    return true;
  };

  log(`Setup profile: ${profile.label}. ${profile.description}`);
  for (const shellStage of options.shellStages ?? []) {
    result.stages.push(shellStage);
    recordStage(state, shellStage, now());
  }

  let current: SetupStageId = "toolchain";
  try {
    if (!options.shellStages?.some((stage) => stage.id === "toolchain")) {
      const node = validateNodeRuntime(root);
      const manager = validatePackageManager();
      if (!node.valid) {
        record(
          "toolchain",
          "failed",
          `Node.js ${node.currentVersion} does not satisfy ${node.required}.`
        );
      } else if (!manager.valid) {
        record(
          "toolchain",
          "failed",
          `Unsupported package manager (${manager.agent}); npm is the only supported one.`
        );
      } else {
        record(
          "toolchain",
          "completed",
          `Node.js ${node.currentVersion} and npm.`
        );
      }
    }

    current = "lockfile";
    const lock = validateLockfiles(root);
    record(
      "lockfile",
      lock.valid ? "completed" : "failed",
      lock.valid
        ? "package-lock.json is the only lockfile."
        : lock.errors.join(" ")
    );

    if (result.stages.some((stage) => stage.status === "failed")) {
      return finish(result, state, root, dryRun);
    }

    current = "environment";
    if (!resumed("environment")) {
      const environment = await runEnvironmentStage({
        root,
        profile,
        prompter,
        dryRun,
        skipDb: Boolean(options.skipDb),
        forceEnv: Boolean(options.forceEnv),
        log,
        now,
      });
      result.environment = environment;
      if (!environment.schemaValid) {
        record("environment", "failed", environment.schemaErrors.join(" "));
      } else if (!environment.requiredReady) {
        record(
          "environment",
          "manual",
          `Still needs real values for ${environment.missingRequired.join(", ")}.`
        );
      } else {
        record(
          "environment",
          "completed",
          `Required ${profile.id} values are set${
            environment.missingOptional.length > 0
              ? `; optional and unset: ${environment.missingOptional.join(", ")}`
              : ""
          }.`
        );
      }
    }

    current = "integrations";
    if (options.skipIntegrations) {
      record(
        "integrations",
        "skipped",
        "Skipped (--skip-integrations); every integration runs in its degraded mode."
      );
    } else if (!resumed("integrations")) {
      const { adapters, unknown } = resolveProviderAdapters(
        options.integrations ?? []
      );
      if (unknown.length > 0) {
        record(
          "integrations",
          "failed",
          `Unknown integration(s): ${unknown.join(", ")}. Known: ${PROVIDER_ADAPTERS.map((a) => a.id).join(", ")}.`
        );
      } else {
        let selected = adapters;
        if (selected.length === 0 && prompter.interactive) {
          selected = [];
          for (const adapter of PROVIDER_ADAPTERS) {
            if (
              await prompter.confirm(
                `Configure ${adapter.name} (${adapter.capability}) now?`,
                false
              )
            ) {
              selected.push(adapter);
            }
          }
        }
        for (const adapter of selected) {
          result.integrations.push(
            await configureIntegration(adapter, {
              root,
              prompter,
              dryRun,
              run,
              publish: options.publish,
              publishEnvironment: options.publishEnvironment,
              log,
            })
          );
        }
        const pending = result.integrations.filter(
          (outcome) => outcome.status === "manual"
        );
        if (selected.length === 0) {
          record(
            "integrations",
            "skipped",
            "No integrations selected; each runs in its degraded mode."
          );
        } else if (pending.length > 0) {
          record(
            "integrations",
            "manual",
            `Needs attention: ${pending.map((outcome) => `${outcome.provider} (${outcome.detail})`).join("; ")}`
          );
        } else {
          record(
            "integrations",
            "completed",
            result.integrations
              .map((outcome) => `${outcome.provider}: ${outcome.status}`)
              .join(", ")
          );
        }
      }
    }

    current = "database";
    if (options.skipDb) {
      record("database", "skipped", "Skipped (--skip-db).");
    } else if (!resumed("database")) {
      const envPath = path.join(root, ".env.local");
      const fileValues = fs.existsSync(envPath)
        ? parseEnvValues(fs.readFileSync(envPath, "utf-8"))
        : {};
      const processEnv = options.processEnv ?? {};
      const database = await runDatabaseStage({
        databaseUrl: resolvePrismaDatabaseUrl(fileValues, processEnv),
        profileAllowsMutation: profile.allowsDatabaseMutation,
        prompter,
        run,
        root,
        dryRun,
        applySchema: Boolean(options.applySchema),
        seed: Boolean(options.seed),
        skipSeed: Boolean(options.skipDbSeed),
        allowProductionHost: options.allowProductionDb,
        vercelEnv: processEnv.VERCEL_ENV ?? fileValues.VERCEL_ENV,
        nodeEnv: processEnv.NODE_ENV ?? fileValues.NODE_ENV,
        log,
      });
      result.database = database;
      const outcome = databaseStageStatus(database);
      record("database", outcome.status, outcome.detail);
    }

    current = "verification";
    const envPath = path.join(root, ".env.local");
    const finalValues = fs.existsSync(envPath)
      ? parseEnvValues(fs.readFileSync(envPath, "utf-8"))
      : {};
    const template = fs.existsSync(path.join(root, ".env.example"))
      ? parseEnvValues(
          fs.readFileSync(path.join(root, ".env.example"), "utf-8")
        )
      : {};
    const realValues = Object.fromEntries(
      Object.entries(finalValues).filter(
        ([key, value]) => !isPlaceholderValue(value, template[key])
      )
    );
    result.verification = await runVerification({
      root,
      requested: options.verify ?? [],
      values: realValues,
      prompter,
      run,
      fetch: options.fetch ?? ((url, init) => fetch(url, init)),
      dryRun,
      log,
    });
    const failedChecks = result.verification.filter(
      (check) => check.status === "failed"
    );
    const ran = result.verification.filter(
      (check) => check.status !== "not-checked"
    );
    if (failedChecks.length > 0) {
      record(
        "verification",
        "failed",
        failedChecks.map((check) => `${check.label}: ${check.detail}`).join(" ")
      );
    } else if (ran.length === 0) {
      record("verification", "skipped", "No checks requested (see --verify).");
    } else {
      record("verification", "completed", `${ran.length} check(s) ran.`);
    }
  } catch (error) {
    if (error instanceof SetupCancelledError) {
      record(
        current,
        "cancelled",
        "Cancelled; rerun with --resume to continue."
      );
    } else {
      record(current, "failed", (error as Error).message);
    }
  }

  return finish(result, state, root, dryRun);
}

function finish(
  result: SetupResult,
  state: ReturnType<typeof readSetupState>,
  root: string,
  dryRun: boolean
): SetupResult {
  for (const stage of result.stages) {
    if (stage.status === "cancelled") continue;
    result.summary[stage.status].push(stage.id);
  }
  result.success = !result.stages.some(
    (stage) => stage.status === "failed" || stage.status === "cancelled"
  );
  if (!dryRun) {
    try {
      writeSetupState(root, state);
    } catch {
      // Progress is a convenience; failing to save it never fails setup.
    }
  }
  return result;
}
