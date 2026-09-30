import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { buildStandaloneEngine } from "./build-standalone-engine";

export interface GenerateSbomOptions {
  rootDir?: string;
  outputFile?: string;
  omitDev?: boolean;
}

const FORBIDDEN_SECRET_PATTERNS = [
  /postgres(?:ql)?:\/\/[^\s"']+/i,
  /CRON_SECRET/i,
  /CLERK_SECRET_KEY/i,
  /UPSTASH_REDIS_REST_TOKEN/i,
  /SENTRY_AUTH_TOKEN/i,
  /RESEND_API_KEY/i,
];

/**
 * Generates CycloneDX v1.5 JSON SBOM manifest and enriches it with standalone engine bundle assets.
 */
export async function generateSbom({
  rootDir = path.resolve(__dirname, ".."),
  outputFile = path.join(rootDir, "public", "sbom.json"),
  omitDev = process.env.NODE_ENV === "production" ||
    Boolean(process.env.CI) ||
    Boolean(process.env.VITEST) ||
    true,
}: GenerateSbomOptions = {}): Promise<void> {
  const startTime = Date.now();
  console.log("--- Generating Automated CycloneDX v1.5 SBOM Manifest ---");

  // 1. Ensure standalone engine assets are compiled first
  const publicDir = path.dirname(outputFile);
  const garminEnginePath = path.join(publicDir, "garmin-engine.js");
  const monkeyCMayhemPath = path.join(publicDir, "monkey-c-mayhem.js");

  if (!fs.existsSync(garminEnginePath) || !fs.existsSync(monkeyCMayhemPath)) {
    console.log(
      "Standalone engine assets missing; compiling standalone engine..."
    );
    await buildStandaloneEngine({ rootDir, outputDir: publicDir });
  }

  // 2. Execute cyclonedx-npm CLI to produce base CycloneDX v1.5 JSON
  const directScript = path.join(
    rootDir,
    "node_modules",
    "@cyclonedx",
    "cyclonedx-npm",
    "bin",
    "cyclonedx-npm-cli.js"
  );
  const cyclonedxBin = path.join(
    rootDir,
    "node_modules",
    ".bin",
    "cyclonedx-npm"
  );

  let command: string;
  let args: string[];

  if (fs.existsSync(directScript)) {
    command = process.execPath;
    args = [
      directScript,
      "--package-lock-only",
      "--spec-version",
      "1.5",
      "--output-format",
      "JSON",
      "--output-file",
      outputFile,
    ];
  } else {
    command = fs.existsSync(cyclonedxBin) ? cyclonedxBin : "cyclonedx-npm";
    args = [
      "--package-lock-only",
      "--spec-version",
      "1.5",
      "--output-format",
      "JSON",
      "--output-file",
      outputFile,
    ];
  }

  if (omitDev) {
    args.push("--omit", "dev");
  }

  const result = spawnSync(command, args, {
    cwd: rootDir,
    encoding: "utf-8",
    shell: command !== process.execPath && process.platform === "win32",
  });

  if (result.status !== 0) {
    console.error("cyclonedx-npm failed:", result.stderr || result.stdout);
    throw new Error(
      `CycloneDX SBOM generation failed with exit code ${result.status}`
    );
  }

  // 3. Read and parse generated SBOM JSON manifest
  if (!fs.existsSync(outputFile)) {
    throw new Error(
      `Expected SBOM file at ${outputFile} was not found after generation.`
    );
  }

  const sbomRaw = fs.readFileSync(outputFile, "utf-8");
  const sbom = JSON.parse(sbomRaw);

  if (sbom.specVersion !== "1.5" || sbom.bomFormat !== "CycloneDX") {
    throw new Error(
      `Generated SBOM is invalid: expected CycloneDX v1.5, got ${sbom.bomFormat} v${sbom.specVersion}`
    );
  }

  // 4. Extract version from package.json
  const pkgPath = path.join(rootDir, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
  const version = pkg.version || "0.0.0";

  // 5. Catalog standalone engine assets in components array
  if (!Array.isArray(sbom.components)) {
    sbom.components = [];
  }

  const standaloneEngineAssets = [
    {
      filePath: garminEnginePath,
      name: "garmin-engine",
      description: "Standalone Garmin Engine Compiled Asset Target",
    },
    {
      filePath: monkeyCMayhemPath,
      name: "monkey-c-mayhem",
      description: "Standalone Monkey C Mayhem Compiled Asset Target",
    },
  ];

  for (const asset of standaloneEngineAssets) {
    if (!fs.existsSync(asset.filePath)) {
      continue;
    }

    const content = fs.readFileSync(asset.filePath);
    const sha256 = crypto.createHash("sha256").update(content).digest("hex");

    const assetComponent = {
      type: "application",
      name: asset.name,
      version,
      description: asset.description,
      hashes: [
        {
          alg: "SHA-256",
          content: sha256,
        },
      ],
      purl: `pkg:generic/${asset.name}@${version}`,
    };

    const existingIndex = sbom.components.findIndex(
      (c: { name: string }) => c.name === asset.name
    );

    if (existingIndex >= 0) {
      sbom.components[existingIndex] = assetComponent;
    } else {
      sbom.components.push(assetComponent);
    }
  }

  // 6. Security guardrail: Scan for inadvertent secret exposure in generated SBOM
  const updatedSbomRaw = JSON.stringify(sbom, null, 2);

  for (const pattern of FORBIDDEN_SECRET_PATTERNS) {
    if (pattern.test(updatedSbomRaw)) {
      throw new Error(
        `[SECURITY ERROR] Generated SBOM contains forbidden secret or credential pattern: ${pattern}`
      );
    }
  }

  // 7. Write atomic output back to public/sbom.json
  fs.writeFileSync(outputFile, updatedSbomRaw, "utf-8");

  const elapsedMs = Date.now() - startTime;
  console.log(
    `✓ CycloneDX v1.5 SBOM manifest generated successfully at ${path.relative(
      rootDir,
      outputFile
    )} (${sbom.components.length} components cataloged in ${elapsedMs}ms)`
  );

  if (elapsedMs > 5000) {
    console.warn(
      `[PERFORMANCE WARNING] SBOM generation took ${elapsedMs}ms, exceeding 5000ms budget guardrail.`
    );
  }
}

if (
  require.main === module ||
  (process.argv[1] && process.argv[1].includes("generate-sbom"))
) {
  generateSbom().catch((err) => {
    console.error("Failed to generate SBOM:", err);
    process.exit(1);
  });
}
