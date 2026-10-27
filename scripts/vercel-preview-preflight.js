/* eslint-disable no-console */
// Preview-only safety check (ADR 0071), run by scripts/build.js on Vercel
// preview builds before anything else can read a credential.
//
// A Preview is for clicking through one pull request. It must never reach a
// production data store or send through a production service, whatever its
// Vercel Preview scope happens to hold. Vercel's "Separate Production Secret
// Values" setting stops Preview from inheriting a production value, but it
// cannot stop someone pasting the same value into Preview by hand. This check
// fails the build when that happens, so the Preview never starts serving.
//
// Like the production preflight it reports variable names and reasons only.
// Never add a message that interpolates a value: build logs outlive the
// deployment and every member of the Vercel team can read them.

// The production Neon compute endpoint. Both the pooled and the direct host
// names contain it, so any connection string pointed at production does too.
// Recorded in docs/reference/neon-capacity-inventory.md; update both together
// if production ever moves to another endpoint.
const PRODUCTION_NEON_ENDPOINT = "ep-young-mouse-ap1zkh0m";

// Credentials for services that only Production may use. Each one either
// spends a shared free-tier quota, reaches real people (email), or writes to a
// production store. A Preview that needs one of these services gets its own
// account and an ADR amendment that removes the name from this list.
const PRODUCTION_ONLY = [
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
];

// The AWS integrations (ADR 0070) write prefixed variables. Their role ARNs
// let a build assume a role on the production cluster and table.
const PRODUCTION_ONLY_PREFIXES = ["DSQL_", "DYNAMODB_"];

function isSet(env, name) {
  return typeof env[name] === "string" && env[name].trim() !== "";
}

function shouldRunPreviewPreflight(env) {
  return env.VERCEL === "1" && env.VERCEL_ENV === "preview";
}

/**
 * Checks a preview environment. Returns problems (which fail the build) and a
 * summary of what the Preview will see. Neither ever contains a value.
 */
function checkVercelPreviewEnv(env) {
  const problems = [];

  for (const name of Object.keys(env).sort()) {
    if (isSet(env, name) && env[name].includes(PRODUCTION_NEON_ENDPOINT)) {
      problems.push({ name, reason: "names the production Neon endpoint" });
    }
  }

  for (const name of PRODUCTION_ONLY) {
    if (isSet(env, name)) {
      problems.push({
        name,
        reason:
          "is a production-only credential and must not be set in Preview",
      });
    }
  }

  for (const name of Object.keys(env).sort()) {
    if (
      isSet(env, name) &&
      PRODUCTION_ONLY_PREFIXES.some((prefix) => name.startsWith(prefix))
    ) {
      problems.push({
        name,
        reason: "belongs to a production AWS integration (ADR 0070)",
      });
    }
  }

  if (
    isSet(env, "CLERK_SECRET_KEY") &&
    env.CLERK_SECRET_KEY.startsWith("sk_live_")
  ) {
    problems.push({
      name: "CLERK_SECRET_KEY",
      reason: "is a Clerk production key (sk_live_); use a development key",
    });
  }
  if (
    isSet(env, "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY") &&
    env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.startsWith("pk_live_")
  ) {
    problems.push({
      name: "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
      reason: "is a Clerk production key (pk_live_); use a development key",
    });
  }

  const summary = [
    isSet(env, "DATABASE_URL")
      ? "Database: a non-production Neon endpoint."
      : "Database: none. Database-backed pages use the built-in fallback content.",
    "Cache: none. Rate limits are per instance and telemetry is not buffered.",
    "Email, QStash, cron and AWS: off.",
  ];

  return { problems, summary };
}

/**
 * Runs the check when this is a Vercel preview build. Returns false when the
 * build must stop.
 */
function runVercelPreviewPreflight(env = process.env, logger = console) {
  if (!shouldRunPreviewPreflight(env)) return true;

  logger.log("\n--- Phase 0.6: Preview Isolation Preflight (ADR 0071) ---");
  const { problems, summary } = checkVercelPreviewEnv(env);
  if (problems.length > 0) {
    logger.error("Preview isolation preflight failed:");
    for (const problem of problems) {
      logger.error(`  - ${problem.name} ${problem.reason}.`);
    }
    logger.error(
      "Remove these from the Vercel Preview scope. See " +
        "docs/how-to/use-a-preview-deployment.md."
    );
    return false;
  }
  for (const line of summary) logger.log(`  ${line}`);
  logger.log("Preview isolation preflight passed.");
  return true;
}

module.exports = {
  PRODUCTION_NEON_ENDPOINT,
  PRODUCTION_ONLY,
  checkVercelPreviewEnv,
  runVercelPreviewPreflight,
  shouldRunPreviewPreflight,
};
