/* eslint-disable */
const { spawnSync } = require("child_process");
const fs = require("fs");

console.log("--- Starting Post-Build Conditional Migration Build Pipeline ---");

// 0. Load local environment files before deciding anything is missing.
//
// npm does not read .env files, so `npm run build` starts with none of them in
// process.env. Next would load them itself, but this script spawns it with
// `env: process.env`, and a variable already present in the environment beats
// any .env file -- so the offline dummy below would win over a perfectly good
// .env.local and the build would silently produce fallback content.
//
// prisma.config.ts already does exactly this for the same reason.
// Never under test. A test that deletes DATABASE_URL to exercise the offline
// fallback would otherwise have it repopulated from the developer's real
// .env.local, and any assertion on the value would print a live production
// credential into the failure output. lib/env.ts special-cases VITEST for the
// same reason.
try {
  if (process.env.VITEST) {
    throw new Error("skipped under test");
  }
  const dotenv = require("dotenv");
  if (fs.existsSync(".env.local")) {
    dotenv.config({ path: ".env.local" });
  } else {
    dotenv.config();
  }
} catch (err) {
  if (!process.env.VITEST) {
    console.warn(
      "Could not load local environment files; continuing with the ambient environment.",
      err && err.message
    );
  }
}

// 0.5. Production Configuration Preflight (#989)
//
// Only on Vercel's production build, and before step 1: the dummy
// DATABASE_URL and CRON_SECRET below would otherwise hide a missing value and
// ship a build that fails at request time. Local, CI and preview builds skip
// it. It reports variable names, never values.
const {
  runVercelProductionPreflight,
  shouldRunPreflight,
  verifyUpstashCredentials,
} = require("./vercel-production-preflight");
const {
  captureSourceState,
  clearBuildProvenance,
  writeBuildProvenance,
} = require("./build-provenance");
async function runBuildPipeline() {
  // Build provenance (#1769): note the source state before any phase can
  // rewrite a file, and drop the previous build's record so a build that
  // fails part-way can never be mistaken for a finished one.
  const sourceBeforeBuild = captureSourceState();
  clearBuildProvenance();

  if (!runVercelProductionPreflight(process.env)) {
    process.exit(1);
  }

  if (shouldRunPreflight(process.env)) {
    console.log("Checking Upstash REST authentication...");
    const upstashCheck = await verifyUpstashCredentials(process.env);
    if (!upstashCheck.ok) {
      console.error(
        `Production configuration preflight failed: ${upstashCheck.name} ${upstashCheck.reason}.`
      );
      process.exit(1);
    }
    console.log("Upstash REST authentication passed.");
  }

  // 1. Connection String & Secret Fallback for Offline/Local Compilation
  if (!process.env.DATABASE_URL) {
    console.warn(
      "No DATABASE_URL found, and no .env.local supplied one. Using a dummy " +
        "connection string for offline compilation: every database-backed page " +
        "will be generated from static fallbacks rather than real data."
    );
    const userPass = "dummy:dummy";
    const hostPort = "localhost:5432";
    const dbName = "dummy";
    process.env.DATABASE_URL =
      `postgres` + `ql://` + userPass + "@" + hostPort + "/" + dbName;
  }
  if (!process.env.DIRECT_URL) {
    process.env.DIRECT_URL = process.env.DATABASE_URL;
  }
  if (!process.env.CRON_SECRET) {
    console.log(
      "No CRON_SECRET found. Setting dummy CRON_SECRET for offline compilation."
    );
    process.env.CRON_SECRET = "dummy-secret-for-compilation";
  }
  if (
    !process.env.NODE_OPTIONS ||
    !process.env.NODE_OPTIONS.includes("--max-old-space-size")
  ) {
    process.env.NODE_OPTIONS =
      `${process.env.NODE_OPTIONS || ""} --max-old-space-size=4096`.trim();
  }
  if (!process.env.NODE_OPTIONS.includes("--no-warnings")) {
    process.env.NODE_OPTIONS =
      `${process.env.NODE_OPTIONS} --no-warnings`.trim();
  }
  process.env.SERWIST_SUPPRESS_TURBOPACK_WARNING = "1";
  process.env.WS_NO_BUFFER_UTIL = "1";
  process.env.WS_NO_UTF_8_VALIDATE = "1";
  process.env.SKIP_DB_HEALTH_CHECK = "true";

  // Helper function to run a step and exit if it fails
  function runStep(command, rawArgs, env = process.env) {
    // Only ever execute the locked, locally installed binary; bare `npx` may
    // otherwise resolve and run a different version from the npm registry.
    const args = command === "npx" ? ["--no-install", ...rawArgs] : rawArgs;
    console.log(`Executing: ${command} ${args.join(" ")}`);
    const result = spawnSync(command, args, {
      stdio: "inherit",
      shell: true,
      env,
    });
    if (result.status !== 0) {
      console.error(
        `Error: Command "${command} ${args.join(" ")}" failed with exit code ${result.status}`
      );
      process.exit(result.status ?? 1);
    }
  }

  // 2. Client Generation & Pre-Build Specifications (Phase 1)
  console.log("\n--- Phase 1: Generating Prisma Client ---");
  runStep("npx", ["prisma", "generate"]);

  console.log(
    "\n--- Phase 1.2: Verifying & Generating OpenAPI Specification ---"
  );
  runStep("npx", ["tsx", "scripts/generate-openapi.ts"]);

  console.log(
    "\n--- Phase 1.3: Verifying Terminology Glossary & Template Compiler Integrity ---"
  );
  runStep("npx", ["tsx", "scripts/verify-terms.ts"]);

  // 3. Pre-Build Offline Migration Validation (Phase 1.5)
  console.log(
    "\n--- Phase 1.5: Offline Migration Integrity and Safety Validation ---"
  );
  runStep("npm", ["run", "check:migrations"]);

  // 3.2. Production Migrations (Phase 1.6, ADR 0049)
  //
  // Vercel's production build of `main` is the only release path, so it applies
  // pending migrations before compiling anything. Only a build running on Vercel
  // for the production environment migrates: preview builds share the same Neon
  // credentials, and CI and local builds must stay offline. Migrations need the
  // unpooled endpoint (see prisma.config.ts), which the Neon integration
  // provisions as DATABASE_URL_UNPOOLED. A failure here stops the build, so
  // nothing is promoted over a schema it was not built against.
  if (process.env.VERCEL === "1" && process.env.VERCEL_ENV === "production") {
    console.log("\n--- Phase 1.6: Applying Production Migrations ---");
    const migrationUrl = process.env.DATABASE_URL_UNPOOLED;
    if (!migrationUrl) {
      console.error(
        "Error: DATABASE_URL_UNPOOLED is not set. Production migrations need the " +
          "unpooled Neon endpoint; reconnect the Neon integration in Vercel."
      );
      process.exit(1);
    }
    runStep("npx", ["prisma", "migrate", "deploy"], {
      ...process.env,
      DIRECT_URL: migrationUrl,
    });
  }

  // 3.5. Documentation Compilation Phase (Phase 1.8)
  console.log(
    "\n--- Phase 1.8: Strictly Compiling and Verifying Documentation ---"
  );
  runStep("npm", ["run", "compile-docs"]);

  // 3.8. Standalone Engine Asset Target Compilation & Budget Validation Phase (Phase 1.9)
  console.log(
    "\n--- Phase 1.9: Compiling & Verifying Standalone Engine Asset Target ---"
  );
  runStep("npx", ["tsx", "scripts/build-standalone-engine.ts"]);

  // 4. Application Compilation Phase (Phase 2)
  console.log("\n--- Phase 2: Compiling Frontend Application ---");
  runStep("npx", ["next", "build", "--webpack"]);

  // 5. Build Provenance (Phase 3, #1769): lets `bench:pages --assert` reuse
  // this build instead of rebuilding, but only when the record proves a clean
  // build of the exact revision it is about to measure.
  writeBuildProvenance(sourceBeforeBuild);

  console.log("\n--- Build Pipeline Completed Successfully! ---");
  process.exit(0);
}

const buildPipeline = runBuildPipeline();
if (require.main === module) {
  buildPipeline.catch(() => {
    console.error("Build pipeline failed before completing.");
    process.exit(1);
  });
} else {
  module.exports = buildPipeline;
}
