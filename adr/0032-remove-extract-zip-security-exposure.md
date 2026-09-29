# 0032. Remove Unpatched `extract-zip` Exposure

Date: 2026-09-10

## Status

Accepted

## Context

Two symlink-traversal advisories affect `extract-zip` without an upstream patched release. The package entered this repository through the legacy path `@lhci/cli` -> `lighthouse` -> `puppeteer-core` -> `@puppeteer/browsers` -> `extract-zip`, including a CI `npx lhci autorun` call. The repository already uses its own real-browser benchmark runner and Playwright accessibility probes.

## Decision

Remove `@lhci/cli`, the CI `lhci` invocation, its unused `.lighthouserc.js` configuration, and its obsolete test. This removes the full transitive dependency path instead of accepting either advisory. Remove the corresponding temporary audit exceptions from both checked-in policy files and the audit script's fallback policy.

The regression test treats the installed dependency graph, audit policy, and build workflow as the security boundary. It requires the `extract-zip` and `@lhci/cli` lockfile entries to be absent, rejects policy exceptions for `GHSA-jmr9-qjv8-65gv` and `GHSA-7pqw-9j4j-h8q3`, and rejects `lhci`/`lighthouse` CI invocations. It also executes a malicious symlink ZIP fixture with a payload routed through that symlink in a temporary sandbox and confirms extraction leaves a sibling out-of-destination sentinel untouched. With no application extractor installed or reachable, the fixture has no repository extraction callsite.

## Invariant Compliance

- **AGENTS.md Dependency and security invariants**: The dependency graph no longer includes the unpatched extractor or a dynamic CI installation path to it; security policy retains only explicit, expiry-bound residual risks.
- **Verification**: `npm ls extract-zip --all`, `npm run audit:security`, `npm run typecheck`, and `npx vitest run __tests__/extract-zip-remediation.test.ts` verify removal, policy, and reachability.

## Consequences

### Positive

- The two `extract-zip` alerts are resolved by removal, not silently suppressed.
- Benchmarking remains available through `npm run bench:pages`; accessibility coverage remains provided by the Playwright and axe suites.
- Adding a future archive extractor requires an explicit trust-boundary review and traversal regression tests before it is introduced.

### Negative / Trade-offs

- CI no longer produces a Lighthouse score; it retains the repository's real-browser Web Vitals budget gate instead.
