#!/usr/bin/env tsx
/**
 * Regenerates the open source credits dataset and the third-party notices.
 *
 * Everything is derived from package-lock.json and the npm registry, addressed
 * by the lockfile's resolved URL and integrity hash. Nothing is read from
 * node_modules, so the output is identical on every platform, including for
 * platform-specific optional binaries that are not installed locally.
 *
 *   npm run oss:credits                      fetch what is new or changed, write all files
 *   npm run oss:credits -- --check           offline; exit 1 if any committed file is stale
 *   npm run oss:credits -- --verify-registry refetch everything and compare with the committed facts
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  buildCreditsDataset,
  diffFactsAgainstLockfile,
  fillSpdxTemplate,
  findUnannotatedDirect,
  isFactsDriftFree,
  listLockedPackages,
  noticeSourcesFromFacts,
  renderThirdPartyNotices,
  spdxIdsOf,
  templateNeedsHolder,
  type FactsStore,
  type LicenseTextRef,
  type LockedPackage,
  type LockfileShape,
  type PackageFacts,
  type RootPackageShape,
} from "../lib/oss-credits";
import {
  DIRECT_ANNOTATIONS,
  LICENSE_HOLDER_OVERRIDES,
  LICENSE_TEXT_INHERITANCE,
} from "../lib/oss-credits/presets";
import {
  fetchTarball,
  fetchVersionDocument,
  mapLimit,
  parseResolvedUrl,
  type VersionDocument,
} from "./oss-credits-fetch";

const ROOT = process.cwd();
export const DATASET_PATH = "lib/oss-credits/internal/credits.generated.json";
export const FACTS_PATH =
  "lib/oss-credits/internal/registry-facts.generated.json";
export const NOTICES_PATH = "public/third-party-notices.txt";
const SPDX_TEXT_URL =
  "https://raw.githubusercontent.com/spdx/license-list-data/main/text";

function readJson<T>(rel: string): T {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8")) as T;
}

function sha256(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function repositoryOf(value: unknown): string | null {
  if (typeof value === "string") return asString(value);
  if (value && typeof value === "object") {
    return asString((value as { url?: unknown }).url);
  }
  return null;
}

/** "Name <mail> (url)" or { name } to the bare name. */
function authorOf(value: unknown): string | null {
  const raw =
    typeof value === "string"
      ? value
      : value && typeof value === "object"
        ? ((value as { name?: unknown }).name as string | undefined)
        : undefined;
  return asString(raw?.replace(/\s*[<(].*$/, ""));
}

export function emptyStore(): FactsStore {
  return { schemaVersion: 1, packages: {}, texts: {} };
}

function inheritedParent(name: string): string | null {
  for (const rule of LICENSE_TEXT_INHERITANCE) {
    if (rule.name === name) return rule.parent;
    if (rule.prefix && name.startsWith(rule.prefix)) return rule.parent;
  }
  return null;
}

const templateCache = new Map<string, string>();
async function spdxTemplate(id: string): Promise<string> {
  const cached = templateCache.get(id);
  if (cached) return cached;
  const response = await fetch(
    `${SPDX_TEXT_URL}/${encodeURIComponent(id)}.txt`
  );
  if (!response.ok) {
    throw new Error(`no SPDX template for ${id} (HTTP ${response.status})`);
  }
  const text = await response.text();
  templateCache.set(id, text);
  return text;
}

interface Collected {
  facts: PackageFacts;
  /** Own license and notice files found in the tarball, by file name. */
  files: { name: string; text: string }[];
  noticeTexts: string[];
}

async function collectOne(pkg: LockedPackage): Promise<Collected> {
  if (!pkg.resolved || !pkg.integrity) {
    throw new Error(`${pkg.key}: lockfile has no resolved URL or integrity`);
  }
  const target = parseResolvedUrl(pkg.resolved);
  if (!target) throw new Error(`${pkg.key}: cannot read ${pkg.resolved}`);
  const doc: VersionDocument = await fetchVersionDocument(
    target.name,
    target.version
  );
  const facts: PackageFacts = {
    integrity: pkg.integrity,
    homepage: asString(doc.homepage),
    repository: repositoryOf(doc.repository),
    author: authorOf(doc.author),
    licenses: [],
    notices: [],
  };
  if (pkg.scope !== "runtime") return { facts, files: [], noticeTexts: [] };
  const tarball = await fetchTarball(pkg.resolved, pkg.integrity);
  return {
    facts,
    files: tarball.licenseFiles,
    noticeTexts: tarball.noticeFiles.map((f) => f.text),
  };
}

function addText(store: FactsStore, text: string): string {
  const sha = sha256(text);
  store.texts[sha] = text;
  return sha;
}

/**
 * Bring the facts up to date with the lockfile. Only packages that are new,
 * changed or unresolved are fetched, unless `refresh` is set.
 */
export async function collectFacts(
  lockfile: LockfileShape,
  existing: FactsStore,
  options: { refresh?: boolean; log?: (line: string) => void } = {}
): Promise<FactsStore> {
  const log = options.log ?? (() => {});
  const locked = listLockedPackages(lockfile);
  const store = emptyStore();
  const fetched = new Map<string, Collected>();

  const todo: LockedPackage[] = [];
  for (const pkg of locked) {
    const prior = existing.packages[pkg.key];
    const ownFiles = prior?.licenses.some((l) => l.kind === "file") ?? false;
    const reusable =
      !options.refresh &&
      prior &&
      prior.integrity === pkg.integrity &&
      (pkg.scope === "tooling" || ownFiles || prior.licenses.length > 0);
    if (reusable) {
      store.packages[pkg.key] = {
        ...prior,
        // Inherited and derived texts are recomputed below from current presets.
        licenses: prior.licenses.filter((l) => l.kind === "file"),
        notices: prior.notices,
      };
      for (const l of store.packages[pkg.key].licenses) {
        store.texts[l.sha] = existing.texts[l.sha];
      }
      for (const sha of prior.notices) store.texts[sha] = existing.texts[sha];
    } else {
      todo.push(pkg);
    }
  }

  log(
    `oss:credits: ${locked.length - todo.length} reused, ${todo.length} to fetch`
  );
  let done = 0;
  await mapLimit(todo, 8, async (pkg) => {
    const result = await collectOne(pkg);
    fetched.set(pkg.key, result);
    done += 1;
    if (done % 100 === 0) log(`oss:credits: fetched ${done}/${todo.length}`);
  });

  for (const pkg of todo) {
    const result = fetched.get(pkg.key)!;
    const facts = result.facts;
    for (const file of result.files) {
      facts.licenses.push({
        kind: "file",
        name: file.name,
        sha: addText(store, file.text),
      });
    }
    facts.licenses.sort((a, b) => a.name.localeCompare(b.name));
    facts.notices = result.noticeTexts.map((t) => addText(store, t)).sort();
    store.packages[pkg.key] = facts;
  }

  // Pass two: shipped packages that publish no license file of their own.
  const byName = new Map<string, LockedPackage[]>();
  for (const pkg of locked) {
    byName.set(pkg.name, [...(byName.get(pkg.name) ?? []), pkg]);
  }
  const problems: string[] = [];
  for (const pkg of locked) {
    if (pkg.scope !== "runtime") continue;
    const facts = store.packages[pkg.key];
    if (facts.licenses.some((l) => l.kind === "file")) continue;

    const parentName = inheritedParent(pkg.name);
    if (parentName) {
      const candidates = (byName.get(parentName) ?? []).filter((c) =>
        store.packages[c.key]?.licenses.some((l) => l.kind === "file")
      );
      const parent =
        candidates.find((c) => c.version === pkg.version) ?? candidates[0];
      if (!parent) {
        problems.push(
          `${pkg.key}: parent ${parentName} is not in the lockfile or ships no license file`
        );
        continue;
      }
      facts.licenses = store.packages[parent.key].licenses
        .filter((l) => l.kind === "file")
        .map<LicenseTextRef>((l) => ({
          kind: "inherited",
          name: l.name,
          sha: l.sha,
          from: parent.key,
        }));
      continue;
    }

    const holder = facts.author ?? LICENSE_HOLDER_OVERRIDES[pkg.name] ?? null;
    const ids = spdxIdsOf(pkg.license).filter((id) => id !== "UNKNOWN");
    if (!ids.length) {
      problems.push(`${pkg.key}: no declared license to derive a text from`);
      continue;
    }
    const derived: LicenseTextRef[] = [];
    for (const id of ids) {
      let template: string;
      try {
        template = await spdxTemplate(id);
      } catch (error) {
        problems.push(
          `${pkg.key}: ${error instanceof Error ? error.message : String(error)}`
        );
        continue;
      }
      if (templateNeedsHolder(template) && !holder) {
        problems.push(
          `${pkg.key}: ${id} needs a copyright holder; add one to LICENSE_HOLDER_OVERRIDES in lib/oss-credits/presets.ts`
        );
        continue;
      }
      const text = fillSpdxTemplate(template, holder ?? "");
      derived.push({
        kind: "derived",
        name: id,
        sha: addText(store, text),
        ...(templateNeedsHolder(template) && holder ? { holder } : {}),
      });
    }
    facts.licenses = derived;
  }
  if (problems.length) {
    throw new Error(
      `oss:credits could not resolve a license text for:\n  ${problems.join("\n  ")}`
    );
  }

  // Deterministic order, and only referenced texts.
  const referenced = new Set<string>();
  for (const facts of Object.values(store.packages)) {
    for (const l of facts.licenses) referenced.add(l.sha);
    for (const sha of facts.notices) referenced.add(sha);
  }
  store.texts = Object.fromEntries(
    Object.entries(store.texts)
      .filter(([sha]) => referenced.has(sha))
      .sort(([a], [b]) => a.localeCompare(b))
  );
  store.packages = Object.fromEntries(
    Object.entries(store.packages).sort(([a], [b]) => a.localeCompare(b))
  );
  return store;
}

/** Render the dataset and the notices from a facts store. Pure and offline. */
export function renderOutputs(
  store: FactsStore,
  lockfile: LockfileShape,
  root: RootPackageShape
): { dataset: string; notices: string } {
  const dataset = buildCreditsDataset({
    lockfile,
    root,
    annotations: DIRECT_ANNOTATIONS,
    facts: store,
  });
  const unannotated = findUnannotatedDirect(dataset);
  if (unannotated.length) {
    throw new Error(
      `Direct dependencies without a purpose and reason in lib/oss-credits/presets.ts: ${unannotated.join(", ")}`
    );
  }
  return {
    dataset: `${JSON.stringify(dataset, null, 2)}\n`,
    notices: renderThirdPartyNotices(noticeSourcesFromFacts(store, lockfile)),
  };
}

export function serializeFacts(store: FactsStore): string {
  return `${JSON.stringify(store, null, 2)}\n`;
}

function readCommittedFacts(): FactsStore {
  const file = path.join(ROOT, FACTS_PATH);
  return fs.existsSync(file) ? readJson<FactsStore>(FACTS_PATH) : emptyStore();
}

function readIfExists(rel: string): string {
  const file = path.join(ROOT, rel);
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}

async function main(): Promise<void> {
  const check = process.argv.includes("--check");
  const verifyRegistry = process.argv.includes("--verify-registry");
  const lockfile = readJson<LockfileShape>("package-lock.json");
  const root = readJson<RootPackageShape>("package.json");
  const committed = readCommittedFacts();

  const store = check
    ? committed
    : await collectFacts(lockfile, committed, {
        refresh: verifyRegistry,
        log: (line) => console.log(line),
      });

  if (check) {
    const drift = diffFactsAgainstLockfile(store, lockfile);
    if (!isFactsDriftFree(drift)) {
      for (const [label, list] of Object.entries(drift)) {
        if (list.length) {
          console.error(
            `oss:credits: ${label}: ${list.slice(0, 10).join(", ")}`
          );
        }
      }
      console.error(
        "oss:credits: facts are out of date. Run: npm run oss:credits"
      );
      process.exit(1);
    }
  }

  const outputs = renderOutputs(store, lockfile, root);
  const targets: [string, string][] = [
    [FACTS_PATH, serializeFacts(store)],
    [DATASET_PATH, outputs.dataset],
    [NOTICES_PATH, outputs.notices],
  ];
  let stale = false;
  for (const [rel, content] of targets) {
    if (check || verifyRegistry) {
      if (readIfExists(rel) !== content) {
        stale = true;
        console.error(
          `oss:credits: ${rel} is out of date. Run: npm run oss:credits`
        );
      }
    } else {
      fs.writeFileSync(path.join(ROOT, rel), content);
      console.log(`oss:credits: wrote ${rel}`);
    }
  }
  if (stale) process.exit(1);
}

if (process.argv[1] && /oss-credits\.ts$/.test(process.argv[1])) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
