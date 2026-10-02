/* eslint-disable */
/**
 * Build provenance for `npm run build` (#1769).
 *
 * `scripts/build.js` records which source revision a production build came
 * from, whether the tree was clean before and after the build, and the
 * resulting Next.js BUILD_ID. `bench:pages --assert` validates that record
 * (`validateBuildProvenance()` in `lib/dx/benchmark-runner.ts`) against the
 * current `inspectSourceState()` and reuses the build only when it proves a
 * clean, fresh production build of the exact revision. Without a matching
 * record the benchmark builds again, as it always did.
 */
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

/**
 * Must equal GENERATED_BUILD_ARTIFACTS in lib/dx/source-state.ts;
 * __tests__/build-provenance.test.ts keeps the two in sync.
 */
const GENERATED_BUILD_ARTIFACTS = [
  "public/garmin-engine.js",
  "public/monkey-c-mayhem.js",
];

/** Relative to the workspace root. */
const BUILD_PROVENANCE_FILE = path.join(".next", "build-provenance.json");

/**
 * Under Vitest, build.js runs with a mocked spawnSync, so no real build
 * happens. Writing a record then would vouch for whatever stale .next/ the
 * developer has, so provenance is never touched under test.
 */
function underTest() {
  return Boolean(process.env.VITEST);
}

/** Same definition of revision and "dirty" as inspectSourceState(). */
function captureSourceState(cwd = process.cwd()) {
  if (underTest()) return { revision: null, dirty: null };
  try {
    const run = (args) =>
      execFileSync("git", args, {
        cwd,
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
    const revision = run(["rev-parse", "HEAD"]);
    const dirty =
      run([
        "status",
        "--porcelain",
        "--",
        ".",
        ...GENERATED_BUILD_ARTIFACTS.map((file) => `:(exclude)${file}`),
      ]).length > 0;
    return { revision, dirty };
  } catch {
    // No git (e.g. Vercel's build container): record unknown provenance,
    // which the benchmark never accepts.
    return { revision: null, dirty: null };
  }
}

/** Removes a previous build's record so a failed build cannot reuse it. */
function clearBuildProvenance(cwd = process.cwd()) {
  if (underTest()) return;
  try {
    fs.rmSync(path.join(cwd, BUILD_PROVENANCE_FILE), { force: true });
  } catch {
    /* nothing to clear */
  }
}

/** Writes the record after `next build` succeeded. Never fails the build. */
function writeBuildProvenance(before, cwd = process.cwd()) {
  if (underTest()) return null;
  try {
    const buildIdPath = path.join(cwd, ".next", "BUILD_ID");
    const buildId = fs.existsSync(buildIdPath)
      ? fs.readFileSync(buildIdPath, "utf-8").trim()
      : "";
    const after = captureSourceState(cwd);
    const record = {
      version: 1,
      command: "npm run build",
      sourceRevision: before.revision,
      sourceDirty: before.dirty,
      sourceRevisionAfterBuild: after.revision,
      sourceDirtyAfterBuild: after.dirty,
      buildId,
      completedAt: new Date().toISOString(),
    };
    fs.writeFileSync(
      path.join(cwd, BUILD_PROVENANCE_FILE),
      `${JSON.stringify(record, null, 2)}\n`,
      "utf-8"
    );
    return record;
  } catch (error) {
    console.warn(
      "Could not write build provenance; bench:pages --assert will rebuild.",
      error && error.message
    );
    return null;
  }
}

module.exports = {
  BUILD_PROVENANCE_FILE,
  GENERATED_BUILD_ARTIFACTS,
  captureSourceState,
  clearBuildProvenance,
  writeBuildProvenance,
};
