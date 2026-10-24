#!/usr/bin/env tsx
/**
 * Brings the files that follow package-lock.json back in line after a
 * dependency bump, such as a Dependabot PR (#2730):
 *
 *   1. Every `mcr.microsoft.com/playwright` image in .github/workflows moves to
 *      the locked @playwright/test version, pinned by the image index digest
 *      (__tests__/ci-toolchain-pinning.test.ts).
 *   2. `npm run oss:credits` regenerates the credits and notices.
 *
 *   npm run deps:fix            rewrite what is stale
 *   npm run deps:fix -- --check offline; exit 1 if anything is stale
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const WORKFLOW_DIR = path.join(ROOT, ".github", "workflows");
const REGISTRY = "https://mcr.microsoft.com/v2/playwright/manifests";
const IMAGE_PATTERN =
  /mcr\.microsoft\.com\/playwright:v([\d.]+)-noble@sha256:([0-9a-f]{64})/g;

/** The @playwright/test version package-lock.json resolves. */
export function lockedPlaywrightVersion(lockfileText: string): string {
  const lock = JSON.parse(lockfileText) as {
    packages: Record<string, { version?: string }>;
  };
  const version = lock.packages["node_modules/@playwright/test"]?.version;
  if (!version) throw new Error("package-lock.json has no @playwright/test");
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
  const version = lockedPlaywrightVersion(
    fs.readFileSync(path.join(ROOT, "package-lock.json"), "utf8")
  );
  const stale = fs
    .readdirSync(WORKFLOW_DIR)
    .filter((file) => /\.ya?ml$/.test(file))
    .filter((file) => {
      const text = fs.readFileSync(path.join(WORKFLOW_DIR, file), "utf8");
      return pinnedPlaywrightVersions(text).some((v) => v !== version);
    });

  if (check) {
    for (const file of stale) {
      console.error(`deps:fix: ${file} does not pin Playwright ${version}`);
    }
    execFileSync("npm", ["run", "--silent", "oss:credits", "--", "--check"], {
      stdio: "inherit",
    });
    if (stale.length > 0) process.exit(1);
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
  execFileSync("npm", ["run", "--silent", "oss:credits"], { stdio: "inherit" });
}

if (process.argv[1] && /deps-fix\.ts$/.test(process.argv[1])) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
