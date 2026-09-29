/* eslint-disable no-console */
import path from "path";
import { generateOpenApi } from "./generate-openapi";
import {
  checkDocumentationDrift,
  compileDocumentation,
  getDocumentationGitStatus,
  type DocumentationDriftResult,
} from "./documentation-drift";
import { API_REFERENCE_RELATIVE_PATH } from "./compile-docs";
import {
  checkMarkdownLinkIntegrity,
  type MarkdownLinkCheckResult,
} from "./markdown-link-check";
import {
  checkOnboardingDocsDrift,
  checkDirectoryTopology,
  checkPublicRouteRegistryDrift,
  checkTechnicalGuideSchemaParity,
} from "../lib/dx/doctor";

interface DetailCheckResult {
  status: "pass" | "fail" | "warn" | "fixed";
  details?: string[];
}

interface OpenApiCheckResult {
  missingRoutes: string[];
  securityMismatches?: string[];
  hasDrift: boolean;
}

export interface DriftCheckDependencies {
  checkDocumentation: () => DocumentationDriftResult;
  checkOpenApi: () => OpenApiCheckResult;
  checkOnboarding: () => DetailCheckResult;
  checkTopology: () => DetailCheckResult;
  checkMarkdownLinks: () => MarkdownLinkCheckResult;
  checkPublicRoutes: () => DetailCheckResult;
  checkTechnicalGuides?: () => DetailCheckResult;
}

function defaultDependencies(workspaceRoot: string): DriftCheckDependencies {
  return {
    checkDocumentation: () =>
      checkDocumentationDrift({
        workspaceRoot,
        compile: (outputDirectory) =>
          compileDocumentation(workspaceRoot, outputDirectory),
        getGitStatus: () => getDocumentationGitStatus(workspaceRoot),
        generatedDocsRelativePath: API_REFERENCE_RELATIVE_PATH,
      }),
    checkOpenApi: () => generateOpenApi(workspaceRoot),
    checkOnboarding: () => checkOnboardingDocsDrift(workspaceRoot),
    checkTopology: () => checkDirectoryTopology(workspaceRoot),
    checkMarkdownLinks: () => checkMarkdownLinkIntegrity(workspaceRoot),
    checkPublicRoutes: () => checkPublicRouteRegistryDrift(workspaceRoot),
    checkTechnicalGuides: () => checkTechnicalGuideSchemaParity(workspaceRoot),
  };
}

/** The kinds of drift this check reports, each with a different remedy. */
export type DriftCategory =
  | "generated-docs"
  | "authored-docs"
  | "openapi"
  | "onboarding"
  | "topology"
  | "markdown-links"
  | "public-routes"
  | "schema-parity";

const REMEDIES: Record<DriftCategory, { title: string; steps: string[] }> = {
  "generated-docs": {
    title:
      "Stale generated references (TypeDoc is behind lib/, hooks/ or types/)",
    steps: ["npm run compile-docs", "git add docs/"],
  },
  openapi: {
    title: "API contract drift (a route is missing from openapi.json)",
    steps: ["npm run doctor:fix", "git add openapi.json docs/"],
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
    steps: ["npm run doctor:fix", "git add CMS_GUIDELINES.md docs/"],
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
    "Comparing documentation against an isolated TypeDoc compilation..."
  );
  const documentationResult = dependencies.checkDocumentation();
  if (documentationResult.status === "error") {
    console.error(`❌ ${documentationResult.details.join("\n")}`);
    return 1;
  }
  if (documentationResult.status === "fail") {
    docsDrift = true;
    driftSummary += `${documentationResult.details.map((detail) => `• ${detail}`).join("\n")}\n`;
    for (const detail of documentationResult.details) {
      categories.push(
        detail.startsWith("Stale generated reference")
          ? "generated-docs"
          : "authored-docs"
      );
    }
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

  console.log("Validating cross-quadrant documentation markdown links...");
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
