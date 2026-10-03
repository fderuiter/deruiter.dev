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

type Triple = [number, number, number];

function toTriple(version: string): Triple {
  const match = version
    .replace(/^v/, "")
    .match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  return match
    ? [Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0)]
    : [0, 0, 0];
}

function compareTriples(left: Triple, right: Triple): number {
  for (let index = 0; index < 3; index++) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

/** Version with part `index` incremented and every later part zeroed. */
function bump(parts: Triple, index: number): Triple {
  const next: Triple = [...parts];
  next[index] += 1;
  for (let later = index + 1; later < 3; later++) next[later] = 0;
  return next;
}

/**
 * Desugars one comparator into primitive bounds, following npm semver:
 * a partial version is an x-range (`22`, `22.x` and `=22` all mean
 * `>=22.0.0 <23.0.0`), `^` allows changes that keep the left-most non-zero
 * part, and `~` allows patch changes (minor changes when only a major is
 * given). Returns null for anything it cannot read.
 */
function desugar(comparator: string): [string, Triple][] | null {
  const match = comparator.match(
    /^(>=|<=|>|<|=|\^|~)?v?(\d+|[xX*])(?:\.(\d+|[xX*]))?(?:\.(\d+|[xX*]))?$/
  );
  if (!match) return null;
  const operator = match[1] ?? "";
  const raw = [match[2], match[3], match[4]];
  let given = 0;
  while (
    given < 3 &&
    raw[given] !== undefined &&
    /^\d+$/.test(raw[given] as string)
  ) {
    given++;
  }
  const lower: Triple = [0, 1, 2].map((index) =>
    index < given ? Number(raw[index]) : 0
  ) as Triple;
  if (given === 0) return [];
  const upper = bump(lower, given - 1);
  switch (operator) {
    case ">=":
      return [[">=", lower]];
    case "<":
      return [["<", lower]];
    case ">":
      return given === 3 ? [[">", lower]] : [[">=", upper]];
    case "<=":
      return given === 3 ? [["<=", lower]] : [["<", upper]];
    case "^": {
      const keep =
        lower[0] > 0 || given === 1 ? 0 : lower[1] > 0 || given === 2 ? 1 : 2;
      return [
        [">=", lower],
        ["<", bump(lower, keep)],
      ];
    }
    case "~":
      return [
        [">=", lower],
        ["<", bump(lower, given >= 2 ? 1 : 0)],
      ];
    default:
      return given === 3
        ? [["=", lower]]
        : [
            [">=", lower],
            ["<", upper],
          ];
  }
}

/**
 * Evaluates a package.json `engines` range with npm semver semantics:
 * space-separated comparators that must all hold, `||` between
 * alternatives, x-ranges (`22.x`, `*`), and `^`/`~`. Pre-release tags are
 * ignored. `scripts/lib/setup-checks.sh` implements the same grammar for the
 * shell entrypoint, and a test runs both on the same cases.
 */
export function satisfiesVersionRange(actual: string, range: string): boolean {
  const version = toTriple(actual);
  return range.split("||").some((alternative) => {
    const comparators = alternative.trim().split(/\s+/).filter(Boolean);
    if (comparators.length === 0) return false;
    return comparators.every((comparator) => {
      const bounds = desugar(comparator);
      if (bounds === null) return false;
      return bounds.every(([operator, bound]) => {
        const difference = compareTriples(version, bound);
        switch (operator) {
          case ">=":
            return difference >= 0;
          case ">":
            return difference > 0;
          case "<=":
            return difference <= 0;
          case "<":
            return difference < 0;
          default:
            return difference === 0;
        }
      });
    });
  });
}

function readPackageJson(root: string): Record<string, unknown> {
  const raw = fs.readFileSync(path.join(root, "package.json"), "utf-8");
  return JSON.parse(raw) as Record<string, unknown>;
}

/**
 * Verifies the operating system is one this repository supports. Scripts,
 * Husky hooks, the git guardrail and several tests assume a POSIX shell and
 * POSIX tools (`bash`, `unzip`, `VAR=value` prefixes, `/` paths), and CI and
 * Vercel both run Linux. Native Windows is therefore unsupported; WSL 2
 * reports `linux` and passes (#939).
 */
export function checkSupportedPlatform(
  platform: NodeJS.Platform = process.platform
): PreflightCheckResult {
  const supported = platform !== "win32";
  return {
    id: "platform",
    label: "Supported platform",
    status: supported ? "pass" : "fail",
    message: supported
      ? `${platform} is a supported POSIX platform.`
      : "Native Windows is not supported: scripts, hooks and tests need a POSIX shell. Clone and run the repository inside WSL 2 (Ubuntu) instead. See CONTRIBUTING.md, Prerequisites.",
  };
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

  const ok = satisfiesVersionRange(actual, required);
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

  const ok = satisfiesVersionRange(actual, required);
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
 * Verifies that package.json allowScripts matches scripts/install-script-allowlist.json
 * and that all third-party dependencies with install scripts are reviewed and allowlisted.
 */
export function checkInstallScriptAllowlist(
  root: string
): PreflightCheckResult {
  const pkgPath = path.join(root, "package.json");
  const allowlistPath = path.join(
    root,
    "scripts",
    "install-script-allowlist.json"
  );
  const lockPath = path.join(root, "package-lock.json");

  if (!fs.existsSync(pkgPath) || !fs.existsSync(allowlistPath)) {
    return {
      id: "install-script-allowlist",
      label: "Lifecycle script allowlist",
      status: "fail",
      message: "Missing package.json or scripts/install-script-allowlist.json.",
    };
  }

  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    const allowlist = JSON.parse(fs.readFileSync(allowlistPath, "utf8"));

    if (!pkg.allowScripts || typeof pkg.allowScripts !== "object") {
      return {
        id: "install-script-allowlist",
        label: "Lifecycle script allowlist",
        status: "fail",
        message: "package.json is missing 'allowScripts' object.",
      };
    }

    const allowScriptsKeys = Object.keys(pkg.allowScripts).sort();
    const allowlistKeys = Object.keys(allowlist).sort();

    if (JSON.stringify(allowScriptsKeys) !== JSON.stringify(allowlistKeys)) {
      return {
        id: "install-script-allowlist",
        label: "Lifecycle script allowlist",
        status: "fail",
        message: `package.json allowScripts (${allowScriptsKeys.join(", ")}) does not match install-script-allowlist.json (${allowlistKeys.join(", ")}).`,
      };
    }

    if (fs.existsSync(lockPath)) {
      const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
      if (lock.packages && typeof lock.packages === "object") {
        const withInstallScripts = new Set(
          Object.entries(
            lock.packages as Record<string, { hasInstallScript?: boolean }>
          )
            .filter(
              ([key, meta]) => key !== "" && meta && meta.hasInstallScript
            )
            .map(([key]) => key.slice(key.lastIndexOf("node_modules/") + 13))
        );

        const unreviewed = [...withInstallScripts].filter(
          (n) => !(n in allowlist)
        );
        if (unreviewed.length > 0) {
          return {
            id: "install-script-allowlist",
            label: "Lifecycle script allowlist",
            status: "fail",
            message: `Unreviewed lifecycle script(s) found in package-lock.json: ${unreviewed.join(", ")}.`,
          };
        }
      }
    }

    return {
      id: "install-script-allowlist",
      label: "Lifecycle script allowlist",
      status: "pass",
      message:
        "package.json allowScripts matches scripts/install-script-allowlist.json.",
    };
  } catch (error) {
    return {
      id: "install-script-allowlist",
      label: "Lifecycle script allowlist",
      status: "fail",
      message: `Failed to validate lifecycle script allowlist: ${(error as Error).message}`,
    };
  }
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
    checkSupportedPlatform(),
    checkNodeVersion(root),
    checkNpmVersion(root),
    checkPrismaClientGenerated(root),
    checkTsxExecution(root),
    checkInstallScriptAllowlist(root),
  ];

  const ready = checks.every((check) => check.status !== "fail");
  return { ready, checks };
}
