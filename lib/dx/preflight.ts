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
 * Verifies core developer toolchain dependencies (Vitest v5, jsdom v30,
 * ESLint v9, TypeScript v6) satisfy required major version releases.
 */
export function checkToolchainVersions(root: string): PreflightCheckResult {
  const pkg = readPackageJson(root);
  const devDeps = (pkg.devDependencies || {}) as Record<string, string>;

  const requirements: { name: string; requiredMajor: number }[] = [
    { name: "vitest", requiredMajor: 5 },
    { name: "jsdom", requiredMajor: 30 },
    { name: "eslint", requiredMajor: 9 },
    { name: "typescript", requiredMajor: 6 },
  ];

  const violations: string[] = [];

  for (const { name, requiredMajor } of requirements) {
    const declared = devDeps[name];
    if (!declared) {
      violations.push(`${name} not declared in devDependencies`);
      continue;
    }

    const match = declared.match(/(\d+)/);
    const major = match ? Number(match[1]) : 0;
    if (major < requiredMajor) {
      violations.push(
        `${name} declared as ${declared} (requires >= v${requiredMajor})`
      );
    }
  }

  if (violations.length > 0) {
    return {
      id: "toolchain-versions",
      label: "Toolchain package versions",
      status: "fail",
      message: `Toolchain version mismatch: ${violations.join("; ")}.`,
    };
  }

  return {
    id: "toolchain-versions",
    label: "Toolchain package versions",
    status: "pass",
    message:
      "All core toolchain engines satisfied (Vitest v5, jsdom v30, ESLint v9, TypeScript v6).",
  };
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
export function runPreflight(root: string): PreflightReport {
  const checks: PreflightCheckResult[] = [
    checkNodeVersion(root),
    checkNpmVersion(root),
    checkPrismaClientGenerated(root),
    checkTsxExecution(root),
    checkToolchainVersions(root),
  ];

  const ready = checks.every((check) => check.status !== "fail");
  return { ready, checks };
}
