/**
 * Single registry for committed generated artifacts and removed legacy paths.
 *
 * Drives `lint-staged.config.cjs`, `.prettierignore` verification in
 * `lib/dx/doctor.ts`, and non-mutating drift checks in `scripts/check-drift.ts`.
 */

/** Drift check category associated with a committed generated artifact. */
export type GeneratedArtifactDriftGroup =
  "design-manifest" | "clinical-catalogs";

/** Metadata contract for one committed generated file in the repository. */
export interface GeneratedArtifactEntry {
  /** Workspace-relative POSIX file path. */
  readonly path: string;
  /** Copy-pasteable command that regenerates the artifact. */
  readonly generatorCommand: string;
  /** Whether Prettier and `lint-staged` must skip reformatting this file. */
  readonly excludeFromFormatting: boolean;
  /** Optional drift-verification group enforced by `scripts/check-drift.ts`. */
  readonly driftGroup?: GeneratedArtifactDriftGroup;
}

/** Canonical path for the compiled CSS design token manifest. */
export const DESIGN_MANIFEST_PATH = "lib/design-manifest.ts";

/** Canonical path for the Clinical Data Platform star-schema reference page. */
export const CLINICAL_STAR_SCHEMA_CATALOG_PATH =
  "docs/reference/clinical-platform-star-schema.md";

/** Canonical path for the Clinical Data Platform metric registry page. */
export const CLINICAL_METRICS_CATALOG_PATH =
  "docs/reference/clinical-platform-metrics.md";

/** Canonical path for the Clinical Data Platform data-contracts catalog page. */
export const CLINICAL_DATA_CONTRACTS_CATALOG_PATH =
  "docs/reference/clinical-platform-data-contracts.md";

/** Authoritative registry of committed generated files across the repository. */
export const GENERATED_FILE_REGISTRY: readonly GeneratedArtifactEntry[] = [
  {
    path: "app/icon.svg",
    generatorCommand: "npm run generate:icons",
    excludeFromFormatting: true,
  },
  {
    path: "app/favicon.ico",
    generatorCommand: "npm run generate:icons",
    excludeFromFormatting: true,
  },
  {
    path: "public/apple-touch-icon.png",
    generatorCommand: "npm run generate:icons",
    excludeFromFormatting: true,
  },
  {
    path: "public/icon-192.png",
    generatorCommand: "npm run generate:icons",
    excludeFromFormatting: true,
  },
  {
    path: "public/icon-512.png",
    generatorCommand: "npm run generate:icons",
    excludeFromFormatting: true,
  },
  {
    path: "public/icon-maskable-512.png",
    generatorCommand: "npm run generate:icons",
    excludeFromFormatting: true,
  },
  {
    path: DESIGN_MANIFEST_PATH,
    generatorCommand: "npm run generate:theme",
    excludeFromFormatting: true,
    driftGroup: "design-manifest",
  },
  {
    path: CLINICAL_STAR_SCHEMA_CATALOG_PATH,
    generatorCommand: "npx tsx scripts/generate-warehouse-artifacts.ts",
    excludeFromFormatting: false,
    driftGroup: "clinical-catalogs",
  },
  {
    path: CLINICAL_METRICS_CATALOG_PATH,
    generatorCommand: "npx tsx scripts/generate-metric-artifacts.ts",
    excludeFromFormatting: false,
    driftGroup: "clinical-catalogs",
  },
  {
    path: CLINICAL_DATA_CONTRACTS_CATALOG_PATH,
    generatorCommand: "npx tsx scripts/generate-data-contracts.ts",
    excludeFromFormatting: false,
    driftGroup: "clinical-catalogs",
  },
];

/**
 * Generated files skipped by `lint-staged.config.cjs` and required individually
 * in `.prettierignore` (`docs/` already covers generated reference catalogs).
 */
export const FORMATTING_EXCLUDED_ARTIFACTS: readonly string[] =
  GENERATED_FILE_REGISTRY.filter((entry) => entry.excludeFromFormatting).map(
    (entry) => entry.path
  );

/** Generated `docs/reference/clinical-platform-*.md` catalog paths. */
export const CLINICAL_PLATFORM_CATALOG_PATHS: readonly string[] =
  GENERATED_FILE_REGISTRY.filter(
    (entry) => entry.driftGroup === "clinical-catalogs"
  ).map((entry) => entry.path);

/**
 * Removed duplicate or nonexistent generated paths that must not linger in
 * `.gitignore`, `.prettierignore`, or `.vercelignore`.
 */
export const STALE_REMOVED_ARTIFACTS: readonly string[] = [
  "app/theme.css",
  "public/favicon.svg",
  "public/favicon.ico",
  "public/garmin-engine.js",
  "public/monkey-c-mayhem.js",
];
