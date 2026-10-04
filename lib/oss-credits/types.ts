/** Whether a package reaches visitors or only runs while building and testing. */
export type CreditScope = "runtime" | "tooling";

/** One credited package. Every field comes from the lockfile or the committed registry facts. */
export interface CreditPackage {
  name: string;
  version: string;
  /** SPDX expression exactly as the lockfile reports it, or "UNKNOWN". */
  license: string;
  scope: CreditScope;
  /** True when listed in package.json dependencies or devDependencies. */
  direct: boolean;
  homepage: string | null;
  repository: string | null;
  /** Purpose group; set for direct dependencies only. */
  group?: string;
  /** One line on why the project uses it; set for direct dependencies only. */
  reason?: string;
}

export interface CreditsDataset {
  schemaVersion: 1;
  source: "package-lock.json";
  counts: { total: number; runtime: number; tooling: number; direct: number };
  packages: CreditPackage[];
}

/** Curated annotation for a direct dependency. */
export interface DirectAnnotation {
  group: string;
  reason: string;
}

/** Subset of a lockfile entry the builder reads. */
export interface LockfileEntry {
  version?: string;
  license?: string;
  dev?: boolean;
  link?: boolean;
  /** Registry tarball URL; locates the package in the registry. */
  resolved?: string;
  /** Subresource integrity hash of that tarball. */
  integrity?: string;
}

export interface LockfileShape {
  packages: Record<string, LockfileEntry>;
}

export interface RootPackageShape {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

/** How a package's license text was found. */
export type LicenseTextKind = "file" | "inherited" | "derived";

/** One license text that applies to a package, by content hash. */
export interface LicenseTextRef {
  kind: LicenseTextKind;
  /** File name in the tarball, parent package for inherited text, or the SPDX template id. */
  name: string;
  /** Key into `FactsStore.texts`. */
  sha: string;
  /** Parent `name@version` when kind is "inherited". */
  from?: string;
  /** Copyright holder filled into the SPDX template when kind is "derived". */
  holder?: string;
}

/**
 * What the registry says about one locked package version. A version's tarball
 * is immutable, so facts keyed by name@version and pinned to the lockfile
 * integrity hash are identical on every platform.
 */
export interface PackageFacts {
  /** The lockfile integrity hash these facts were read from. */
  integrity: string;
  homepage: string | null;
  repository: string | null;
  author: string | null;
  /** Shipped packages only: every license text that applies. */
  licenses: LicenseTextRef[];
  /** Shipped packages only: NOTICE file texts (keys into `texts`). */
  notices: string[];
}

export interface FactsStore {
  schemaVersion: 1;
  /** Keyed by `name@version`. */
  packages: Record<string, PackageFacts>;
  /** Content-addressed license and notice texts, keyed by sha256 hex. */
  texts: Record<string, string>;
}

export interface NoticeSource {
  name: string;
  version: string;
  license: string;
  licenseText: string;
  noticeText?: string;
  /** Distinguishes several texts for one package, for example the file name. */
  label?: string;
}

/** A locked package version with everything the registry fetch needs. */
export interface LockedPackage {
  key: string;
  name: string;
  version: string;
  scope: CreditScope;
  license: string;
  resolved: string | null;
  integrity: string | null;
}

export interface FactsDrift {
  /** In the lockfile, absent from the facts. */
  missing: string[];
  /** In the facts, absent from the lockfile. */
  stale: string[];
  /** Facts recorded against a different integrity hash than the lockfile now has. */
  integrityChanged: string[];
  /** Shipped packages with no resolved license text. */
  unresolved: string[];
  /** Text hashes referenced by a package but missing from the store, or stored but unreferenced. */
  brokenTexts: string[];
}
