import esbuild from "esbuild";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const MAX_SIZE_BYTES = 80 * 1024;
const outputNames = ["garmin-engine.js", "monkey-c-mayhem.js"] as const;

export interface StandaloneBuildOptions {
  rootDir?: string;
  outputDir?: string;
  maxSizeBytes?: number;
}

/** Builds the standalone engine atomically, keeping callers' output directories clean on failure. */
export async function buildStandaloneEngine({
  rootDir = path.resolve(__dirname, ".."),
  outputDir = path.join(rootDir, "public"),
  maxSizeBytes = MAX_SIZE_BYTES,
}: StandaloneBuildOptions = {}): Promise<
  Readonly<Record<(typeof outputNames)[number], string>>
> {
  const entryPoint = path.join(rootDir, "lib", "garmin-engine.ts");
  const temporaryDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "portfolio-standalone-")
  );
  const temporaryOutput = path.join(temporaryDirectory, outputNames[0]);

  try {
    await esbuild.build({
      entryPoints: [entryPoint],
      bundle: true,
      minify: true,
      format: "iife",
      globalName: "GarminEngine",
      target: ["es2020"],
      outfile: temporaryOutput,
    });

    const contents = fs.readFileSync(temporaryOutput);
    if (contents.byteLength > maxSizeBytes) {
      throw new Error(
        `[BUILD ERROR] Standalone JavaScript artifact (${(contents.byteLength / 1024).toFixed(2)} KB) exceeds the ${(maxSizeBytes / 1024).toFixed(2)} KB budget.`
      );
    }

    fs.mkdirSync(outputDir, { recursive: true });
    const outputs = Object.fromEntries(
      outputNames.map((name) => {
        const outputPath = path.join(outputDir, name);
        if (
          !fs.existsSync(outputPath) ||
          !fs.readFileSync(outputPath).equals(contents)
        ) {
          fs.writeFileSync(outputPath, contents);
        }
        return [name, outputPath];
      })
    ) as Record<(typeof outputNames)[number], string>;

    console.log(
      `✓ Standalone engine generated (${contents.byteLength} bytes / ${(maxSizeBytes / 1024).toFixed(1)} KB budget)`
    );
    console.log(
      "--- Standalone Engine Build & Size Check Passed (<= 80KB Budget Verified) ---"
    );
    return outputs;
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

function readFlag(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

if (
  require.main === module ||
  (process.argv[1] && process.argv[1].includes("build-standalone-engine"))
) {
  const sourceRoot = readFlag("--source-root");
  const outputDir = readFlag("--output-dir");
  const maxSizeBytes = readFlag("--max-size-bytes");
  buildStandaloneEngine({
    ...(sourceRoot ? { rootDir: path.resolve(sourceRoot) } : {}),
    ...(outputDir ? { outputDir: path.resolve(outputDir) } : {}),
    ...(maxSizeBytes
      ? { maxSizeBytes: Number.parseInt(maxSizeBytes, 10) }
      : {}),
  }).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
