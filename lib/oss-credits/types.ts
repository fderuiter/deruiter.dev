/** Whether a package reaches visitors or only runs while building and testing. */
export type CreditScope = "runtime" | "tooling";

/** One credited package. Every field comes from the lockfile or the installed package metadata. */
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
}

export interface LockfileShape {
  packages: Record<string, LockfileEntry>;
}

export interface RootPackageShape {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

/** Metadata read from an installed package.json. */
export interface PackageMeta {
  homepage?: string;
  repository?: string | { url?: string };
}

export interface CreditsDrift {
  missing: string[];
  stale: string[];
  changed: string[];
}

export interface NoticeSource {
  name: string;
  version: string;
  license: string;
  licenseText: string;
  noticeText?: string;
}
