/* eslint-disable no-console */
// Vercel's Ignored Build Step for this project (ADR 0071), set as
// `ignoreCommand` in vercel.json so the rule lives in the repository rather
// than the dashboard.
//
// Vercel runs it after cloning and before installing dependencies, so it must
// not require anything outside Node itself. Exit code 1 means build, 0 means
// skip. A crash exits non-zero, which builds: failing open keeps a production
// release from being skipped by a bug here.
//
// Git deployments are off for every branch (`git.deploymentEnabled: false`),
// so the deployments that reach this script were all asked for: the weekly
// train's Deploy Hook, a break-glass Create Deployment, or an on-demand
// Preview. Anything else is skipped.

const BUILT_ENVIRONMENTS = new Set(["production", "preview"]);

/**
 * Decides whether a Vercel deployment should build.
 *
 * @param {Record<string, string | undefined>} env - The build environment.
 * @returns {{ build: boolean, reason: string }}
 */
function decideBuild(env) {
  const target = env.VERCEL_ENV || "";
  if (BUILT_ENVIRONMENTS.has(target)) {
    return { build: true, reason: `${target} deployments build (ADR 0071)` };
  }
  return {
    build: false,
    reason: `VERCEL_ENV "${target}" is neither production nor preview`,
  };
}

if (require.main === module) {
  const { build, reason } = decideBuild(process.env);
  console.log(
    `Ignored Build Step: ${build ? "building" : "skipping"}; ${reason}.`
  );
  process.exit(build ? 1 : 0);
}

module.exports = { decideBuild };
