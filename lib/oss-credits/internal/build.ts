import type {
  CreditPackage,
  CreditsDataset,
  DirectAnnotation,
  FactsStore,
  LockfileShape,
  RootPackageShape,
} from "../types";
import { normalizeProjectUrl } from "./urls";

const NODE_MODULES = "node_modules/";

function packageNameFromPath(lockPath: string): string | null {
  const index = lockPath.lastIndexOf(NODE_MODULES);
  return index === -1 ? null : lockPath.slice(index + NODE_MODULES.length);
}

/**
 * Build the credits dataset from a parsed lockfile and the committed registry
 * facts. Pure: it never touches the filesystem or the network. When a package
 * is installed at several versions, each version is listed.
 */
export function buildCreditsDataset(input: {
  lockfile: LockfileShape;
  root: RootPackageShape;
  annotations: Record<string, DirectAnnotation>;
  facts: FactsStore;
}): CreditsDataset {
  const direct = new Set([
    ...Object.keys(input.root.dependencies ?? {}),
    ...Object.keys(input.root.devDependencies ?? {}),
  ]);
  const seen = new Set<string>();
  const packages: CreditPackage[] = [];

  for (const [lockPath, entry] of Object.entries(input.lockfile.packages)) {
    if (lockPath === "" || entry.link) continue;
    const name = packageNameFromPath(lockPath);
    if (!name || !entry.version) continue;
    const key = `${name}@${entry.version}`;
    const isTopLevel = lockPath === `${NODE_MODULES}${name}`;
    // A direct dependency is always the top-level install of that name.
    const isDirect = isTopLevel && direct.has(name);
    const facts = input.facts.packages[`${name}@${entry.version}`];
    const scope = entry.dev ? "tooling" : "runtime";
    const existing = packages.find((p) => `${p.name}@${p.version}` === key);
    if (existing) {
      // Same version installed twice: shipped wins, direct wins.
      if (scope === "runtime") existing.scope = "runtime";
      if (isDirect) existing.direct = true;
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    const annotation = isDirect ? input.annotations[name] : undefined;
    packages.push({
      name,
      version: entry.version,
      license: entry.license?.trim() || "UNKNOWN",
      scope,
      direct: isDirect,
      homepage: normalizeProjectUrl(facts?.homepage ?? undefined),
      repository: normalizeProjectUrl(facts?.repository ?? undefined),
      ...(annotation
        ? { group: annotation.group, reason: annotation.reason }
        : {}),
    });
  }

  packages.sort(
    (a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version)
  );
  const runtime = packages.filter((p) => p.scope === "runtime").length;
  return {
    schemaVersion: 1,
    source: "package-lock.json",
    counts: {
      total: packages.length,
      runtime,
      tooling: packages.length - runtime,
      direct: packages.filter((p) => p.direct).length,
    },
    packages,
  };
}

/** Direct dependencies that have no curated purpose group and reason. */
export function findUnannotatedDirect(dataset: CreditsDataset): string[] {
  return dataset.packages
    .filter((p) => p.direct && (!p.group || !p.reason))
    .map((p) => p.name);
}

/** Group the direct runtime dependencies by purpose, in a stable order. */
export function groupDirectRuntimeByPurpose(
  dataset: CreditsDataset
): { group: string; packages: CreditPackage[] }[] {
  const groups = new Map<string, CreditPackage[]>();
  for (const pkg of dataset.packages) {
    if (!pkg.direct || pkg.scope !== "runtime" || !pkg.group) continue;
    groups.set(pkg.group, [...(groups.get(pkg.group) ?? []), pkg]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([group, packages]) => ({ group, packages }));
}

/** Count shipped packages per license expression, most common first. */
export function countByLicense(
  dataset: CreditsDataset,
  scope: "runtime" | "tooling" = "runtime"
): { license: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const pkg of dataset.packages) {
    if (pkg.scope !== scope) continue;
    counts.set(pkg.license, (counts.get(pkg.license) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([license, count]) => ({ license, count }))
    .sort((a, b) => b.count - a.count || a.license.localeCompare(b.license));
}
