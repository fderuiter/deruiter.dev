/* eslint-disable no-console */
import fs from "fs";
import path from "path";
import { generateOpenApi } from "./generate-openapi";
import { renderDesignManifest } from "./generate-theme";
import { warehouseArtifacts } from "./generate-warehouse-artifacts";
import { metricArtifacts } from "./generate-metric-artifacts";
import { contractArtifacts } from "./generate-data-contracts";
import {
  CLINICAL_DATA_CONTRACTS_CATALOG_PATH,
  CLINICAL_METRICS_CATALOG_PATH,
  CLINICAL_PLATFORM_CATALOG_PATHS,
  CLINICAL_STAR_SCHEMA_CATALOG_PATH,
  DESIGN_MANIFEST_PATH,
  GENERATED_FILE_REGISTRY,
} from "../lib/dx/generated-artifacts";
import {
  checkDocumentationDrift,
  compileDocumentation,
  getDocumentationGitStatus,
  type DocumentationDriftResult,
} from "./documentation-drift";
import {
  checkMarkdownLinkIntegrity,
  type MarkdownLinkCheckResult,
} from "./markdown-link-check";
import {
  checkOnboardingDocsDrift,
  checkDirectoryTopology,
  checkPublicRouteRegistryDrift,
  checkTechnicalGuideSchemaParity,
  checkLlmsManifestsDrift,
  checkDocumentationIndexParity,
} from "../lib/dx/doctor";

export interface DetailCheckResult {
  status: "pass" | "fail" | "warn" | "fixed";
  details?: string[];
}

interface OpenApiCheckResult {
  missingRoutes: string[];
  securityMismatches?: string[];
  hasDrift: boolean;
}

function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, "\n");
}

/**
 * Verifies `lib/design-manifest.ts` against `app/globals.css` in memory without
 * mutating tracked files.
 */
export function checkDesignManifestDrift(
  workspaceRoot: string
): DetailCheckResult {
  const entries = GENERATED_FILE_REGISTRY.filter(
    (entry) => entry.driftGroup === "design-manifest"
  );
  const details: string[] = [];

  for (const entry of entries) {
    const targetPath = path.join(workspaceRoot, entry.path);
    if (!fs.existsSync(targetPath)) {
      details.push(
        `${entry.path} is missing (regenerate with \`${entry.generatorCommand}\`).`
      );
      continue;
    }
    try {
      const expected = normalizeLineEndings(
        renderDesignManifest(workspaceRoot)
      );
      const actual = normalizeLineEndings(fs.readFileSync(targetPath, "utf8"));
      if (actual !== expected) {
        details.push(
          `${entry.path} is out of sync with app/globals.css (regenerate with \`${entry.generatorCommand}\`).`
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      details.push(
        `Failed to render ${entry.path} from app/globals.css: ${message}`
      );
    }
  }

  return details.length > 0 ? { status: "fail", details } : { status: "pass" };
}

/**
 * Verifies the three generated `docs/reference/clinical-platform-*.md` catalogs
 * in memory without mutating tracked files.
 */
export function checkClinicalCatalogsDrift(
  workspaceRoot: string
): DetailCheckResult {
  const entries = GENERATED_FILE_REGISTRY.filter(
    (entry) => entry.driftGroup === "clinical-catalogs"
  );
  const expectedByPath: Record<string, string> = {
    [CLINICAL_STAR_SCHEMA_CATALOG_PATH]:
      warehouseArtifacts()[CLINICAL_STAR_SCHEMA_CATALOG_PATH],
    [CLINICAL_METRICS_CATALOG_PATH]:
      metricArtifacts()[CLINICAL_METRICS_CATALOG_PATH],
    [CLINICAL_DATA_CONTRACTS_CATALOG_PATH]:
      contractArtifacts()[CLINICAL_DATA_CONTRACTS_CATALOG_PATH],
  };

  const details: string[] = [];
  for (const entry of entries) {
    const targetPath = path.join(workspaceRoot, entry.path);
    const expected = expectedByPath[entry.path];
    if (expected === undefined) {
      details.push(
        `No in-memory generator registered for clinical catalog ${entry.path}.`
      );
      continue;
    }
    if (!fs.existsSync(targetPath)) {
      details.push(
        `${entry.path} is missing (regenerate with \`${entry.generatorCommand}\`).`
      );
      continue;
    }
    const actual = normalizeLineEndings(fs.readFileSync(targetPath, "utf8"));
    if (actual !== normalizeLineEndings(expected)) {
      details.push(
        `${entry.path} is out of sync with lib/clinical-platform (regenerate with \`${entry.generatorCommand}\`).`
      );
    }
  }

  return details.length > 0 ? { status: "fail", details } : { status: "pass" };
}

export interface DriftCheckDependencies {
  checkDocumentation: () => DocumentationDriftResult;
  checkOpenApi: () => OpenApiCheckResult;
  checkOnboarding: () => DetailCheckResult;
  checkTopology: () => DetailCheckResult;
  checkMarkdownLinks: () => MarkdownLinkCheckResult;
  checkPublicRoutes: () => DetailCheckResult;
  checkTechnicalGuides?: () => DetailCheckResult;
  checkLlmsManifests?: () => DetailCheckResult;
  checkDocumentationIndex?: () => DetailCheckResult;
  checkDocumentationIndexParity?: () => DetailCheckResult;
  checkDesignManifest?: () => DetailCheckResult;
  checkClinicalCatalogs?: () => DetailCheckResult;
}

function defaultDependencies(workspaceRoot: string): DriftCheckDependencies {
  return {
    checkDocumentation: () =>
      checkDocumentationDrift({
        workspaceRoot,
        compile: (outputDirectory) =>
          compileDocumentation(workspaceRoot, outputDirectory, {
            strict: true,
          }),
        getGitStatus: () => getDocumentationGitStatus(workspaceRoot),
      }),
    checkOpenApi: () => generateOpenApi(workspaceRoot),
    checkOnboarding: () => checkOnboardingDocsDrift(workspaceRoot),
    checkTopology: () => checkDirectoryTopology(workspaceRoot),
    checkMarkdownLinks: () => checkMarkdownLinkIntegrity(workspaceRoot),
    checkPublicRoutes: () => checkPublicRouteRegistryDrift(workspaceRoot),
    checkTechnicalGuides: () => checkTechnicalGuideSchemaParity(workspaceRoot),
    checkLlmsManifests: () => checkLlmsManifestsDrift(workspaceRoot),
    checkDocumentationIndex: () => checkDocumentationIndexParity(workspaceRoot),
    checkDesignManifest: () => checkDesignManifestDrift(workspaceRoot),
    checkClinicalCatalogs: () => checkClinicalCatalogsDrift(workspaceRoot),
  };
}

/** The kinds of drift this check reports, each with a different remedy. */
export type DriftCategory =
  | "authored-docs"
  | "openapi"
  | "onboarding"
  | "topology"
  | "markdown-links"
  | "public-routes"
  | "schema-parity"
  | "llms-manifests"
  | "docs-index-parity"
  | "design-manifest"
  | "clinical-catalogs";

const REMEDIES: Record<DriftCategory, { title: string; steps: string[] }> = {
  openapi: {
    title: "API contract drift (a route is missing from openapi.json)",
    steps: ["npm run doctor:fix", "git add openapi.json"],
  },
  onboarding: {
    title: "Onboarding documentation drift",
    steps: ["npm run doctor:fix", "git add docs/"],
  },
  topology: {
    title: "Architectural topology drift",
    steps: ["npm run doctor:fix", "git add docs/"],
  },
  "authored-docs": {
    title: "Authored documentation you changed deliberately",
    steps: ["git add docs/"],
  },
  "markdown-links": {
    title: "Broken markdown links",
    steps: [
      "# Fix the reported link targets by hand",
      "npm run check-docs-drift",
    ],
  },
  "public-routes": {
    title:
      "Public route registry drift (a route in app/ is missing from lib/public-routes.ts or stale)",
    steps: ["npm run doctor:fix", "git add lib/public-routes.ts"],
  },
  "schema-parity": {
    title: "Technical guide Prisma schema or environment variable drift",
    steps: ["npm run doctor:fix", "git add docs/"],
  },
  "llms-manifests": {
    title:
      "LLM discovery manifest drift (public/llms.txt or public/llms-full.txt is stale)",
    steps: [
      "npm run generate:llms",
      "git add public/llms.txt public/llms-full.txt",
    ],
  },
  "docs-index-parity": {
    title:
      "Documentation index parity drift (committed markdown guides without inbound index links)",
    steps: [
      "# Add inbound links to unindexed guides in docs/README.md or quadrant index files",
      "npm run check-docs-drift",
    ],
  },
  "design-manifest": {
    title: `Design token manifest drift (${DESIGN_MANIFEST_PATH} is out of sync with app/globals.css)`,
    steps: ["npm run generate:theme", `git add ${DESIGN_MANIFEST_PATH}`],
  },
  "clinical-catalogs": {
    title:
      "Clinical Data Platform reference catalog drift (docs/reference/clinical-platform-*.md is stale)",
    steps: [
      "npx tsx scripts/generate-warehouse-artifacts.ts",
      "npx tsx scripts/generate-metric-artifacts.ts",
      "npx tsx scripts/generate-data-contracts.ts",
      `git add ${CLINICAL_PLATFORM_CATALOG_PATHS.join(" ")}`,
    ],
  },
};

/**
 * Renders a copy-pasteable remedy for each category that actually failed.
 *
 * Prose costs a second full pre-commit cycle: an author reads "regenerate only
 * stale references", guesses the command, and pays typecheck and the staged
 * suite again. Generated drift is deterministic and safe to name exactly;
 * authored drift is not regenerated here because a human edited it on purpose
 * and silently restaging it would discard that intent.
 */
export function formatDriftRemedy(categories: DriftCategory[]): string {
  const unique = Array.from(new Set(categories));
  if (unique.length === 0) return "";

  const sections = unique.map((category) => {
    const { title, steps } = REMEDIES[category];
    return `  ${title}:\n${steps.map((step) => `    ${step}`).join("\n")}`;
  });

  return `👉 Resolve the drift, then commit again:\n\n${sections.join("\n\n")}\n`;
}

/** Runs the non-mutating documentation and specification drift checks. */
export function checkDrift(
  workspaceRoot = path.resolve(__dirname, ".."),
  dependencies = defaultDependencies(workspaceRoot)
): number {
  console.log("Checking for documentation and specification drift...");
  let docsDrift = false;
  let driftSummary = "";
  const categories: DriftCategory[] = [];

  console.log(
    "Compiling the API reference strictly and checking authored docs are staged..."
  );
  const documentationResult = dependencies.checkDocumentation();
  if (documentationResult.status === "error") {
    console.error(`❌ ${documentationResult.details.join("\n")}`);
    return 1;
  }
  if (documentationResult.status === "fail") {
    docsDrift = true;
    driftSummary += `${documentationResult.details.map((detail) => `• ${detail}`).join("\n")}\n`;
    categories.push("authored-docs");
  }

  console.log(
    "Checking OpenAPI contract synchronization and route coverage..."
  );
  const {
    missingRoutes,
    securityMismatches = [],
    hasDrift: openApiDrift,
  } = dependencies.checkOpenApi();
  if (missingRoutes.length > 0) {
    docsDrift = true;
    categories.push("openapi");
    driftSummary +=
      `• Undocumented API routes detected (${missingRoutes.length}):\n` +
      missingRoutes.map((route) => `  - ${route}`).join("\n") +
      "\n";
  }
  if (securityMismatches.length > 0) {
    docsDrift = true;
    categories.push("openapi");
    driftSummary +=
      `• Security scheme or operation security drift detected (${securityMismatches.length}):\n` +
      securityMismatches.map((mismatch) => `  - ${mismatch}`).join("\n") +
      "\n";
  }
  if (
    openApiDrift &&
    missingRoutes.length === 0 &&
    securityMismatches.length === 0
  ) {
    docsDrift = true;
    categories.push("openapi");
    driftSummary +=
      "• openapi.json is out of sync with scripts/generate-openapi.ts\n";
  }

  console.log("Checking onboarding documentation synchronization...");
  const onboardingResult = dependencies.checkOnboarding();
  if (onboardingResult.status === "fail") {
    docsDrift = true;
    categories.push("onboarding");
    driftSummary +=
      "• Onboarding documentation drift detected:\n" +
      (onboardingResult.details || [])
        .map((detail) => `  - ${detail}`)
        .join("\n") +
      "\n";
  }

  console.log("Checking architectural directory topology synchronization...");
  const topologyResult = dependencies.checkTopology();
  if (topologyResult.status === "fail") {
    docsDrift = true;
    categories.push("topology");
    driftSummary +=
      "• Architectural directory topology drift detected:\n" +
      (topologyResult.details || [])
        .map((detail) => `  - ${detail}`)
        .join("\n") +
      "\n";
  }

  console.log("Validating repository documentation markdown links...");
  const markdownLinkResult = dependencies.checkMarkdownLinks();
  if (markdownLinkResult.status === "fail") {
    docsDrift = true;
    categories.push("markdown-links");
    driftSummary +=
      "• Broken documentation markdown links detected:\n" +
      markdownLinkResult.details.map((detail) => `  - ${detail}`).join("\n") +
      "\n";
  }

  console.log("Checking public route registry synchronization...");
  const publicRoutesResult = dependencies.checkPublicRoutes();
  if (publicRoutesResult.status === "fail") {
    docsDrift = true;
    categories.push("public-routes");
    driftSummary +=
      "• Public route registry drift detected:\n" +
      (publicRoutesResult.details || [])
        .map((detail) => `  - ${detail}`)
        .join("\n") +
      "\n";
  }

  console.log(
    "Checking technical guide schema and environment variable parity..."
  );
  const technicalGuidesResult = dependencies.checkTechnicalGuides
    ? dependencies.checkTechnicalGuides()
    : { status: "pass" as const };
  if (technicalGuidesResult.status === "fail") {
    docsDrift = true;
    categories.push("schema-parity");
    driftSummary +=
      "• Technical guide schema or environment variable drift detected:\n" +
      (technicalGuidesResult.details || [])
        .map((detail) => `  - ${detail}`)
        .join("\n") +
      "\n";
  }

  console.log("Checking LLM discovery manifests synchronization...");
  const llmsManifestsResult = dependencies.checkLlmsManifests
    ? dependencies.checkLlmsManifests()
    : { status: "pass" as const };
  if (llmsManifestsResult.status === "fail") {
    docsDrift = true;
    categories.push("llms-manifests");
    driftSummary +=
      "• LLM discovery manifest drift detected:\n" +
      (llmsManifestsResult.details || [])
        .map((detail) => `  - ${detail}`)
        .join("\n") +
      "\n";
  }

  console.log("Checking documentation index parity...");
  const checkDocsIndexFn =
    dependencies.checkDocumentationIndexParity ??
    dependencies.checkDocumentationIndex;
  const docsIndexResult = checkDocsIndexFn
    ? checkDocsIndexFn()
    : { status: "pass" as const };
  if (docsIndexResult.status === "fail") {
    docsDrift = true;
    categories.push("docs-index-parity");
    driftSummary +=
      "• Documentation index parity drift detected:\n" +
      (docsIndexResult.details || [])
        .map((detail) => `  - ${detail}`)
        .join("\n") +
      "\n";
  }

  console.log("Checking design token manifest synchronization...");
  const designManifestResult = dependencies.checkDesignManifest
    ? dependencies.checkDesignManifest()
    : { status: "pass" as const };
  if (designManifestResult.status === "fail") {
    docsDrift = true;
    categories.push("design-manifest");
    driftSummary +=
      "• Design token manifest drift detected:\n" +
      (designManifestResult.details || [])
        .map((detail) => `  - ${detail}`)
        .join("\n") +
      "\n";
  }

  console.log(
    "Checking Clinical Data Platform reference catalog synchronization..."
  );
  const clinicalCatalogsResult = dependencies.checkClinicalCatalogs
    ? dependencies.checkClinicalCatalogs()
    : { status: "pass" as const };
  if (clinicalCatalogsResult.status === "fail") {
    docsDrift = true;
    categories.push("clinical-catalogs");
    driftSummary +=
      "• Clinical Data Platform catalog drift detected:\n" +
      (clinicalCatalogsResult.details || [])
        .map((detail) => `  - ${detail}`)
        .join("\n") +
      "\n";
  }

  if (docsDrift) {
    console.error(
      "\n❌ [DRIFT DETECTED] Technical specifications or documentation are out of sync with the codebase!"
    );
    console.error(driftSummary);
    console.error(formatDriftRemedy(categories));
    return 1;
  }

  console.log(
    "✅ No documentation or specification drift detected. All API contracts and docs are synchronized."
  );
  return 0;
}

if (require.main === module) {
  process.exitCode = checkDrift();
}
