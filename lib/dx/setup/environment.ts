import crypto from "crypto";
import fs from "fs";
import path from "path";
import { validateEnv } from "../../env";
import type {
  EnvKeyClassification,
  EnvironmentStatus,
  SetupProfileId,
} from "./types";
import type { SetupPrompter } from "./prompts";

/**
 * Classification of every key in `.env.example`. A test asserts that each
 * template key appears here, so a new variable cannot slip through as an
 * unclassified (and therefore unredacted) value.
 */
export const ENV_KEY_CLASSIFICATION: Readonly<
  Record<string, EnvKeyClassification>
> = {
  DATABASE_URL: { kind: "secret", secret: true },
  DATABASE_URL_UNPOOLED: { kind: "derived", secret: true },
  DIRECT_URL: { kind: "derived", secret: true },
  PGHOST: { kind: "derived", secret: false },
  PGHOST_UNPOOLED: { kind: "derived", secret: false },
  PGUSER: { kind: "derived", secret: false },
  PGDATABASE: { kind: "derived", secret: false },
  PGPASSWORD: { kind: "derived", secret: true },
  POSTGRES_URL: { kind: "derived", secret: true },
  POSTGRES_URL_NON_POOLING: { kind: "derived", secret: true },
  POSTGRES_USER: { kind: "derived", secret: false },
  POSTGRES_HOST: { kind: "derived", secret: false },
  POSTGRES_PASSWORD: { kind: "derived", secret: true },
  POSTGRES_DATABASE: { kind: "derived", secret: false },
  POSTGRES_URL_NO_SSL: { kind: "derived", secret: true },
  POSTGRES_PRISMA_URL: { kind: "derived", secret: true },
  UPSTASH_REDIS_REST_URL: { kind: "optional", secret: false },
  UPSTASH_REDIS_REST_TOKEN: { kind: "secret", secret: true },
  UPSTASH_REDIS_KEY_PREFIX: { kind: "optional", secret: false },
  CI: { kind: "runtime-managed", secret: false },
  PLAYWRIGHT_TEST: { kind: "runtime-managed", secret: false },
  PLAYWRIGHT_BROWSERS_PATH: { kind: "runtime-managed", secret: false },
  npm_config_user_agent: { kind: "runtime-managed", secret: false },
  SKIP_DB_HEALTH_CHECK: { kind: "runtime-managed", secret: false },
  ALLOW_DESTRUCTIVE_MIGRATIONS: { kind: "runtime-managed", secret: false },
  NEXT_PHASE: { kind: "runtime-managed", secret: false },
  NEXT_RUNTIME: { kind: "runtime-managed", secret: false },
  GITHUB_ACTIONS: { kind: "runtime-managed", secret: false },
  VITEST: { kind: "runtime-managed", secret: false },
  CRON_SECRET: { kind: "generated", secret: true },
  GITHUB_TOKEN: { kind: "secret", secret: true },
  SENTRY_ORG: { kind: "optional", secret: false },
  SENTRY_PROJECT: { kind: "optional", secret: false },
  NEXT_PUBLIC_SENTRY_DSN: { kind: "public", secret: false },
  NEXT_PUBLIC_APP_URL: { kind: "public", secret: false },
  QSTASH_URL: { kind: "optional", secret: false },
  QSTASH_TOKEN: { kind: "secret", secret: true },
  QSTASH_CURRENT_SIGNING_KEY: { kind: "secret", secret: true },
  QSTASH_NEXT_SIGNING_KEY: { kind: "secret", secret: true },
  CLERK_SECRET_KEY: { kind: "secret", secret: true },
  BLOB_READ_WRITE_TOKEN: { kind: "secret", secret: true },
  ADMIN_USER_IDS: { kind: "optional", secret: false },
  ADMIN_EMAILS: { kind: "optional", secret: false },
  RESEND_API_KEY: { kind: "secret", secret: true },
  RESEND_WEBHOOK_SECRET: { kind: "secret", secret: true },
  RESEND_FROM_EMAIL: { kind: "optional", secret: false },
  CONTACT_NOTIFICATION_EMAIL: { kind: "optional", secret: false },
  ALLOW_FALLBACK_PRODUCTION_BUILD: { kind: "runtime-managed", secret: false },
  WS_NO_BUFFER_UTIL: { kind: "runtime-managed", secret: false },
  WS_NO_UTF_8_VALIDATE: { kind: "runtime-managed", secret: false },
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: { kind: "public", secret: false },
};

const SECRET_NAME_PATTERN = /SECRET|TOKEN|PASSWORD|KEY|DATABASE_URL|_URL$/;

/**
 * Classifies a key. Unknown keys fail safe: anything whose name looks like
 * a credential is treated as a secret.
 */
export function classifyEnvKey(key: string): EnvKeyClassification {
  const known = ENV_KEY_CLASSIFICATION[key];
  if (known) return known;
  if (key.startsWith("NEXT_PUBLIC_")) return { kind: "public", secret: false };
  return SECRET_NAME_PATTERN.test(key)
    ? { kind: "secret", secret: true }
    : { kind: "optional", secret: false };
}

/**
 * Substrings that only ever appear in example or fallback values. Kept in
 * step with `scripts/vercel-production-preflight.js` by a test.
 */
export const PLACEHOLDER_MARKERS = [
  "dummy",
  "placeholder",
  "changeme",
  "change_me",
  "example",
  "local_secret",
  "local_user",
  "dev_cron_secret",
  "your_",
  "your-",
  "xxxxx",
] as const;

/**
 * True when a value is empty or is an example credential rather than real
 * configuration. A value copied unchanged from `.env.example` counts as a
 * placeholder even if it has no marker.
 */
export function isPlaceholderValue(
  value: string | undefined,
  templateValue?: string
): boolean {
  if (value === undefined) return true;
  const trimmed = value.trim();
  if (trimmed === "") return true;
  if (templateValue !== undefined && trimmed === templateValue.trim()) {
    return true;
  }
  const lower = trimmed.toLowerCase();
  return PLACEHOLDER_MARKERS.some((marker) => lower.includes(marker));
}

/** One environment profile and the keys it needs. */
export interface SetupProfile {
  id: SetupProfileId;
  label: string;
  description: string;
  /** Keys that must hold a real value for the profile to be ready. */
  required: readonly string[];
  /** Keys reported when unset, without blocking. */
  optional: readonly string[];
  /** Whether this profile may mutate a database during setup. */
  allowsDatabaseMutation: boolean;
}

/** The three profiles offered to a fresh clone. */
export const SETUP_PROFILES: Readonly<Record<SetupProfileId, SetupProfile>> = {
  "local-minimal": {
    id: "local-minimal",
    label: "Local, minimal",
    description:
      "Local development against your own Postgres. Optional integrations stay off and run in their degraded modes.",
    required: ["DATABASE_URL", "CRON_SECRET"],
    optional: ["GITHUB_TOKEN"],
    allowsDatabaseMutation: true,
  },
  "hosted-development": {
    id: "hosted-development",
    label: "Hosted development",
    description:
      "An external development database (for example a Neon branch) plus whichever providers you choose to configure.",
    required: ["DATABASE_URL", "DATABASE_URL_UNPOOLED", "CRON_SECRET"],
    optional: [
      "UPSTASH_REDIS_REST_URL",
      "UPSTASH_REDIS_REST_TOKEN",
      "GITHUB_TOKEN",
      "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
      "CLERK_SECRET_KEY",
      "RESEND_API_KEY",
      "NEXT_PUBLIC_SENTRY_DSN",
    ],
    allowsDatabaseMutation: true,
  },
  deployment: {
    id: "deployment",
    label: "Deployment inventory",
    description:
      "Checks the configuration a deployment needs and hands values to a provider only when you choose a destination. Never mutates a database.",
    required: [
      "DATABASE_URL",
      "DATABASE_URL_UNPOOLED",
      "CRON_SECRET",
      "UPSTASH_REDIS_REST_URL",
      "UPSTASH_REDIS_REST_TOKEN",
    ],
    optional: [
      "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
      "CLERK_SECRET_KEY",
      "RESEND_API_KEY",
      "RESEND_WEBHOOK_SECRET",
      "NEXT_PUBLIC_SENTRY_DSN",
      "BLOB_READ_WRITE_TOKEN",
      "GITHUB_TOKEN",
    ],
    allowsDatabaseMutation: false,
  },
};

/** True when `value` names one of {@link SETUP_PROFILES}. */
export function isSetupProfileId(value: unknown): value is SetupProfileId {
  return typeof value === "string" && value in SETUP_PROFILES;
}

/** One `KEY=value` assignment and the line it sits on. */
export interface EnvAssignment {
  key: string;
  value: string;
  line: number;
}

const ASSIGNMENT_PATTERN =
  /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/;

function unquote(raw: string): string {
  const value = raw.trim();
  if (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];
    if ((first === '"' || first === "'") && first === last) {
      const inner = value.slice(1, -1);
      return first === '"' ? inner.replace(/\\\$/g, "$") : inner;
    }
  }
  // Strip an inline comment from an unquoted value.
  const hash = value.search(/\s#/);
  return hash === -1 ? value : value.slice(0, hash).trim();
}

/** Parses dotenv content into assignments, in file order. */
export function parseEnvAssignments(content: string): EnvAssignment[] {
  const assignments: EnvAssignment[] = [];
  content.split(/\r?\n/).forEach((text, line) => {
    if (/^\s*#/.test(text)) return;
    const match = text.match(ASSIGNMENT_PATTERN);
    if (match) {
      assignments.push({ key: match[1], value: unquote(match[2]), line });
    }
  });
  return assignments;
}

/** Parses dotenv content into a key → value map; the last assignment wins. */
export function parseEnvValues(content: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const { key, value } of parseEnvAssignments(content)) {
    values[key] = value;
  }
  return values;
}

/**
 * Formats one assignment. Values are double-quoted, with `$` escaped so
 * Next.js's dotenv expansion leaves passwords containing `$` intact. A value
 * holding a quote or a line break cannot round-trip safely and is refused.
 */
export function formatEnvAssignment(key: string, value: string): string {
  if (/["\r\n]/.test(value)) {
    throw new Error(
      `${key} contains a quote or line break and cannot be written safely; edit .env.local by hand.`
    );
  }
  return `${key}="${value.replace(/\$/g, "\\$")}"`;
}

/**
 * Applies `updates` to dotenv `content` and returns the new text. Existing
 * assignments are replaced on the line they occupy (the last one, if a key
 * repeats); new keys are appended. Comments, blank lines and unrelated
 * values are kept byte for byte.
 */
export function upsertEnvContent(
  content: string,
  updates: Readonly<Record<string, string>>
): string {
  const lines = content === "" ? [] : content.split("\n");
  const trailingNewline = content.endsWith("\n");
  if (trailingNewline) lines.pop();

  const lastLine = new Map<string, number>();
  for (const { key, line } of parseEnvAssignments(lines.join("\n"))) {
    lastLine.set(key, line);
  }

  const appended: string[] = [];
  for (const [key, value] of Object.entries(updates)) {
    const formatted = formatEnvAssignment(key, value);
    const index = lastLine.get(key);
    if (index === undefined) {
      appended.push(formatted);
    } else {
      lines[index] = formatted;
    }
  }

  const next = [...lines, ...appended];
  return next.length === 0 ? "" : `${next.join("\n")}\n`;
}

/** File operations used by {@link writeFileAtomic}; injectable for tests. */
export interface AtomicWriteIo {
  writeFileSync(file: string, data: string, options: { mode: number }): void;
  renameSync(from: string, to: string): void;
  rmSync(file: string, options: { force: boolean }): void;
}

const nodeIo: AtomicWriteIo = {
  writeFileSync: (file, data, options) =>
    fs.writeFileSync(file, data, { mode: options.mode }),
  renameSync: (from, to) => fs.renameSync(from, to),
  rmSync: (file, options) => fs.rmSync(file, options),
};

/**
 * Writes `content` to `target` through a temporary file in the same
 * directory and a rename, so a crash or a failed write never leaves a
 * half-written `.env.local`. The file is created owner-readable only.
 */
export function writeFileAtomic(
  target: string,
  content: string,
  io: AtomicWriteIo = nodeIo
): void {
  const temp = path.join(
    path.dirname(target),
    `.${path.basename(target)}.${process.pid}.${crypto.randomBytes(4).toString("hex")}.tmp`
  );
  try {
    io.writeFileSync(temp, content, { mode: 0o600 });
    io.renameSync(temp, target);
  } catch (error) {
    io.rmSync(temp, { force: true });
    throw error;
  }
}

/** Generates a 256-bit, URL-safe secret for `CRON_SECRET`. */
export function generateCronSecret(): string {
  return crypto.randomBytes(32).toString("base64url");
}

/**
 * Replaces every occurrence of a secret value in `text` with `[redacted]`.
 * Used on subprocess output before it is shown, in case a tool echoes a
 * value back.
 */
export function redactSecrets(
  text: string,
  values: Readonly<Record<string, string>>
): string {
  let result = text;
  for (const [key, value] of Object.entries(values)) {
    if (!classifyEnvKey(key).secret) continue;
    if (value.trim().length < 4) continue;
    result = result.split(value).join("[redacted]");
  }
  return result;
}

/**
 * Validates present values against the `lib/env.ts` schema. Reports key
 * names and schema messages only.
 */
export function validateEnvironmentSchema(
  values: Readonly<Record<string, string>>
): { valid: boolean; errors: string[] } {
  const result = validateEnv({ ...values });
  const errors = Object.entries(result.errors).map(
    ([key, messages]) => `${key}: ${messages.join("; ")}`
  );
  return { valid: result.success, errors };
}

/**
 * Reports which of a profile's required and optional keys still hold no
 * real value. With `skipDb`, database keys stop being required because
 * nothing in the run will connect to a database.
 */
export function evaluateProfileReadiness(
  profile: SetupProfile,
  values: Readonly<Record<string, string>>,
  template: Readonly<Record<string, string>> = {},
  options: { skipDb?: boolean } = {}
): {
  requiredReady: boolean;
  missingRequired: string[];
  optionalReady: boolean;
  missingOptional: string[];
} {
  const databaseKeys = new Set([
    "DATABASE_URL",
    "DATABASE_URL_UNPOOLED",
    "DIRECT_URL",
  ]);
  const required = profile.required.filter(
    (key) => !(options.skipDb && databaseKeys.has(key))
  );
  const missingRequired = required.filter((key) =>
    isPlaceholderValue(values[key], template[key])
  );
  const missingOptional = profile.optional.filter((key) =>
    isPlaceholderValue(values[key], template[key])
  );
  return {
    requiredReady: missingRequired.length === 0,
    missingRequired,
    optionalReady: missingOptional.length === 0,
    missingOptional,
  };
}

/**
 * Derives the direct (unpooled) Postgres endpoint from a pooled one. Neon
 * marks its pooler with a `-pooler` host suffix; other providers usually
 * expose one endpoint, so the URL is returned unchanged.
 */
export function deriveUnpooledUrl(databaseUrl: string): string | null {
  try {
    const url = new URL(databaseUrl);
    if (!["postgres:", "postgresql:"].includes(url.protocol)) return null;
    url.hostname = url.hostname.replace("-pooler.", ".");
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Asks for one value. When the key already holds a real value the user is
 * first asked, by name only, whether to replace it. Returns `undefined` when
 * nothing should change.
 */
export async function collectEnvValue(
  key: string,
  prompter: SetupPrompter,
  current: string | undefined,
  template?: string,
  hint?: string
): Promise<string | undefined> {
  if (!prompter.interactive) return undefined;
  const hasRealValue = !isPlaceholderValue(current, template);
  if (
    hasRealValue &&
    !(await prompter.confirm(`${key} is already set. Replace it?`, false))
  ) {
    return undefined;
  }
  const label = hint ? `${key} (${hint}):` : `${key}:`;
  const value = classifyEnvKey(key).secret
    ? await prompter.secret(label)
    : await prompter.input(label);
  return value === "" ? undefined : value;
}

/** Inputs to {@link runEnvironmentStage}. */
export interface EnvironmentStageOptions {
  root: string;
  profile: SetupProfile;
  prompter: SetupPrompter;
  dryRun: boolean;
  skipDb: boolean;
  /** Replace `.env.local` with the template after backing it up. */
  forceEnv: boolean;
  log: (line: string) => void;
  now?: () => Date;
}

/**
 * Creates or updates `.env.local` for a profile: copies the template when
 * the file is missing, generates `CRON_SECRET`, derives the unpooled
 * database URL, asks for required values the profile still lacks, then
 * reports template creation, schema validity and readiness separately.
 */
export async function runEnvironmentStage(
  options: EnvironmentStageOptions
): Promise<EnvironmentStatus> {
  const { root, profile, prompter, dryRun, log } = options;
  const envPath = path.join(root, ".env.local");
  const examplePath = path.join(root, ".env.example");
  const status: EnvironmentStatus = {
    templateCreated: false,
    schemaValid: false,
    schemaErrors: [],
    requiredReady: false,
    missingRequired: [],
    optionalReady: false,
    missingOptional: [],
    userSkipped: [],
    written: [],
    kept: [],
  };

  if (!fs.existsSync(examplePath)) {
    status.schemaErrors.push(".env.example is missing.");
    return status;
  }
  const templateText = fs.readFileSync(examplePath, "utf-8");
  const template = parseEnvValues(templateText);

  let content = fs.existsSync(envPath)
    ? fs.readFileSync(envPath, "utf-8")
    : null;

  if (content !== null && options.forceEnv) {
    const stamp = (options.now?.() ?? new Date())
      .toISOString()
      .replace(/[:.]/g, "-");
    const backup = `.env.local.backup-${stamp}`;
    if (dryRun) {
      log(
        `Would back up .env.local to ${backup} and replace it with the template.`
      );
    } else {
      fs.copyFileSync(envPath, path.join(root, backup));
      fs.chmodSync(path.join(root, backup), 0o600);
      log(`Backed up .env.local to ${backup}.`);
    }
    status.backupPath = backup;
    content = null;
  }

  if (content === null) {
    content = templateText;
    status.templateCreated = true;
    log(
      dryRun
        ? "Would create .env.local from .env.example."
        : "Creating .env.local from .env.example."
    );
  }

  const values = parseEnvValues(content);
  const updates: Record<string, string> = {};

  const needsValue = (key: string) =>
    isPlaceholderValue(values[key], template[key]);

  if (profile.required.includes("CRON_SECRET") && needsValue("CRON_SECRET")) {
    updates.CRON_SECRET = generateCronSecret();
    log("Generated a new CRON_SECRET.");
  }

  for (const key of profile.required) {
    if (key === "CRON_SECRET" || !needsValue(key)) continue;
    if (
      options.skipDb &&
      ["DATABASE_URL", "DATABASE_URL_UNPOOLED", "DIRECT_URL"].includes(key)
    ) {
      continue;
    }
    if (key === "DATABASE_URL_UNPOOLED") {
      const source = updates.DATABASE_URL ?? values.DATABASE_URL;
      if (source && !isPlaceholderValue(source, template.DATABASE_URL)) {
        const derived = deriveUnpooledUrl(source);
        if (derived) {
          updates.DATABASE_URL_UNPOOLED = derived;
          log("Derived DATABASE_URL_UNPOOLED from DATABASE_URL.");
          continue;
        }
      }
    }
    const value = await collectEnvValue(
      key,
      prompter,
      values[key],
      template[key]
    );
    if (value === undefined) {
      if (prompter.interactive) status.userSkipped.push(key);
    } else {
      updates[key] = value;
    }
  }

  // prisma.config.ts prefers DIRECT_URL over every other database key, so a
  // DIRECT_URL left at its example value would send migrations to the
  // template's localhost database instead of the one just configured.
  const pooled = updates.DATABASE_URL ?? values.DATABASE_URL;
  if (
    !options.skipDb &&
    needsValue("DIRECT_URL") &&
    pooled &&
    !isPlaceholderValue(pooled, template.DATABASE_URL)
  ) {
    const direct =
      updates.DATABASE_URL_UNPOOLED ??
      (isPlaceholderValue(
        values.DATABASE_URL_UNPOOLED,
        template.DATABASE_URL_UNPOOLED
      )
        ? deriveUnpooledUrl(pooled)
        : values.DATABASE_URL_UNPOOLED);
    if (direct) {
      updates.DIRECT_URL = direct;
      log(
        "Set DIRECT_URL to the direct endpoint so migrations target the same database."
      );
    }
  }

  for (const key of Object.keys(values)) {
    if (!(key in updates) && !isPlaceholderValue(values[key], template[key])) {
      status.kept.push(key);
    }
  }

  const nextContent =
    Object.keys(updates).length > 0
      ? upsertEnvContent(content, updates)
      : content;

  if (!dryRun && (status.templateCreated || Object.keys(updates).length > 0)) {
    writeFileAtomic(envPath, nextContent);
  }
  status.written = dryRun ? [] : Object.keys(updates);

  const finalValues = parseEnvValues(nextContent);
  const schema = validateEnvironmentSchema(finalValues);
  status.schemaValid = schema.valid;
  status.schemaErrors = schema.errors;

  const readiness = evaluateProfileReadiness(profile, finalValues, template, {
    skipDb: options.skipDb,
  });
  Object.assign(status, readiness);
  return status;
}
