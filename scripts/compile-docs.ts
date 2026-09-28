import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { syncGeneratedDocumentation } from "./docs-union-order";

/** Relative to the workspace root: where compiled TypeDoc reference markdown is checked in (ADR 0023). */
export const API_REFERENCE_RELATIVE_PATH = path.join(
  "docs",
  "reference",
  "api"
);

const typedocArguments = [
  "typedoc",
  "--entryPoints",
  "hooks",
  "--entryPoints",
  "types",
  "--entryPoints",
  "lib",
  "--exclude",
  "**/env.d.ts",
  "--entryPointStrategy",
  "expand",
  "--plugin",
  "typedoc-plugin-markdown",
  "--hideGenerator",
  "--cleanOutputDir",
  "false",
  "--disableSources",
  "--intentionallyNotExported",
  "TypeMap",
  "--intentionallyNotExported",
  "GlobalOmitConfig",
  "--intentionallyNotExported",
  "TypeMapCb",
  "--skipErrorChecking",
];

/** Compiles TypeDoc into the requested destination. */
export function compileDocumentation(
  workspaceRoot: string,
  outputDirectory: string
): void {
  const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";
  execFileSync(npxCommand, [...typedocArguments, "--out", outputDirectory], {
    cwd: workspaceRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
}

/**
 * Regenerates the checked-in reference. TypeDoc compiles into a scratch
 * directory first, and only pages that changed beyond literal-union order
 * are copied in, so an unrelated change never rewrites a page (#951).
 */
export function regenerateDocumentation(workspaceRoot: string): string[] {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "portfolio-docs-"));
  try {
    compileDocumentation(workspaceRoot, scratch);
    return syncGeneratedDocumentation(
      scratch,
      path.join(workspaceRoot, API_REFERENCE_RELATIVE_PATH)
    );
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

if (
  require.main === module ||
  process.argv.some((arg) => arg.includes("compile-docs"))
) {
  const written = regenerateDocumentation(process.cwd());
  console.log(
    `Updated ${written.length} reference page${written.length === 1 ? "" : "s"} in ${API_REFERENCE_RELATIVE_PATH}.`
  );
}
