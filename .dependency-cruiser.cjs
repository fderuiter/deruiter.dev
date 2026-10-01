// @ts-check
/**
 * Deep-Module Boundary Enforcement for dependency-cruiser.
 *
 * Each package under `lib/` is a DEEP MODULE:
 * 1. Root files (e.g. lib/crf/index.ts, lib/crf/types.ts) are PUBLIC ENTRY POINTS.
 * 2. Nested subfolders (e.g. lib/crf/presets/*, lib/crf/internal/*, lib/neuro/workers/*) are PRIVATE INTERNALS.
 * 3. Unit and integration tests must import only through public entry points.
 * 4. Zero circular dependencies across the entire repository.
 */

const PACKAGES_ROOT = "lib";
const R = PACKAGES_ROOT;

/**
 * A package's private internals: anything nested inside a package subfolder (depth 3+).
 * Package root files (depth 2) are entry points and are NOT matched here.
 */
const PACKAGE_INTERNALS = `^${R}/[^/]+/[^/]+/`;

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "entrypoint-boundary-from-app",
      comment:
        "App, components, and root code may import a package's entry points (root files), but nothing inside its subfolders.",
      severity: "error",
      from: { pathNot: `^${R}/` },
      to: { path: PACKAGE_INTERNALS },
    },
    {
      name: "entrypoint-boundary-across-packages",
      comment:
        "A package's own files import each other freely, but may reach OTHER packages only through their entry points, never their subfolder internals.",
      severity: "error",
      from: { path: `^${R}/([^/]+)/`, pathNot: `^${R}/[^/]+/tests/` },
      to: {
        path: PACKAGE_INTERNALS,
        pathNot: `^${R}/$1/`, // same package -> intra-package freedom
      },
    },
    {
      name: "tests-through-entrypoints",
      comment:
        "Tests must exercise packages through their entry points: they may not reach into subfolder internals of any package (except their own local fixtures).",
      severity: "error",
      from: { path: `^(__tests__|${R}/[^/]+/tests)/` },
      to: {
        path: PACKAGE_INTERNALS,
        pathNot: `^${R}/[^/]+/tests/`,
      },
    },
    {
      name: "tests-folder-is-private",
      comment:
        "A package's tests/ folder is reachable only from tests: nothing else may import test fixtures.",
      severity: "error",
      from: { pathNot: `^(__tests__|${R}/[^/]+/tests)/` },
      to: { path: `^${R}/[^/]+/tests/` },
    },
    {
      name: "trial-and-error-isolation",
      comment:
        "Trial & Error (ADR 0046, #925) shares no code with Clinical Trial Chaos or CRF Studio, directly or through anything it imports.",
      severity: "error",
      from: {
        path: "^(lib/trial-and-error/|components/trial-and-error/|components/arcade/TrialAndErrorClient\\.tsx$|app/arcade/trial-and-error/)",
      },
      to: {
        path: "^(lib/clinical-trial-chaos|components/clinical-trial-chaos/|components/ClinicalTrialChaos\\.tsx$|components/arcade/ClinicalChaosClient\\.tsx$|lib/crf/|components/crf/|app/crf/)",
        reachable: true,
      },
    },
    {
      name: "no-circular",
      comment: "Zero circular dependency cycles allowed across the codebase.",
      severity: "error",
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsConfig: { fileName: "tsconfig.json" },
    enhancedResolveOptions: {
      extensions: [".ts", ".tsx", ".js", ".jsx", ".json", ".d.ts"],
    },
    reporterOptions: {
      text: {
        highlightFocused: true,
      },
    },
  },
};
