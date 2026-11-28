#!/usr/bin/env tsx
/**
 * Brings the files that follow package-lock.json and infra/docker/postgres/Dockerfile
 * back in line after a dependency bump, such as a Dependabot PR (#2730):
 *
 *   1. Every `mcr.microsoft.com/playwright` image in .github/workflows moves to
 *      the locked @playwright/test version, pinned by the image index digest
 *      (__tests__/ci-toolchain-pinning.test.ts).
 *   2. Every `postgres:17@sha256:...` reference in .github/workflows and
 *      scripts/migration-replay.ts matches infra/docker/postgres/Dockerfile.
 *   3. Vendored DuckDB wasm_eh extensions (`json.duckdb_extension.wasm`,
 *      `parquet.duckdb_extension.wasm`) and their SHA-256 digests in
 *      `components/platform/sql/extensions/README.md` match the installed
 *      `@duckdb/duckdb-wasm` package and engine version.
 *   4. `npm run oss:credits` regenerates the credits and notices.
 *   5. `npm run audit:overrides -- --check` verifies npm overrides are still needed.
 *
 *   npm run deps:fix            rewrite what is stale
 *   npm run deps:fix -- --check offline; exit 1 if anything is stale
 */
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const ROOT = process.cwd();
const WORKFLOW_DIR = path.join(ROOT, ".github", "workflows");
const POSTGRES_DOCKERFILE = path.join(
  ROOT,
  "infra",
  "docker",
  "postgres",
  "Dockerfile"
);
const POSTGRES_TARGETS = [
  path.join(WORKFLOW_DIR, "ci.yml"),
  path.join(WORKFLOW_DIR, "neon-backup.yml"),
  path.join(ROOT, "scripts", "migration-replay.ts"),
];
const DUCKDB_EXT_DIR = path.join(
  ROOT,
  "components",
  "platform",
  "sql",
  "extensions"
);
const DUCKDB_README_PATH = path.join(DUCKDB_EXT_DIR, "README.md");
export const DUCKDB_EXTENSION_FILES = [
  "json.duckdb_extension.wasm",
  "parquet.duckdb_extension.wasm",
] as const;

const REGISTRY = "https://mcr.microsoft.com/v2/playwright/manifests";
const IMAGE_PATTERN =
  /mcr\.microsoft\.com\/playwright:v([\d.]+)-noble@sha256:([0-9a-f]{64})/g;
const POSTGRES_PIN_PATTERN = /postgres:17@sha256:[0-9a-f]{64}/g;

/** The @playwright/test version package-lock.json resolves. */
export function lockedPlaywrightVersion(lockfileText: string): string {
  const lock = JSON.parse(lockfileText) as {
    packages: Record<string, { version?: string }>;
  };
  const version = lock.packages["node_modules/@playwright/test"]?.version;
  if (!version) throw new Error("package-lock.json has no @playwright/test");
  return version;
}

/** The @duckdb/duckdb-wasm version package-lock.json resolves. */
export function lockedDuckdbWasmVersion(lockfileText: string): string {
  const lock = JSON.parse(lockfileText) as {
    packages: Record<string, { version?: string }>;
  };
  const version = lock.packages["node_modules/@duckdb/duckdb-wasm"]?.version;
  if (!version) {
    throw new Error("package-lock.json has no @duckdb/duckdb-wasm");
  }
  return version;
}

/** Image versions a workflow pins, in order of appearance. */
export function pinnedPlaywrightVersions(workflowText: string): string[] {
  return [...workflowText.matchAll(IMAGE_PATTERN)].map((match) => match[1]);
}

/** Points every Playwright image in a workflow at one version and digest. */
export function rewritePlaywrightImages(
  workflowText: string,
  version: string,
  digest: string
): string {
  if (!/^sha256:[0-9a-f]{64}$/.test(digest)) {
    throw new Error(`not an image digest: ${digest}`);
  }
  return workflowText.replace(
    IMAGE_PATTERN,
    `mcr.microsoft.com/playwright:v${version}-noble@${digest}`
  );
}

/** Reads the canonical `postgres:17@sha256:...` pin from infra/docker/postgres/Dockerfile. */
export function canonicalPostgresPin(dockerfileText: string): string {
  const match = dockerfileText.match(
    /^FROM\s+(postgres:17@sha256:[0-9a-f]{64})\s*$/m
  );
  if (!match) {
    throw new Error(
      "infra/docker/postgres/Dockerfile must contain FROM postgres:17@sha256:<64-hex>"
    );
  }
  return match[1];
}

/** Rewrites all `postgres:17@sha256:...` pins in a file to the canonical pin. */
export function rewritePostgresImages(text: string, pin: string): string {
  if (!/^postgres:17@sha256:[0-9a-f]{64}$/.test(pin)) {
    throw new Error(`not a canonical postgres:17 digest pin: ${pin}`);
  }
  return text.replace(POSTGRES_PIN_PATTERN, pin);
}

export interface ParsedDuckdbExtensionsReadme {
  npmVersion: string;
  duckdbVersion: string;
  entries: Array<{
    file: string;
    duckdbVersion: string;
    platform: string;
    sourceUrl: string;
    sha256: string;
  }>;
}

/** Extracts the pinned npm version, DuckDB version, and SHA-256 rows from README.md. */
export function parseDuckdbExtensionsReadme(
  readmeText: string
): ParsedDuckdbExtensionsReadme {
  const npmMatch = readmeText.match(
    /^- npm package: `@duckdb\/duckdb-wasm` `([^`]+)`$/m
  );
  const duckdbMatch = readmeText.match(/^- DuckDB version: `(v[\d.]+)`$/m);
  if (!npmMatch || !duckdbMatch) {
    throw new Error(
      "components/platform/sql/extensions/README.md is missing @duckdb/duckdb-wasm or DuckDB version metadata"
    );
  }

  const rowPattern =
    /^\|\s*`([^`]+\.duckdb_extension\.wasm)`\s*\|\s*`(v[\d.]+)`\s*\|\s*`([^`]+)`\s*\|\s*`(https:\/\/extensions\.duckdb\.org\/[^`]+)`\s*\|\s*`([0-9a-f]{64})`\s*\|$/gm;
  const entries = [...readmeText.matchAll(rowPattern)].map((m) => ({
    file: m[1],
    duckdbVersion: m[2],
    platform: m[3],
    sourceUrl: m[4],
    sha256: m[5],
  }));

  if (entries.length !== DUCKDB_EXTENSION_FILES.length) {
    throw new Error(
      `Expected ${DUCKDB_EXTENSION_FILES.length} extension rows in components/platform/sql/extensions/README.md, found ${entries.length}`
    );
  }

  return {
    npmVersion: npmMatch[1],
    duckdbVersion: duckdbMatch[1],
    entries,
  };
}

/** Updates npm version, DuckDB engine version, source URLs, and SHA-256 digests in README.md. */
export function rewriteDuckdbExtensionsReadme(
  readmeText: string,
  params: {
    npmVersion: string;
    duckdbVersion: string;
    digests: Readonly<Record<string, string>>;
  }
): string {
  const { npmVersion, duckdbVersion, digests } = params;
  if (!/^v\d+\.\d+\.\d+$/.test(duckdbVersion)) {
    throw new Error(`Invalid DuckDB version: ${duckdbVersion}`);
  }
  for (const file of DUCKDB_EXTENSION_FILES) {
    const digest = digests[file];
    if (!digest || !/^[0-9a-f]{64}$/.test(digest)) {
      throw new Error(`Missing or invalid SHA-256 digest for ${file}`);
    }
  }

  let updated = readmeText
    .replace(
      /^- npm package: `@duckdb\/duckdb-wasm` `[^`]+`$/m,
      `- npm package: \`@duckdb/duckdb-wasm\` \`${npmVersion}\``
    )
    .replace(
      /^- DuckDB version: `v[\d.]+`$/m,
      `- DuckDB version: \`${duckdbVersion}\``
    );

  const maxUrlCellWidth = Math.max(
    "Source URL".length,
    ...DUCKDB_EXTENSION_FILES.map(
      (f) =>
        `\`https://extensions.duckdb.org/${duckdbVersion}/wasm_eh/${f}\``.length
    )
  );

  for (const file of DUCKDB_EXTENSION_FILES) {
    const url = `https://extensions.duckdb.org/${duckdbVersion}/wasm_eh/${file}`;
    const digest = digests[file];
    const escapedFile = file.replace(/\./g, "\\.");
    const rowRegex = new RegExp(
      `^\\|\\s*\`${escapedFile}\`\\s*\\|\\s*\`v[\\d.]+\`\\s*\\|\\s*\`wasm_eh\`\\s*\\|\\s*\`https:\\/\\/extensions\\.duckdb\\.org\\/[^\`]+\`\\s*\\|\\s*\`[0-9a-f]{64}\`\\s*\\|$`,
      "m"
    );
    if (!rowRegex.test(updated)) {
      throw new Error(`Could not find table row for ${file} in README.md`);
    }
    const fileCell = `\`${file}\``.padEnd(31);
    const versionCell = `\`${duckdbVersion}\``.padEnd(14);
    const urlCell = `\`${url}\``.padEnd(maxUrlCellWidth);
    updated = updated.replace(
      rowRegex,
      `| ${fileCell} | ${versionCell} | \`wasm_eh\` | ${urlCell} | \`${digest}\` |`
    );
  }

  return updated;
}

/** Instantiates installed `@duckdb/duckdb-wasm/blocking` to read the exact engine version. */
export async function installedDuckdbEngineVersion(): Promise<string> {
  const req = createRequire(import.meta.url);
  const blockingEntry = req.resolve("@duckdb/duckdb-wasm/blocking");
  const dist = path.dirname(blockingEntry);
  const { createDuckDB, VoidLogger, NODE_RUNTIME } = req(
    "@duckdb/duckdb-wasm/blocking"
  ) as {
    createDuckDB: (
      bundles: {
        mvp: { mainModule: string; mainWorker: string };
        eh: { mainModule: string; mainWorker: string };
      },
      logger: unknown,
      runtime: unknown
    ) => Promise<{
      instantiate: (cb: () => void) => Promise<void>;
      getVersion: () => string;
      reset: () => void;
    }>;
    VoidLogger: new () => unknown;
    NODE_RUNTIME: unknown;
  };
  const db = await createDuckDB(
    {
      mvp: { mainModule: path.join(dist, "duckdb-mvp.wasm"), mainWorker: "" },
      eh: { mainModule: path.join(dist, "duckdb-eh.wasm"), mainWorker: "" },
    },
    new VoidLogger(),
    NODE_RUNTIME
  );
  try {
    await db.instantiate(() => {});
    return db.getVersion();
  } finally {
    db.reset();
  }
}

/** Checks DuckDB extensions and README.md offline, returning human-readable drift messages. */
export function checkDuckdbExtensionsDrift(params: {
  extDir: string;
  readmeText: string;
  lockedNpmVersion: string;
  engineVersion: string;
}): string[] {
  const issues: string[] = [];
  const parsed = parseDuckdbExtensionsReadme(params.readmeText);

  if (parsed.npmVersion !== params.lockedNpmVersion) {
    issues.push(
      `components/platform/sql/extensions/README.md pins @duckdb/duckdb-wasm ${parsed.npmVersion}, locked is ${params.lockedNpmVersion}`
    );
  }
  if (parsed.duckdbVersion !== params.engineVersion) {
    issues.push(
      `components/platform/sql/extensions/README.md pins DuckDB ${parsed.duckdbVersion}, engine reports ${params.engineVersion}`
    );
  }

  for (const file of DUCKDB_EXTENSION_FILES) {
    const entry = parsed.entries.find((e) => e.file === file);
    if (!entry) {
      issues.push(
        `components/platform/sql/extensions/README.md is missing row for ${file}`
      );
      continue;
    }
    if (entry.duckdbVersion !== params.engineVersion) {
      issues.push(
        `${file} table row pins ${entry.duckdbVersion}, expected ${params.engineVersion}`
      );
    }
    const wasmPath = path.join(params.extDir, file);
    if (!fs.existsSync(wasmPath)) {
      issues.push(`Missing vendored DuckDB extension binary: ${file}`);
      continue;
    }
    const actualSha256 = crypto
      .createHash("sha256")
      .update(fs.readFileSync(wasmPath))
      .digest("hex");
    if (actualSha256 !== entry.sha256) {
      issues.push(
        `${file} SHA-256 (${actualSha256}) does not match README.md (${entry.sha256})`
      );
    }
  }

  return issues;
}

/** Downloads both wasm_eh DuckDB extensions for `engineVersion` and updates README.md. */
export async function refreshDuckdbExtensions(params: {
  extDir: string;
  readmePath: string;
  lockedNpmVersion: string;
  engineVersion: string;
  fetchImpl?: typeof fetch;
}): Promise<Record<string, string>> {
  const fetcher = params.fetchImpl ?? fetch;
  const digests: Record<string, string> = {};

  for (const file of DUCKDB_EXTENSION_FILES) {
    const url = `https://extensions.duckdb.org/${params.engineVersion}/wasm_eh/${file}`;
    const response = await fetcher(url);
    if (!response.ok) {
      throw new Error(
        `Failed to download DuckDB extension ${url} (HTTP ${response.status})`
      );
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (
      bytes.length < 8 ||
      bytes[0] !== 0x00 ||
      bytes[1] !== 0x61 ||
      bytes[2] !== 0x73 ||
      bytes[3] !== 0x6d
    ) {
      throw new Error(
        `Downloaded payload from ${url} is not a valid WebAssembly binary`
      );
    }
    fs.writeFileSync(path.join(params.extDir, file), bytes);
    digests[file] = crypto.createHash("sha256").update(bytes).digest("hex");
  }

  const currentReadme = fs.readFileSync(params.readmePath, "utf8");
  const nextReadme = rewriteDuckdbExtensionsReadme(currentReadme, {
    npmVersion: params.lockedNpmVersion,
    duckdbVersion: params.engineVersion,
    digests,
  });
  fs.writeFileSync(params.readmePath, nextReadme);
  return digests;
}

/** Digest of the multi-platform image index, the one `docker pull` resolves. */
async function fetchIndexDigest(version: string): Promise<string> {
  const response = await fetch(`${REGISTRY}/v${version}-noble`, {
    method: "HEAD",
    headers: {
      Accept:
        "application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.list.v2+json",
    },
  });
  const digest = response.headers.get("docker-content-digest");
  if (!response.ok || !digest) {
    throw new Error(
      `no Playwright image v${version}-noble on MCR (HTTP ${response.status})`
    );
  }
  return digest;
}

async function main(): Promise<void> {
  const check = process.argv.includes("--check");
  const lockText = fs.readFileSync(
    path.join(ROOT, "package-lock.json"),
    "utf8"
  );
  const version = lockedPlaywrightVersion(lockText);
  const stale = fs
    .readdirSync(WORKFLOW_DIR)
    .filter((file) => /\.ya?ml$/.test(file))
    .filter((file) => {
      const text = fs.readFileSync(path.join(WORKFLOW_DIR, file), "utf8");
      return pinnedPlaywrightVersions(text).some((v) => v !== version);
    });

  const postgresPin = canonicalPostgresPin(
    fs.readFileSync(POSTGRES_DOCKERFILE, "utf8")
  );
  const stalePostgres = POSTGRES_TARGETS.filter((target) => {
    const text = fs.readFileSync(target, "utf8");
    const matches = [...text.matchAll(POSTGRES_PIN_PATTERN)].map((m) => m[0]);
    return matches.length === 0 || matches.some((m) => m !== postgresPin);
  });

  const lockedDuckdb = lockedDuckdbWasmVersion(lockText);
  const duckdbEngine = await installedDuckdbEngineVersion();
  const duckdbDrift = checkDuckdbExtensionsDrift({
    extDir: DUCKDB_EXT_DIR,
    readmeText: fs.readFileSync(DUCKDB_README_PATH, "utf8"),
    lockedNpmVersion: lockedDuckdb,
    engineVersion: duckdbEngine,
  });

  if (check) {
    for (const file of stale) {
      console.error(`deps:fix: ${file} does not pin Playwright ${version}`);
    }
    for (const target of stalePostgres) {
      console.error(
        `deps:fix: ${path.relative(ROOT, target)} does not match ${postgresPin}`
      );
    }
    for (const issue of duckdbDrift) {
      console.error(`deps:fix: ${issue}`);
    }
    execFileSync("npm", ["run", "--silent", "oss:credits", "--", "--check"], {
      stdio: "inherit",
    });
    if (
      stale.length > 0 ||
      stalePostgres.length > 0 ||
      duckdbDrift.length > 0
    ) {
      process.exit(1);
    }
    return;
  }

  if (stale.length > 0) {
    const digest = await fetchIndexDigest(version);
    for (const file of stale) {
      const target = path.join(WORKFLOW_DIR, file);
      const text = fs.readFileSync(target, "utf8");
      fs.writeFileSync(target, rewritePlaywrightImages(text, version, digest));
      console.log(`deps:fix: ${file} now pins Playwright ${version}`);
    }
  }

  for (const target of stalePostgres) {
    const text = fs.readFileSync(target, "utf8");
    fs.writeFileSync(target, rewritePostgresImages(text, postgresPin));
    console.log(
      `deps:fix: ${path.relative(ROOT, target)} now pins ${postgresPin}`
    );
  }

  if (duckdbDrift.length > 0) {
    await refreshDuckdbExtensions({
      extDir: DUCKDB_EXT_DIR,
      readmePath: DUCKDB_README_PATH,
      lockedNpmVersion: lockedDuckdb,
      engineVersion: duckdbEngine,
    });
    console.log(
      `deps:fix: refreshed DuckDB extensions for @duckdb/duckdb-wasm ${lockedDuckdb} (${duckdbEngine})`
    );
  }

  execFileSync("npm", ["run", "--silent", "oss:credits"], { stdio: "inherit" });
  execFileSync("npm", ["run", "--silent", "audit:overrides", "--", "--check"], {
    stdio: "inherit",
  });
}

if (process.argv[1] && /deps-fix\.ts$/.test(process.argv[1])) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
