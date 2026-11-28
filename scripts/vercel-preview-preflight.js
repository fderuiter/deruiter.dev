/* eslint-disable no-console, @typescript-eslint/no-require-imports */
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

const {
  LEGACY_AWS_INTEGRATION_PREFIXES,
  PRODUCTION_NEON_ENDPOINT,
  PRODUCTION_ONLY,
  PRODUCTION_POSTGRES_PREFIXES,
  checkVercelPreviewEnv,
  shouldRunPreviewPreflight,
} = require("../lib/dx/vercel-policy.ts");

/**
 * Runs the check when this is a Vercel preview build. Returns false when the
 * build must stop. Logs variable names and reasons only — never values.
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
  LEGACY_AWS_INTEGRATION_PREFIXES,
  PRODUCTION_NEON_ENDPOINT,
  PRODUCTION_ONLY,
  PRODUCTION_POSTGRES_PREFIXES,
  checkVercelPreviewEnv,
  runVercelPreviewPreflight,
  shouldRunPreviewPreflight,
};
