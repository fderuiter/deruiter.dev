import { createHash } from "node:crypto";

import { SECRET_DETECTORS } from "./catalog";
import { SECRET_DETECTOR_FIXTURES } from "./fixtures";

/**
 * Repo-relative path of the fixtures module, matching how callers key
 * `file` when scanning it (see `scan.ts`'s path normalization).
 */
const FIXTURES_FILE = "lib/security-scan/internal/fixtures.ts";

/**
 * Values that are safe everywhere regardless of which file they appear in:
 * canonical placeholder values already shipped in `.env.example` /
 * `lib/dx/env-guard.ts`, or well-known vendor-published example literals.
 */
const GLOBAL_SAFE_VALUES = new Set<string>([
  "AKIAIOSFODNN7EXAMPLE",
  "sk_test_example_secret_key",
  "example_dev_token",
]);

/**
 * Realistic-looking (but inert) Neon connection strings used to exercise the
 * migration-replay test harness. Scoped to the specific files that
 * legitimately embed them rather than allowlisted globally, so a copy
 * pasted elsewhere is still flagged.
 */
const MIGRATION_REPLAY_FIXTURES = new Set<string>([
  "postgres://admin:p%40ss%3Aword!@ep-cool-lake-123456.us-east-2.aws.neon.tech/neondb?sslmode=require",
  "postgres://***:***@ep-cool-lake-123456.us-east-2.aws.neon.tech/neondb?sslmode=require",
  "postgresql://user:pass@ep-cool-pooler.us-east-2.aws.neon.tech/portfolio_prod",
  "postgresql://admin:secret@ep-live.neon.tech/portfolio",
  "postgresql://admin:secret@ep-pooler.neon.tech/portfolio",
  "postgresql://admin:secret@ep-prod.neon.tech/neondb",
]);

// Synthetic credentials authored by the hook regression in 64e5f73a4208
// and recorded in the allowance module by a7f1d4a34d1d. Keep their exact
// detector captures scoped to those files, including the revised fixture.
const HUSKY_HOOK_FIXTURES = [
  "postgresql://user:npg_SecretPass1234@ep-cool-lake-123456.us-east-2.aws.neon.tech/neondb",
  "npg_SecretPass1234",
  "postgresql://user:pass@ep-cool-pooler.us-east-2.aws.neon.tech/portfolio_prod",
];
const HUSKY_HOOK_LITERALS = new Set<string>(HUSKY_HOOK_FIXTURES);
for (const value of HUSKY_HOOK_FIXTURES) {
  for (const detector of SECRET_DETECTORS) {
    detector.regex.lastIndex = 0;
    for (const match of value.matchAll(detector.regex)) {
      HUSKY_HOOK_LITERALS.add(match[0]);
    }
  }
}

/**
 * Every positive/negative fixture, as its *own detector* would actually
 * capture it (not necessarily the whole fixture string — e.g. the bare-URL
 * detector stops at the first `/` after the host), registered against the
 * fixtures module's own source file. Matching on the real captured
 * substring (rather than the authored literal) keeps this generated from
 * {@link SECRET_DETECTOR_FIXTURES} so a newly added fixture never needs a
 * second, hand-maintained allowlist entry.
 */
const FIXTURE_LITERALS = new Set<string>();
for (const detector of SECRET_DETECTORS) {
  const fixtures = SECRET_DETECTOR_FIXTURES[detector.id];
  for (const value of [...fixtures.positive, ...fixtures.negative]) {
    detector.regex.lastIndex = 0;
    const match = value.match(detector.regex);
    FIXTURE_LITERALS.add(match ? match[0] : value);
  }
}

/**
 * A value that is safe only because history is immutable: an earlier
 * commit embedded it as a known-safe fixture in a file that, at the time,
 * carried the catalog's own allowlist data. That commit is permanently
 * part of the reachable-history audit's input even after this refactor
 * moved the catalog to `lib/security-scan/`, so the allowlist keeps the
 * entry keyed to the file it actually appeared in historically, rather
 * than widening it to a global (file-agnostic) allowance.
 */
const GHP_FIXTURE_LITERAL = new Set<string>([
  "ghp_123456789012345678901234567890123456",
]);

function union(...sets: readonly Set<string>[]): Set<string> {
  return new Set(sets.flatMap((set) => [...set]));
}

const SAFE_FILE_VALUES = new Map<string, Set<string>>([
  ["__tests__/husky-hook-wiring.test.ts", HUSKY_HOOK_LITERALS],
  ["__tests__/migration-replay.test.ts", MIGRATION_REPLAY_FIXTURES],
  [FIXTURES_FILE, FIXTURE_LITERALS],
  // This module's own literal Neon and GitHub-token fixtures (see
  // MIGRATION_REPLAY_FIXTURES and GHP_FIXTURE_LITERAL above).
  [
    "lib/security-scan/internal/allowlist.ts",
    union(MIGRATION_REPLAY_FIXTURES, GHP_FIXTURE_LITERAL, HUSKY_HOOK_LITERALS),
  ],
  // Pre-refactor home of both fixture sets, which still holds them at
  // earlier reachable commits.
  [
    "scripts/audit-secret-history.ts",
    union(MIGRATION_REPLAY_FIXTURES, GHP_FIXTURE_LITERAL),
  ],
  ["__tests__/validation.test.ts", GHP_FIXTURE_LITERAL],
]);

/**
 * Credentials that were committed, then revoked, and that history still
 * holds. They are keyed by SHA-256 fingerprint rather than by value so the
 * plaintext never re-enters the tree, and scoped to the one file that held
 * each. A fingerprint belongs here only after the credential has been
 * rotated at its provider.
 *
 * - `__tests__/dx-tooling.test.ts`: a Neon role password embedded in a
 *   `.env.example` assertion from 2026-08-16 until 2026-09-24. The role's
 *   password was reset on 2026-09-24.
 */
const ROTATED_CREDENTIAL_FINGERPRINTS = new Map<string, ReadonlySet<string>>([
  [
    "__tests__/dx-tooling.test.ts",
    new Set([
      "71a564baa010cb4cb8ab1c6503c326d2e8bb1cf9b6d2c5c3d70bbc8fe2fc4925",
    ]),
  ],
]);

function isRotatedCredential(value: string, file: string): boolean {
  const fingerprints = ROTATED_CREDENTIAL_FINGERPRINTS.get(file);
  if (!fingerprints) return false;
  return fingerprints.has(createHash("sha256").update(value).digest("hex"));
}

/**
 * Whether a detected candidate value is a known-safe fixture/example rather
 * than a real secret, given the (repo-relative, forward-slash) file it was
 * found in.
 */
export function isAllowlistedSecretValue(value: string, file = ""): boolean {
  if (GLOBAL_SAFE_VALUES.has(value)) return true;

  const normalizedFile = file.replaceAll("\\", "/");
  if (SAFE_FILE_VALUES.get(normalizedFile)?.has(value)) return true;
  if (isRotatedCredential(value, normalizedFile)) return true;

  try {
    const host = new URL(value).hostname;
    if (host === "localhost" || host === "127.0.0.1") return true;
    if (host.endsWith(".example.com")) return true;
  } catch {
    // Non-URL detectors continue through the explicit fixture rules above.
  }

  return (
    normalizedFile === "__tests__/validation.test.ts" &&
    value.includes("BEGIN RSA PRIVATE KEY")
  );
}
