/* eslint-disable @typescript-eslint/no-require-imports, no-console */
// Production-only configuration preflight (#989), run by scripts/build.js
// before it substitutes offline fallbacks or applies migrations.
//
// A production build that is missing configuration otherwise succeeds: the
// build falls back to dummy values, and the site then fails at request time.
// This check fails the Vercel production build instead, while the previous
// deployment keeps serving.
//
// It reports variable names and reasons only. Never add a message that
// interpolates a value: build logs are readable by everyone on the Vercel
// team and are kept after the deployment is gone.
//
// The groups mirror the Environment Variables matrix in
// docs/how-to/release-and-deploy.md.

// Must match the production fallback in resolveBaseUrl (lib/domain.ts).
const CANONICAL_URL = "https://deruiter.dev";

const ALWAYS_REQUIRED = [
  "DATABASE_URL",
  "DATABASE_URL_UNPOOLED",
  "CRON_SECRET",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "NODE_OPTIONS",
];

// Each feature is off until one of its trigger variables is set; once it is on,
// every variable in `requires` must be set too.
const FEATURE_GROUPS = [
  {
    feature: "Admin area (Clerk)",
    triggers: [
      "ADMIN_USER_IDS",
      "ADMIN_EMAILS",
      "CLERK_SECRET_KEY",
      "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
    ],
    requires: ["CLERK_SECRET_KEY", "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"],
  },
  {
    feature: "Sentry source-map upload",
    triggers: ["SENTRY_ORG", "SENTRY_PROJECT", "SENTRY_AUTH_TOKEN"],
    requires: ["SENTRY_ORG", "SENTRY_PROJECT", "SENTRY_AUTH_TOKEN"],
  },
];

// Unset is allowed; the build notes what is degraded.
const OPTIONAL = [
  ["RESEND_API_KEY", "email delivery is simulated"],
  ["RESEND_WEBHOOK_SECRET", "Resend webhooks are rejected"],
  ["NEXT_PUBLIC_SENTRY_DSN", "Sentry events are dropped"],
  ["BLOB_READ_WRITE_TOKEN", "admin media uploads are unavailable"],
];

// Values that only ever come from .env.example, scripts/build.js's offline
// fallbacks or a tutorial. Matched case-insensitively as substrings.
const PLACEHOLDER_MARKERS = [
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
];

const LOCAL_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "[::1]",
]);

function isSet(env, name) {
  return typeof env[name] === "string" && env[name].trim() !== "";
}

function looksLikePlaceholder(value) {
  const lower = value.toLowerCase();
  return PLACEHOLDER_MARKERS.some((marker) => lower.includes(marker));
}

function parseUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function checkPostgresUrl(env, name, problems) {
  const url = parseUrl(env[name]);
  if (!url || !["postgres:", "postgresql:"].includes(url.protocol)) {
    problems.push({ name, reason: "is not a postgres:// connection string" });
  } else if (LOCAL_HOSTS.has(url.hostname)) {
    problems.push({ name, reason: "points at a local database" });
  }
}

function checkShapes(env, problems) {
  for (const name of ["DATABASE_URL", "DATABASE_URL_UNPOOLED"]) {
    if (isSet(env, name)) checkPostgresUrl(env, name, problems);
  }

  if (isSet(env, "UPSTASH_REDIS_REST_URL")) {
    const url = parseUrl(env.UPSTASH_REDIS_REST_URL);
    if (!url || url.protocol !== "https:") {
      problems.push({
        name: "UPSTASH_REDIS_REST_URL",
        reason: "is not an https:// URL",
      });
    } else if (LOCAL_HOSTS.has(url.hostname)) {
      problems.push({
        name: "UPSTASH_REDIS_REST_URL",
        reason: "points at a local server",
      });
    }
  }

  if (
    isSet(env, "NODE_OPTIONS") &&
    !env.NODE_OPTIONS.split(/\s+/).includes("--experimental-require-module")
  ) {
    problems.push({
      name: "NODE_OPTIONS",
      reason:
        "does not include --experimental-require-module, which server rendering needs (#995)",
    });
  }

  if (
    isSet(env, "CLERK_SECRET_KEY") &&
    env.CLERK_SECRET_KEY.startsWith("sk_test_")
  ) {
    problems.push({
      name: "CLERK_SECRET_KEY",
      reason: "is a Clerk development key (sk_test_)",
    });
  }
  if (
    isSet(env, "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY") &&
    env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.startsWith("pk_test_")
  ) {
    problems.push({
      name: "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
      reason: "is a Clerk development key (pk_test_)",
    });
  }

  if (isSet(env, "NEXT_PUBLIC_APP_URL")) {
    const configured = env.NEXT_PUBLIC_APP_URL.trim().replace(/\/$/, "");
    if (configured !== CANONICAL_URL) {
      problems.push({
        name: "NEXT_PUBLIC_APP_URL",
        reason: `must be ${CANONICAL_URL} or unset`,
      });
    }
  }
}

/**
 * Checks a production environment. Returns problems (which fail the build) and
 * notes (degraded optional features). Neither ever contains a value.
 */
function checkVercelProductionEnv(env) {
  const problems = [];
  const notes = [];

  for (const name of ALWAYS_REQUIRED) {
    if (!isSet(env, name)) problems.push({ name, reason: "is not set" });
  }

  for (const group of FEATURE_GROUPS) {
    if (!group.triggers.some((name) => isSet(env, name))) continue;
    for (const name of group.requires) {
      if (!isSet(env, name)) {
        problems.push({
          name,
          reason: `is not set, but ${group.feature} is configured`,
        });
      }
    }
  }

  checkShapes(env, problems);

  // Placeholder check covers every variable this preflight knows about.
  const known = new Set([
    ...ALWAYS_REQUIRED,
    ...FEATURE_GROUPS.flatMap((group) => group.requires),
    ...OPTIONAL.map(([name]) => name),
  ]);
  for (const name of known) {
    if (isSet(env, name) && looksLikePlaceholder(env[name])) {
      problems.push({ name, reason: "holds a placeholder or example value" });
    }
  }

  for (const [name, effect] of OPTIONAL) {
    if (!isSet(env, name))
      notes.push({ name, reason: `is not set, so ${effect}` });
  }

  return { problems, notes };
}

function shouldRunPreflight(env) {
  return env.VERCEL === "1" && env.VERCEL_ENV === "production";
}

/**
 * Authenticates the configured Upstash REST credentials with a bounded PING.
 * The result and any error intentionally contain no credential values.
 */
async function verifyUpstashCredentials(env = process.env, fetchImpl = fetch) {
  const urlValue = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;
  if (
    !isSet(env, "UPSTASH_REDIS_REST_URL") ||
    !isSet(env, "UPSTASH_REDIS_REST_TOKEN")
  ) {
    const name = isSet(env, "UPSTASH_REDIS_REST_URL")
      ? "UPSTASH_REDIS_REST_TOKEN"
      : "UPSTASH_REDIS_REST_URL";
    return { ok: false, name, reason: "is not configured" };
  }

  const baseUrl = parseUrl(urlValue);
  if (!baseUrl || baseUrl.protocol !== "https:") {
    return {
      ok: false,
      name: "UPSTASH_REDIS_REST_URL",
      reason: "is not a valid HTTPS URL",
    };
  }

  const pingUrl = new URL(baseUrl.toString());
  pingUrl.pathname = `${pingUrl.pathname.replace(/\/$/, "")}/ping`;
  pingUrl.search = "";
  pingUrl.hash = "";

  try {
    const response = await fetchImpl(pingUrl, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) {
      return response.status === 401 || response.status === 403
        ? {
            ok: false,
            name: "UPSTASH_REDIS_REST_TOKEN",
            reason: "was rejected by Upstash",
          }
        : {
            ok: false,
            name: "UPSTASH_REDIS_REST_URL",
            reason: `returned HTTP ${response.status}`,
          };
    }

    const payload = await response.json();
    if (payload?.result !== "PONG") {
      return {
        ok: false,
        name: "UPSTASH_REDIS_REST_URL",
        reason: "did not return the expected PONG response",
      };
    }
    return { ok: true };
  } catch {
    return {
      ok: false,
      name: "UPSTASH_REDIS_REST_URL",
      reason: "could not complete a PING within 3 seconds",
    };
  }
}

function defaultExec(prog, args, options) {
  const { execFileSync } = require("child_process");
  return execFileSync(prog, args, options);
}

/**
 * Evaluates Vercel storage headroom before production releases.
 * Fails fast if critical storage thresholds (>=95%) are breached or if meters are stale/unreadable.
 */
async function verifyVercelHeadroomCapacity(
  env = process.env,
  logger = console,
  execFn = defaultExec
) {
  if (!env.VERCEL_TOKEN) {
    logger.error(
      "Production preflight failed: VERCEL_TOKEN is not set; Vercel headroom capacity check cannot run."
    );
    return false;
  }

  try {
    const path = require("path");
    const fs = require("fs");

    const childEnv = { ...env };
    if (childEnv.NODE_OPTIONS) {
      childEnv.NODE_OPTIONS = childEnv.NODE_OPTIONS.replace(
        /--experimental-require-module/g,
        ""
      ).trim();
    }

    const rootDir = path.resolve(__dirname, "..");
    const tsxCli = path.join(rootDir, "node_modules", "tsx", "dist", "cli.mjs");
    let prog = "npx";
    let args = ["tsx", "scripts/vercel-headroom.ts", "--strict", "--json"];

    if (fs.existsSync(tsxCli)) {
      prog = process.execPath;
      args = [tsxCli, "scripts/vercel-headroom.ts", "--strict", "--json"];
    }

    const output = execFn(prog, args, {
      cwd: rootDir,
      env: childEnv,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });

    const parsed = JSON.parse(output);
    if (!parsed || typeof parsed !== "object" || !parsed.meters) {
      logger.error("Vercel headroom check returned invalid JSON response.");
      return false;
    }

    const meters = Object.values(parsed.meters);
    if (meters.length === 0) {
      logger.error("Vercel headroom check returned zero meters.");
      return false;
    }

    const hasUnhealthyMeter = meters.some(
      (m) =>
        !m ||
        m.severity === "critical" ||
        m.severity === "stale" ||
        m.severity === "unreadable" ||
        m.isStale === true ||
        m.isUnreadable === true ||
        m.used === null
    );

    if (parsed.hasCriticalAlerts || hasUnhealthyMeter) {
      logger.error(
        "Production preflight failed: Critical Vercel storage or build time headroom threshold breached (>=95%) or meters are stale/unreadable."
      );
      return false;
    }

    return true;
  } catch (err) {
    if (err && err.stdout) {
      try {
        const parsed = JSON.parse(err.stdout);
        const meters = Object.values(parsed?.meters || {});
        const hasUnhealthyMeter =
          meters.length === 0 ||
          meters.some(
            (m) =>
              !m ||
              m.severity === "critical" ||
              m.severity === "stale" ||
              m.severity === "unreadable" ||
              m.isStale === true ||
              m.isUnreadable === true ||
              m.used === null
          );
        if (
          parsed &&
          typeof parsed === "object" &&
          (parsed.hasCriticalAlerts || hasUnhealthyMeter)
        ) {
          logger.error(
            "Production preflight failed: Critical Vercel storage or build time headroom threshold breached (>=95%) or meters are stale/unreadable."
          );
          return false;
        }
      } catch (_e) {
        // Ignore parse error
      }
    }
    logger.error(
      "Vercel headroom check failed to execute:",
      err && err.message
    );
    return false;
  }
}

/**
 * Runs the preflight when this is a Vercel production build. Returns false
 * when the build must stop; true when it passed or was skipped.
 */
function runVercelProductionPreflight(env = process.env, logger = console) {
  if (!shouldRunPreflight(env)) return true;

  logger.log("\n--- Phase 0: Vercel Production Configuration Preflight ---");
  const { problems, notes } = checkVercelProductionEnv(env);

  for (const note of notes) logger.log(`  note: ${note.name} ${note.reason}.`);

  if (problems.length === 0) {
    logger.log("Production configuration preflight passed.");
    return true;
  }

  logger.error("Production configuration preflight failed:");
  for (const problem of problems)
    logger.error(`  - ${problem.name} ${problem.reason}.`);
  logger.error(
    "Fix these in Vercel → Settings → Environment Variables (Production), then " +
      "create a Production deployment from the current green main commit in " +
      "Dashboard → Deployments → Create Deployment. See 'Production Configuration " +
      "Preflight' in docs/how-to/release-and-deploy.md."
  );
  return false;
}

module.exports = {
  CANONICAL_URL,
  checkVercelProductionEnv,
  runVercelProductionPreflight,
  shouldRunPreflight,
  verifyUpstashCredentials,
  verifyVercelHeadroomCapacity,
};
