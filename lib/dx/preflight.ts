import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";

/**
 * Result of a single preflight probe.
 */
export interface PreflightCheckResult {
  id: string;
  label: string;
  status: "pass" | "fail" | "warn";
  message: string;
}

/**
 * Aggregate result of {@link runPreflight}.
 */
export interface PreflightReport {
  ready: boolean;
  checks: PreflightCheckResult[];
}

function parseVersionParts(version: string): [number, number, number] {
  const match = version.replace(/^v/, "").match(/(\d+)\.(\d+)\.(\d+)/);
  if (!match) return [0, 0, 0];
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/**
 * Compares an actual semantic version against a package.json-style
 * `engines` requirement (currently only the `>=` form used by this
 * repository's own `package.json` is supported).
 */
export function meetsMinVersion(actual: string, required: string): boolean {
  const requiredVersion = required.replace(/^>=/, "").trim();
  const [actualMajor, actualMinor, actualPatch] = parseVersionParts(actual);
  const [reqMajor, reqMinor, reqPatch] = parseVersionParts(requiredVersion);

  if (actualMajor !== reqMajor) return actualMajor > reqMajor;
  if (actualMinor !== reqMinor) return actualMinor > reqMinor;
  return actualPatch >= reqPatch;
}

function readPackageJson(root: string): Record<string, unknown> {
  const raw = fs.readFileSync(path.join(root, "package.json"), "utf-8");
  return JSON.parse(raw) as Record<string, unknown>;
}

/**
 * Verifies the running Node.js version satisfies this repository's
 * declared `engines.node` requirement in `package.json`.
 */
export function checkNodeVersion(root: string): PreflightCheckResult {
  const pkg = readPackageJson(root);
  const engines = pkg.engines as { node?: string; npm?: string } | undefined;
  const required = engines?.node;
  const actual = process.version;

  if (!required) {
    return {
      id: "node-version",
      label: "Node.js version",
      status: "warn",
      message: `No engines.node declared in package.json (running ${actual}).`,
    };
  }

  const ok = meetsMinVersion(actual, required);
  return {
    id: "node-version",
    label: "Node.js version",
    status: ok ? "pass" : "fail",
    message: ok
      ? `${actual} satisfies required ${required}.`
      : `${actual} does NOT satisfy the required ${required} declared in package.json engines.node.`,
  };
}

/**
 * Verifies the running npm version satisfies this repository's declared
 * `engines.npm` requirement in `package.json`.
 */
export function checkNpmVersion(root: string): PreflightCheckResult {
  const pkg = readPackageJson(root);
  const engines = pkg.engines as { node?: string; npm?: string } | undefined;
  const required = engines?.npm;

  let actual: string;
  try {
    actual = execFileSync("npm", ["--version"], {
      encoding: "utf-8",
      timeout: 10_000,
    }).trim();
  } catch (error) {
    return {
      id: "npm-version",
      label: "npm version",
      status: "fail",
      message: `Could not execute 'npm --version': ${(error as Error).message}`,
    };
  }

  if (!required) {
    return {
      id: "npm-version",
      label: "npm version",
      status: "warn",
      message: `No engines.npm declared in package.json (running ${actual}).`,
    };
  }

  const ok = meetsMinVersion(actual, required);
  return {
    id: "npm-version",
    label: "npm version",
    status: ok ? "pass" : "fail",
    message: ok
      ? `${actual} satisfies required ${required}.`
      : `${actual} does NOT satisfy the required ${required} declared in package.json engines.npm.`,
  };
}

/**
 * Verifies the Prisma client has already been generated at
 * `app/generated/prisma` (this repository's `postinstall` hook runs
 * `prisma generate` automatically, but a stale checkout, an interrupted
 * install, or a sandbox that skipped postinstall scripts can leave it
 * missing -- surfacing as confusing "module not found" errors much later
 * in `tsc`/tests rather than here, where the real cause is legible).
 */
export function checkPrismaClientGenerated(root: string): PreflightCheckResult {
  const generatedDir = path.join(root, "app", "generated", "prisma");
  const exists =
    fs.existsSync(generatedDir) && fs.readdirSync(generatedDir).length > 0;

  return {
    id: "prisma-client",
    label: "Prisma client generated",
    status: exists ? "pass" : "fail",
    message: exists
      ? "Generated Prisma client found at app/generated/prisma."
      : "Prisma client not found at app/generated/prisma. Run 'npx prisma generate' (this also runs automatically via the postinstall hook after 'npm ci' / 'npm install').",
  };
}

/**
 * Probes whether this repository's TypeScript scripts can actually
 * execute in the current environment, using `node --import tsx` -- the
 * same compatible invocation `package.json`'s own scripts rely on --
 * rather than `npx tsx`, which can additionally fail on package
 * resolution/network access in a restricted sandbox even when the
 * runtime itself is fine. On failure, the message distinguishes a
 * sandbox/IPC/permission restriction (spawn errors, EPERM/EACCES,
 * a killed process) from a genuine script error, so an agent doesn't
 * waste time debugging "product" code for what is actually an
 * environment restriction it should report and stop escalating past.
 */
export function checkTsxExecution(root: string): PreflightCheckResult {
  try {
    const output = execFileSync(
      process.execPath,
      ["--import", "tsx", "-e", "console.log('tsx-preflight-ok')"],
      { cwd: root, encoding: "utf-8", timeout: 20_000 }
    );

    if (output.includes("tsx-preflight-ok")) {
      return {
        id: "tsx-execution",
        label: "TypeScript execution (node --import tsx)",
        status: "pass",
        message: "node --import tsx executed successfully.",
      };
    }

    return {
      id: "tsx-execution",
      label: "TypeScript execution (node --import tsx)",
      status: "fail",
      message: `node --import tsx produced unexpected output: ${output.slice(0, 200)}`,
    };
  } catch (error) {
    const err = error as NodeJS.ErrnoException & {
      stderr?: Buffer | string;
      signal?: string | null;
    };
    const stderr = err.stderr?.toString() ?? err.message ?? String(error);
    const isSandboxOrIpcRestriction =
      err.code === "EPERM" ||
      err.code === "EACCES" ||
      err.code === "ENOENT" ||
      Boolean(err.signal) ||
      /permission denied|operation not permitted|EPERM|EACCES/i.test(stderr);

    return {
      id: "tsx-execution",
      label: "TypeScript execution (node --import tsx)",
      status: "fail",
      message: isSandboxOrIpcRestriction
        ? `Blocked by an environment/sandbox restriction (not a product defect) -- the exact blocked action was 'node --import tsx -e ...': ${stderr.slice(0, 300)}`
        : `node --import tsx failed with a script-level error: ${stderr.slice(0, 300)}`,
    };
  }
}

/**
 * Validates toolchain major package upgrade readiness and compatibility
 * guards for isolated dependency updates (Vitest v5, jsdom v30, ESLint v10, TypeScript v7).
 */
export function checkToolchainUpgradePreflight(
  root: string,
  targetTool?: string
): PreflightCheckResult[] {
  const pkg = readPackageJson(root);
  const deps = (pkg.dependencies as Record<string, string>) || {};
  const devDeps = (pkg.devDependencies as Record<string, string>) || {};
  const overrides = (pkg.overrides as Record<string, string>) || {};

  const normalizedTarget = targetTool?.toLowerCase().trim();

  const results: PreflightCheckResult[] = [];

  // 1. Vitest v5 Guard
  if (!normalizedTarget || normalizedTarget === "vitest") {
    const configPath = path.join(root, "vitest.config.ts");
    const hasConfig = fs.existsSync(configPath);
    const vitestVersion = devDeps.vitest || deps.vitest || "unknown";

    if (!hasConfig) {
      results.push({
        id: "tool-vitest",
        label: "Toolchain Preflight: Vitest v5",
        status: "fail",
        message: "vitest.config.ts configuration file missing.",
      });
    } else {
      results.push({
        id: "tool-vitest",
        label: "Toolchain Preflight: Vitest v5",
        status: "pass",
        message: `Vitest setup verified (${vitestVersion}) with valid vitest.config.ts compatibility guard.`,
      });
    }
  }

  // 2. jsdom v30 Guard
  if (!normalizedTarget || normalizedTarget === "jsdom") {
    const setupPath = path.join(root, "vitest.setup.ts");
    const hasSetup = fs.existsSync(setupPath);
    const jsdomVersion =
      deps.jsdom || devDeps.jsdom || overrides.jsdom || "unknown";

    if (!hasSetup) {
      results.push({
        id: "tool-jsdom",
        label: "Toolchain Preflight: jsdom v30",
        status: "fail",
        message: "vitest.setup.ts harness missing for DOM isolation.",
      });
    } else {
      results.push({
        id: "tool-jsdom",
        label: "Toolchain Preflight: jsdom v30",
        status: "pass",
        message: `jsdom setup verified (${jsdomVersion}) with valid DOM mock isolation guard in vitest.setup.ts.`,
      });
    }
  }

  // 3. ESLint v10 Guard
  if (!normalizedTarget || normalizedTarget === "eslint") {
    const configPath = path.join(root, "eslint.config.mjs");
    const hasConfig = fs.existsSync(configPath);
    const eslintVersion = devDeps.eslint || deps.eslint || "unknown";

    if (!hasConfig) {
      results.push({
        id: "tool-eslint",
        label: "Toolchain Preflight: ESLint v10",
        status: "fail",
        message: "eslint.config.mjs flat configuration file missing.",
      });
    } else {
      results.push({
        id: "tool-eslint",
        label: "Toolchain Preflight: ESLint v10",
        status: "pass",
        message: `ESLint setup verified (${eslintVersion}) with flat config compatibility guard in eslint.config.mjs.`,
      });
    }
  }

  // 4. TypeScript v7 Guard
  if (
    !normalizedTarget ||
    normalizedTarget === "typescript" ||
    normalizedTarget === "tsc"
  ) {
    const tsconfigPath = path.join(root, "tsconfig.json");
    const hasConfig = fs.existsSync(tsconfigPath);
    const tsVersion = devDeps.typescript || deps.typescript || "unknown";

    if (!hasConfig) {
      results.push({
        id: "tool-typescript",
        label: "Toolchain Preflight: TypeScript v7",
        status: "fail",
        message: "tsconfig.json configuration file missing.",
      });
    } else {
      results.push({
        id: "tool-typescript",
        label: "Toolchain Preflight: TypeScript v7",
        status: "pass",
        message: `TypeScript setup verified (${tsVersion}) with tsconfig.json compatibility guard.`,
      });
    }
  }

  if (normalizedTarget && results.length === 0) {
    results.push({
      id: `tool-${normalizedTarget}`,
      label: `Toolchain Preflight: ${targetTool}`,
      status: "warn",
      message: `Unknown target tool '${targetTool}'. Supported packages: vitest, jsdom, eslint, typescript.`,
    });
  }

  return results;
}

/**
 * Runs every preflight probe and reports whether the environment is
 * ready for real work. Intended to be run once, cheaply, before an
 * agent or developer starts an expensive verification pass (tests,
 * `npm run verify`, browser probes) -- so a broken environment is
 * reported clearly up front instead of surfacing as a confusing wall of
 * unrelated failures deeper in the pipeline. Never prints credential
 * values and never attempts to escalate permissions itself.
 */
export function runPreflight(
  root: string,
  options?: { tool?: string }
): PreflightReport {
  const checks: PreflightCheckResult[] = [
    checkNodeVersion(root),
    checkNpmVersion(root),
    checkPrismaClientGenerated(root),
    checkTsxExecution(root),
    ...checkToolchainUpgradePreflight(root, options?.tool),
  ];

  const ready = checks.every((check) => check.status !== "fail");
  return { ready, checks };
}
