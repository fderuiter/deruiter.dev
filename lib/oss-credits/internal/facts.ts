import type {
  FactsDrift,
  FactsStore,
  LockedPackage,
  LockfileShape,
  NoticeSource,
  PackageFacts,
} from "../types";

const NODE_MODULES = "node_modules/";

export function packageNameFromLockPath(lockPath: string): string | null {
  const index = lockPath.lastIndexOf(NODE_MODULES);
  return index === -1 ? null : lockPath.slice(index + NODE_MODULES.length);
}

/**
 * Every distinct name@version in the lockfile, shipped when any install of it
 * is shipped. The first resolved URL and integrity hash win; installs of one
 * version share both.
 */
export function listLockedPackages(lockfile: LockfileShape): LockedPackage[] {
  const byKey = new Map<string, LockedPackage>();
  for (const [lockPath, entry] of Object.entries(lockfile.packages)) {
    if (lockPath === "" || entry.link) continue;
    const name = packageNameFromLockPath(lockPath);
    if (!name || !entry.version) continue;
    const key = `${name}@${entry.version}`;
    const scope = entry.dev ? "tooling" : "runtime";
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
