import { execFileSync } from "node:child_process";
import path from "node:path";

/**
 * Relative to the workspace root: where TypeDoc writes the reference markdown.
 * The folder is git-ignored; CI compiles it on every run instead (ADR 0023,
 * amended 2026-10-28).
 */
const API_REFERENCE_RELATIVE_PATH = path.join("docs", "reference", "api");

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
  "--disableSources",
  "--intentionallyNotExported",
  "TypeMap",
  "--intentionallyNotExported",
  "GlobalOmitConfig",
  "--intentionallyNotExported",
  "TypeMapCb",
  "--skipErrorChecking",
  // A type that is used but not exported is a design choice in a deep module,
  // not a broken comment, so it is not reported.
  "--validation.notExported",
  "false",
];

export interface CompileDocumentationOptions {
  /**
   * Fail on any TypeDoc warning, such as a `{@link}` to a symbol that is not
   * documented. `check-docs-drift` compiles strictly so a broken doc comment
   * fails pre-commit and CI; a local `npm run compile-docs` does not.
   */
  strict?: boolean;
}

/** Compiles TypeDoc into the requested destination. */
export function compileDocumentation(
  workspaceRoot: string,
  outputDirectory: string,
  { strict = false }: CompileDocumentationOptions = {}
): void {
  const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";
  execFileSync(
    npxCommand,
    [
      ...typedocArguments,
      ...(strict ? ["--treatWarningsAsErrors"] : []),
      "--out",
      outputDirectory,
    ],
    {
      cwd: workspaceRoot,
      stdio: "inherit",
      shell: process.platform === "win32",
    }
  );
}

if (require.main === module) {
  compileDocumentation(
    process.cwd(),
    path.join(process.cwd(), API_REFERENCE_RELATIVE_PATH)
  );
  console.log(
    `Compiled the API reference into ${API_REFERENCE_RELATIVE_PATH}.`
  );
}
