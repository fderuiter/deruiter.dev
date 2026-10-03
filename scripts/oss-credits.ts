#!/usr/bin/env tsx
/**
 * Regenerates the open source credits dataset and the third-party notices from
 * package-lock.json and the installed packages.
 *
 *   npm run oss:credits           write both files
 *   npm run oss:credits -- --check  exit 1 if either is out of date
 *
 * Run it on Linux x64 (CI or the dev container): platform-specific binaries are
 * only installed on their own platform, and which of them ship a license file
 * differs. The drift test compares package sets, which are platform-independent.
 */
import fs from "node:fs";
import path from "node:path";
import {
  buildCreditsDataset,
  findUnannotatedDirect,
  renderThirdPartyNotices,
  type LockfileShape,
  type NoticeSource,
  type PackageMeta,
  type RootPackageShape,
} from "../lib/oss-credits";
import { DIRECT_ANNOTATIONS } from "../lib/oss-credits/presets";

const ROOT = process.cwd();
export const DATASET_PATH = "lib/oss-credits/internal/credits.generated.json";
export const NOTICES_PATH = "public/third-party-notices.txt";

const LICENSE_FILE = /^(licen[sc]e|copying|unlicen[sc]e)(\.|$|-)/i;
const NOTICE_FILE = /^notice(\.|$)/i;

function readJson<T>(rel: string): T {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8")) as T;
}

function readMeta(lockPath: string): PackageMeta | null {
  const file = path.join(ROOT, lockPath, "package.json");
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8")) as PackageMeta;
}

function readFirstMatching(dir: string, pattern: RegExp): string | undefined {
  if (!fs.existsSync(dir)) return undefined;
  const hit = fs
    .readdirSync(dir)
    .filter((f) => pattern.test(f) && fs.statSync(path.join(dir, f)).isFile())
    .sort()[0];
  return hit ? fs.readFileSync(path.join(dir, hit), "utf8") : undefined;
}

export function generate(): {
  dataset: string;
  notices: string;
  undocumented: string[];
} {
  const lockfile = readJson<LockfileShape>("package-lock.json");
  const root = readJson<RootPackageShape>("package.json");
  const dataset = buildCreditsDataset({
    lockfile,
    root,
    annotations: DIRECT_ANNOTATIONS,
    readMeta,
  });

  const unannotated = findUnannotatedDirect(dataset);
  if (unannotated.length) {
    throw new Error(
      `Direct dependencies without a purpose and reason in lib/oss-credits/presets.ts: ${unannotated.join(", ")}`
    );
  }
  const unknown = dataset.packages.filter((p) => p.license === "UNKNOWN");
  if (unknown.length) {
    // Visible, never silent: the license audit decides whether an exception covers it.
    console.warn(
      `oss:credits: ${unknown.length} package(s) report no license: ${unknown.map((p) => `${p.name}@${p.version}`).join(", ")}`
    );
  }

  const lockPathByKey = new Map<string, string>();
  for (const lockPath of Object.keys(lockfile.packages)) {
    const entry = lockfile.packages[lockPath];
    const marker = "node_modules/";
    const index = lockPath.lastIndexOf(marker);
    if (index === -1 || !entry.version) continue;
    const key = `${lockPath.slice(index + marker.length)}@${entry.version}`;
    if (!lockPathByKey.has(key)) lockPathByKey.set(key, lockPath);
  }

  const sources: NoticeSource[] = [];
  const undocumented: string[] = [];
  for (const pkg of dataset.packages.filter((p) => p.scope === "runtime")) {
    const dir = path.join(
      ROOT,
      lockPathByKey.get(`${pkg.name}@${pkg.version}`) ?? ""
    );
    const licenseText = readFirstMatching(dir, LICENSE_FILE);
    const noticeText = readFirstMatching(dir, NOTICE_FILE);
    if (licenseText) {
      sources.push({
        name: pkg.name,
        version: pkg.version,
        license: pkg.license,
        licenseText,
        noticeText,
      });
    } else {
      undocumented.push(`${pkg.name}@${pkg.version} (${pkg.license})`);
    }
  }

  let notices = renderThirdPartyNotices(sources);
  notices = notices.replace(
    /\n$/,
    [
      "",
      "=".repeat(78),
      "PACKAGES THAT DISTRIBUTE NO LICENSE FILE",
      "",
      "The packages below declare their license by SPDX identifier in package",
      "metadata only (including platform-specific binaries that are not installed",
      "on every platform). The identifier is the license that applies; the license",
      "text is published by the SPDX License List at https://spdx.org/licenses/.",
      "",
      ...[...undocumented].sort(),
      "",
    ].join("\n")
  );
  return {
    dataset: `${JSON.stringify(dataset, null, 2)}\n`,
    notices,
    undocumented,
  };
}

function main(): void {
  const check = process.argv.includes("--check");
  const { dataset, notices } = generate();
  const targets: [string, string][] = [
    [DATASET_PATH, dataset],
    [NOTICES_PATH, notices],
  ];
  let stale = false;
  for (const [rel, content] of targets) {
    const file = path.join(ROOT, rel);
    const current = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
    if (check) {
      if (current !== content) {
        stale = true;
        console.error(
          `oss:credits: ${rel} is out of date. Run: npm run oss:credits`
        );
      }
    } else {
      fs.writeFileSync(file, content);
      console.log(`oss:credits: wrote ${rel}`);
    }
  }
  if (stale) process.exit(1);
}

if (process.argv[1] && /oss-credits\.ts$/.test(process.argv[1])) main();
