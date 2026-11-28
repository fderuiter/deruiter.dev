import type {
  FactsDrift,
  FactsStore,
  LockedPackage,
  LockfileEntry,
  LockfileShape,
  NoticeSource,
  PackageFacts,
} from "../types";

const NODE_MODULES = "node_modules/";

export function packageNameFromLockPath(lockPath: string): string | null {
  const index = lockPath.lastIndexOf(NODE_MODULES);
  return index === -1 ? null : lockPath.slice(index + NODE_MODULES.length);
}

function resolveLockPath(
  packages: Record<string, LockfileEntry>,
  fromPath: string,
  depName: string
): string | null {
  let cursor = fromPath;
  for (;;) {
    const candidate = cursor
      ? `${cursor}/${NODE_MODULES}${depName}`
      : `${NODE_MODULES}${depName}`;
    if (Object.prototype.hasOwnProperty.call(packages, candidate)) {
      return candidate;
    }
    if (!cursor) return null;
    const parentIndex = cursor.lastIndexOf(`/${NODE_MODULES}`);
    cursor = parentIndex === -1 ? "" : cursor.slice(0, parentIndex);
  }
}

/**
 * Verified build-time-only dependency edges declared inside runtime SDK
 * manifests (`withSentryConfig` bundler plugins and Rollup helpers). These
 * packages run only during `next build` and never ship in `.next` server or
 * browser bundles.
 */
export const BUILD_ONLY_DEPENDENCY_EDGES: Readonly<
  Record<string, ReadonlySet<string>>
> = {
  "@sentry/nextjs": new Set([
    "@sentry/bundler-plugins",
    "@rollup/plugin-commonjs",
    "rollup",
  ]),
  "@sentry/node": new Set(["@sentry/bundler-plugins"]),
};

/**
 * Lockfile install paths reachable from `packages[""]` by walking
 * `dependencies`, `optionalDependencies`, and required `peerDependencies` with
 * Node module resolution, skipping optional `peerDependenciesMeta` and verified
 * `BUILD_ONLY_DEPENDENCY_EDGES` edges.
 */
export function computeShippedLockPaths(lockfile: LockfileShape): Set<string> {
  const packages = lockfile.packages;
  const shipped = new Set<string>();
  if (!Object.prototype.hasOwnProperty.call(packages, "")) {
    return shipped;
  }

  const bundledPaths = Object.entries(packages)
    .filter(
      ([lockPath, entry]) => lockPath !== "" && !entry.link && entry.inBundle
    )
    .map(([lockPath]) => lockPath)
    .sort((a, b) => a.length - b.length);

  const queue: string[] = [""];
  let head = 0;

  while (head < queue.length) {
    while (head < queue.length) {
      const currentPath = queue[head++];
      const entry = packages[currentPath];
      if (!entry) continue;

      const currentName =
        currentPath === ""
          ? null
          : (entry.name ?? packageNameFromLockPath(currentPath));
      const ignoredEdges = currentName
        ? BUILD_ONLY_DEPENDENCY_EDGES[currentName]
        : undefined;

      const edges = new Set<string>([
        ...Object.keys(entry.dependencies ?? {}),
        ...Object.keys(entry.optionalDependencies ?? {}),
      ]);
      if (entry.peerDependencies) {
        for (const peer of Object.keys(entry.peerDependencies)) {
          if (!entry.peerDependenciesMeta?.[peer]?.optional) {
            edges.add(peer);
          }
        }
      }

      for (const depName of edges) {
        if (ignoredEdges?.has(depName)) continue;
        const targetPath = resolveLockPath(packages, currentPath, depName);
        if (!targetPath || shipped.has(targetPath)) continue;
        const target = packages[targetPath];
        if (!target || target.link) continue;
        shipped.add(targetPath);
        queue.push(targetPath);
      }
    }

    for (const lockPath of bundledPaths) {
      if (shipped.has(lockPath)) continue;
      const parentIndex = lockPath.lastIndexOf(`/${NODE_MODULES}`);
      if (parentIndex !== -1 && shipped.has(lockPath.slice(0, parentIndex))) {
        shipped.add(lockPath);
        queue.push(lockPath);
      }
    }
  }

  return shipped;
}

/**
 * Every distinct name@version in the lockfile, shipped when any install of it
 * is shipped. The first resolved URL and integrity hash win; installs of one
 * version share both.
 */
export function listLockedPackages(lockfile: LockfileShape): LockedPackage[] {
  const shipped = computeShippedLockPaths(lockfile);
  const byKey = new Map<string, LockedPackage>();
  for (const [lockPath, entry] of Object.entries(lockfile.packages)) {
    if (lockPath === "" || entry.link) continue;
    const isShipped = shipped.has(lockPath);
    // An unshipped bundled dependency ships inside its parent's tarball, has no
    // registry tarball of its own and never reaches visitors. A shipped one
    // still needs its own notice, so it falls through and fails loudly.
    if (entry.inBundle && !isShipped) continue;
    // An npm alias installs under another name; credit what was published.
    const name = entry.name ?? packageNameFromLockPath(lockPath);
    if (!name || !entry.version) continue;
    const key = `${name}@${entry.version}`;
    const scope = isShipped ? "runtime" : "tooling";
    const prior = byKey.get(key);
    if (prior) {
      if (scope === "runtime") prior.scope = "runtime";
      continue;
    }
    byKey.set(key, {
      key,
      name,
      version: entry.version,
      scope,
      license: entry.license?.trim() || "UNKNOWN",
      resolved: entry.resolved ?? null,
      integrity: entry.integrity ?? null,
    });
  }
  return [...byKey.values()].sort(
    (a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version)
  );
}

/** Compare committed registry facts with the lockfile. Needs no node_modules and no network. */
export function diffFactsAgainstLockfile(
  store: FactsStore,
  lockfile: LockfileShape
): FactsDrift {
  const locked = listLockedPackages(lockfile);
  const lockedKeys = new Set(locked.map((p) => p.key));
  const missing: string[] = [];
  const integrityChanged: string[] = [];
  const unresolved: string[] = [];
  const referenced = new Set<string>();
  const brokenTexts: string[] = [];

  for (const pkg of locked) {
    const facts = store.packages[pkg.key];
    if (!facts) {
      missing.push(pkg.key);
      continue;
    }
    if (facts.integrity !== (pkg.integrity ?? "")) {
      integrityChanged.push(pkg.key);
    }
    for (const ref of facts.licenses) {
      referenced.add(ref.sha);
      if (!store.texts[ref.sha]?.trim())
        brokenTexts.push(`${pkg.key} ${ref.sha}`);
    }
    for (const sha of facts.notices) {
      referenced.add(sha);
      if (!store.texts[sha]?.trim()) brokenTexts.push(`${pkg.key} ${sha}`);
    }
    if (pkg.scope === "runtime" && facts.licenses.length === 0) {
      unresolved.push(pkg.key);
    }
  }
  for (const sha of Object.keys(store.texts)) {
    if (!referenced.has(sha)) brokenTexts.push(`unreferenced ${sha}`);
  }
  const stale = Object.keys(store.packages).filter((k) => !lockedKeys.has(k));
  return {
    missing: missing.sort(),
    stale: stale.sort(),
    integrityChanged: integrityChanged.sort(),
    unresolved: unresolved.sort(),
    brokenTexts: brokenTexts.sort(),
  };
}

export function isFactsDriftFree(drift: FactsDrift): boolean {
  return (
    !drift.missing.length &&
    !drift.stale.length &&
    !drift.integrityChanged.length &&
    !drift.unresolved.length &&
    !drift.brokenTexts.length
  );
}

/** Notice sources for every shipped package, one per license text. */
export function noticeSourcesFromFacts(
  store: FactsStore,
  lockfile: LockfileShape
): NoticeSource[] {
  const sources: NoticeSource[] = [];
  for (const pkg of listLockedPackages(lockfile)) {
    if (pkg.scope !== "runtime") continue;
    const facts: PackageFacts | undefined = store.packages[pkg.key];
    if (!facts) continue;
    const noticeText = facts.notices
      .map((sha) => store.texts[sha]?.trim())
      .filter(Boolean)
      .join("\n\n");
    facts.licenses.forEach((ref, index) => {
      const text = store.texts[ref.sha];
      if (!text) return;
      sources.push({
        name: pkg.name,
        version: pkg.version,
        license: pkg.license,
        licenseText: text,
        label: facts.licenses.length > 1 ? ref.name : undefined,
        // One NOTICE block per package, attached to its first license text.
        noticeText: index === 0 && noticeText ? noticeText : undefined,
      });
    });
  }
  return sources;
}

const SPDX_OPERATORS = new Set(["AND", "OR", "WITH"]);

/** SPDX license ids named by an expression, in order, without duplicates. */
export function spdxIdsOf(expression: string): string[] {
  const ids: string[] = [];
  for (const token of expression.split(/[\s()]+/)) {
    if (!token || SPDX_OPERATORS.has(token.toUpperCase())) continue;
    if (!ids.includes(token)) ids.push(token);
  }
  return ids;
}

/**
 * Fill an SPDX template for a package that ships no license file. The copyright
 * holder replaces the template's year and owner placeholders; the year is left
 * out because the package does not state one.
 */
export function fillSpdxTemplate(template: string, holder: string): string {
  return template
    .replace(/\r\n?/g, "\n")
    .replace(/<year>\s*/gi, "")
    .replace(/<copyright holders?>|<owner>/gi, holder)
    .trimEnd();
}

/** True when an SPDX template carries a copyright-holder placeholder. */
export function templateNeedsHolder(template: string): boolean {
  return /<(copyright holders?|owner)>/i.test(template);
}
