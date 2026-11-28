# Security Policy

## Supported Versions

Security fixes are applied to the current `main` branch and the production
release deployed from it. Historical tags and branches are not maintained as
separate supported release lines.

## Reporting a Vulnerability

Do not open a public issue for a suspected vulnerability or include secrets,
personal data, exploit details, or production identifiers in a public report.
Use GitHub's private **Report a vulnerability** flow on the repository Security
tab. If that flow is unavailable, email `fpderuiter@gmail.com` with a concise
description and reproduction. Please allow a reasonable remediation window
before public disclosure.

Reports should include the affected route or component, impact, reproduction
steps, and whether a credential or user record may have been exposed. Never
include a live credential; identify its provider and scope, then revoke or
rotate it.

## Layout Engine & Core Framework (`@chenglou/pretext`)

This project relies on the `@chenglou/pretext` library as its core text layout engine to achieve high performance. Since this library processes user-facing and dynamically injected text, it is important to understand its security posture.

- The `pretext` library maintains specific security boundaries and policies regarding vulnerabilities, such as Denial-of-Service (DoS) behaviors that could theoretically stem from processing extremely long or maliciously crafted text inputs.
- If you discover or suspect any upstream vulnerabilities within the layout engine itself, **do not** open public issues. Instead, report them privately through the official GitHub vulnerability reporting flow for the [pretext repository](https://github.com/chenglou/pretext).
- In the event that local security auditing detects a dependency vulnerability affecting `@chenglou/pretext` or related layout core components, the audit tool raises an immediate security alert and halts the pipeline. These issues require private disclosure and core framework mitigation rather than standard third-party override suppression.

## Automated Vulnerability Audits & Local CLI

The repository features an automated vulnerability audit tool that evaluates lockfile dependencies against known advisory databases.

### Local Audit Execution

Developers can run local security audits using the following CLI command:

```bash
npm run audit:security
npm run audit:secrets
```

The first command parses `npm audit --json` and enforces dependency-vulnerability
policy. The second performs a redacted scan of every reachable Git commit for
high-confidence credential patterns. Neither command prints matched secret
values.

### Severity Thresholds

The security audit CLI evaluates vulnerability severity levels and enforces the following policy:

- **High & Critical Severities:** Automatically trigger failure of the security check unless matched by a valid, active vulnerability override rule in `config/security-audit-ignore.json`.
- **Low & Moderate Severities:** Do not block a local run by default, though developers are encouraged to remediate them during routine maintenance.
- **CI Security Gate:** CI runs `npm run audit:security -- --fail-on-warning --severity=moderate`, so unhandled moderate advisories and overrides inside their pre-expiration warning window also fail the Security Gate.
- **Withdrawn Advisory Verification:** When `npm audit --json` reports an unhandled blocking advisory with a `GHSA-*` identifier, `scripts/security-audit.ts` (and `scripts/triage-security-issue.ts`) cross-checks `GET /advisories/<GHSA-ID>` in the GitHub Advisory Database. Advisories whose `withdrawn_at` timestamp is set are logged and excluded so npm registry cache lag after a withdrawal cannot cause false-positive failures. Any API, network, or timeout error fails closed and keeps the advisory blocking.

## CI Pipeline Security Gate Enforcement

Automated security checks are enforced across continuous integration and release workflows:

- **Pre-Commit Hook Gate:** Local commits perform dependency security vulnerability checks via `npm run audit:security` in `.husky/pre-commit` before remote push.
- **Pull Request & Branch CI Gate:** In `.github/workflows/ci.yml`, the `security-gate` job runs unconditionally on every push to `main` and pull request targeting `main`. Lockfile license verification (`npm run audit:licenses`) and reachable Git-history secret scanning (`npm run audit:secrets`) run on every PR and push. The live npm vulnerability audit (`npm run audit:security`) and override re-audit (`npm run audit:overrides -- --check`) run on every push to `main`, daily in `.github/workflows/scheduled-security-audit.yml` (for `audit:security`), and on pull requests that touch dependencies or security-audit policy/scripts (`package.json`, `package-lock.json`, `SECURITY.md`, `config/security-audit-ignore.json`, `scripts/security-audit.ts`, `scripts/overrides-audit.ts`, `scripts/triage-security-issue.ts`, `scripts/ci-run-policy.mjs`, `.github/workflows/ci.yml`, `.github/workflows/scheduled-security-audit.yml`), or when changed files cannot be determined (fail-safe). This prevents unrelated PRs from freezing on upstream advisory churn while preserving continuous monitoring on `main`.
- **Production Build Gate:** Vercel’s production build of `main` runs the offline migration integrity checks, applies migrations through the environment-guarded block in `scripts/build.js`, and then compiles the application. Dependency and secret audits remain mandatory CI and pre-commit gates; production database credentials remain confined to Vercel.

## Vulnerability Override Governance Rules

When a critical, high, or moderate third-party vulnerability cannot be immediately resolved upstream (e.g., dev-only dependencies or non-exploitable utility modules), temporary suppressions can be configured in `config/security-audit-ignore.json`.

### Mandatory Override Parameters

All suppression rules in `config/security-audit-ignore.json` must strictly adhere to the following governance requirements:

1. **Advisory Identifier (`advisory` / `advisoryId` / `cve` / `ghsa` / `id`):** Must specify a valid advisory identifier (e.g., `GHSA-c2qf-rxjj-4v5w` or `CVE-XXXX-XXXX`). Entries missing an advisory ID are invalid and rejected by the audit tool.
2. **Severity Classification (`severity`):** Specifies the vulnerability severity (`critical`, `high` or `moderate`). If omitted, rules default to Critical severity validation limits (**14 days**) to fail closed.
3. **Business Justification (`reason` / `justification`):** Must contain a clear description of why the vulnerability is non-actionable or safe in the current deployment context (e.g., dev-only tool, build-time utility with no production runtime exposure).
4. **Risk Owner & Follow-Up Ticket (`owner` & `followUp`):** Must designate a responsible risk owner and linked follow-up issue/ticket.
5. **Expiration Date & Tiered Lifespan Limits (`expiresAt` / `expires`):** Must provide a valid ISO timestamp specifying when the override expires. Overrides are capped based on severity:
   - **Critical Severity:** Capped at a maximum lifespan of **14 days**.
   - **High Severity:** Capped at a maximum lifespan of **30 days**.
   - **Moderate Severity:** Capped at a maximum lifespan of **90 days**.
     Overrides exceeding their severity duration limit or creation threshold are flagged as invalid and fail the audit.
6. **Target Package Scope (`package` / `name`):** Optional parameter to restrict the override to a specific package name.

### Override Validation, Pre-Expiration Warnings & Automated Triage Escalation

During local, CI, or scheduled daily execution, the audit tool validates all active override rules and enforces reporting policies:

- **Expired Rules:** Rules whose expiration date has passed (`expiresAt <= now`) are rejected and cause the security audit to fail.
- **Invalid Rules:** Rules missing required fields, containing invalid severity values, or exceeding severity lifespan limits (14 days for Critical, 30 days for High, 90 days for Moderate) trigger explicit validation errors and fail the audit.
- **Tiered Pre-Expiration Warnings:** Pre-expiration warnings are logged prior to expiration:
  - **Critical Overrides:** Warning triggered when **7 days** or fewer remain.
  - **High Overrides:** Warning triggered when **14 days** or fewer remain.
  - **Moderate Overrides:** Warning triggered when **14 days** or fewer remain.
- **Categorized Reporting:** CLI console logs and GitHub Step Summaries categorize vulnerabilities and overrides into distinct Critical, High, and Moderate severity reporting tables.
- **Automated Issue Triage Escalation:** Daily scheduled audit failures in `.github/workflows/scheduled-security-audit.yml` automatically create or update dedicated GitHub issues labeled `security-triage`, deduplicated by advisory identifier.

## npm Package Overrides

The `overrides` block in `package.json` pins transitive dependencies that an upstream package would otherwise resolve to a vulnerable or incompatible version. Every pin runs a package against a dependency version its author didn't choose, so pins are kept few, narrow and temporary.

### Practices

- **Upgrade the parent first.** A pin is the last resort, for when no release of the parent depends on a fixed version by itself.
- **Scope the pin to the parent that needs it.** Write `parent > child` (`{ "parent": { "child": range } }`) rather than a global pin, so packages that already resolve a fixed version aren't forced onto one. A scoped pin applies to the parent's whole subtree.
- **Pin a floor, not an exact version.** A security pin is a range such as `^x.y.z` from the first fixed release. An exact pin needs a stated reason in this section.
- **Give every pin an exit.** Each row names the upstream change after which the pin goes.
- **Re-audit when a parent is upgraded, and at least monthly.** `npm run audit:overrides` removes each pin in a scratch copy, regenerates the lockfile with `npm install --package-lock-only`, runs `npm audit --package-lock-only` and compares the result with the committed tree per installed copy, since an advisory already waived for one copy of a package says nothing about a second copy. It reports each pin as needed, to drop, to review, or kept for the reason its row states (a row whose "Effect of removing it" begins "no new advisories"). `npm run audit:overrides -- --check` exits `1` on removable (`no-effect`, `no-new-advisory`) or errored pins and runs in CI's `security-gate` and `npm run deps:fix`; `.github/workflows/overrides-audit.yml` also runs it on the third of each month and opens an issue, or comments on the open one, when an upstream release makes a pin removable between dependency PRs. Drop a pin whose removal adds no vulnerable copy and changes nothing it was kept for, and narrow one whose vulnerable copies sit under a single parent.

### Current pins

Re-audited on 2026-10-31 (#3671) by the method above. Eight global pins added nothing once removed, because their parents now resolve fixed releases by themselves, so they were dropped: `deepmerge-ts`, `mysql2`, `lodash-es`, `source-map-js`, `sharp`, `shell-quote` and `fast-uri` resolve to the same versions without a pin, and without the `browserslist` pin `@serwist/next` resolves its own browserslist 4.29.5. The rest were scoped to the parents that pull the vulnerable copies.

Serwist 9.5.15 declares supported Zod 4.6.7 and glob 14.0.6 ranges in
its Next.js adapter and build package. The two `@serwist/next` overrides
were removed after verifying the lockfile and rechecking the audit.

| Override                            | Pinned to  | Pulled in by                              | Resolves to without the pin | Effect of removing it                                         | Drop it when                                                                                  |
| ----------------------------------- | ---------- | ----------------------------------------- | --------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `typed-rest-client > qs`            | `^6.16.1`  | Stryker through `typed-rest-client` 2.3   | 6.15.1                      | 4 new moderate advisories                                     | Stryker depends on `typed-rest-client` 3, which requires qs `^6.16.0`                         |
| `isomorphic-dompurify > jsdom`      | `26.1.0`   | `isomorphic-dompurify`                    | a second copy at 30.1.3     | no new advisories; kept for runtime compatibility (see below) | a deployed check of the routes that sanitize HTML passes on jsdom 27 or later                 |
| `micromark-extension-math > katex`  | `^0.18.11` | `markdownlint-cli` through `markdownlint` | 0.16.47                     | 1 new low advisory (GHSA-238p-pmpm-9mq7)                      | `micromark-extension-math` depends on katex 0.18.11 or later                                  |
| `markdownlint-cli > js-yaml`        | `~5.4.3`   | `markdownlint-cli`                        | 5.2.3                       | 1 new moderate advisory (GHSA-r3ph-w7gj-g6xm)                 | `markdownlint-cli` depends on a fixed js-yaml whose dependencies pass the license policy      |
| `markdownlint-cli > minimatch`      | `^11.0.1`  | `markdownlint-cli`                        | 10.2.6                      | 1 new moderate advisory (GHSA-g3hv-75wg-m249)                 | `markdownlint-cli` depends on minimatch 11.0.1 or later (0.50.0 still asks for `~10.2.6`)     |
| `markdownlint-cli > smol-toml`      | `^1.9.0`   | `markdownlint-cli` 0.49                   | 1.7.2                       | 1 new moderate advisory (GHSA-r4xh-jqrq-34v2)                 | the upgrade to `markdownlint-cli` 0.50 (smol-toml `~1.9.1`), once it adds no advisory (below) |
| `@stryker-mutator/core > minimatch` | `^11.0.1`  | Stryker                                   | 10.2.6                      | 1 new moderate advisory (GHSA-g3hv-75wg-m249)                 | `@stryker-mutator/core` depends on minimatch 11.0.1 or later (10.1.1 asks for `~10.2.4`)      |
| `@prisma/config > effect`           | `^3.22.1`  | `prisma` through `@prisma/config` 7.10.1  | 3.20.0 (exact pin)          | 1 new high advisory (GHSA-7589-6fvf-x4pw)                     | `@prisma/config` depends on effect 3.22.1 or later                                            |

The `effect` pin answers a high ReDoS advisory in `Schema.TemplateLiteral` (GHSA-7589-6fvf-x4pw, #4064), which affects effect `<=3.22.0`. `@prisma/config` 7.10.1, the newest Prisma 7 release, pins effect `3.20.0` exactly, and the next Prisma release line is 8, a major migration. effect 3.22 is a minor release inside the same major line. The copy runs only in the Prisma CLI (`prisma generate`, `prisma validate` and migrations), which is a development dependency and never ships to the site.

The `qs` pin was exact (`6.16.1`) with no stated reason; it is now a floor at the same release. `typed-rest-client` is its only consumer.

The `fast-glob` → `tinyglobby` swap for `@next/eslint-plugin-next` (#1783) was removed on 2026-10-31. It kept `braces` out of the tree for GHSA-vfj7-8cjw-p6xm, which has since been withdrawn as not practically exploitable, so the plugin now gets the `fast-glob` it declares.

The scoped `minimatch` pins answer a moderate advisory published on 2026-10-31 (#3670), moving the minimatch 10 copies whose packages call nothing minimatch 11 removed (the former `@sentry/bundler-plugins > glob` and `@typescript-eslint/typescript-estree > minimatch` pins were retired once upstream releases depended on glob 14 and minimatch 11 directly). The [current GHSA-g3hv-75wg-m249 advisory](https://github.com/advisories/GHSA-g3hv-75wg-m249) affects minimatch `>=7.0.0 <11.0.1`; the minimatch 3 copies used by ESLint and the Next plugins are outside that range. As rechecked on 2026-11-16, `npm audit --package-lock-only` reports only TypeDoc's minimatch 10.2.6 copy and its documentation-tooling dependents. TypeDoc 0.28.20 remains the latest stable release and calls `Minimatch.matchOne`, which minimatch 11 removed. It runs only during documentation generation on repository-controlled globs.

[The exception file](config/security-audit-ignore.json) is the source of truth for this moderate-only waiver's dates, owner and follow-up (#3667). Renewals for this advisory are limited to 30 days after checking the current advisory and supported TypeDoc releases. CI's `--fail-on-warning` starts failing when 14 days remain, so review before that window, not just before expiry. Remove the waiver when a supported TypeDoc release resolves a fixed minimatch. Next's separate supported lint-toolchain review remains in #3671.

The `js-yaml` pin is scoped to `markdownlint-cli` so ESLint keeps its own js-yaml 4. It stops at 5.4.x because js-yaml 5.5 moves to `argparse` 3, which is PSF-2.0 and not in `config/license-policy.json`. `markdownlint-cli` 0.50.0 asks for js-yaml `~5.5.0`, and it also brings `re2js` 2.8.6, which has a high advisory (GHSA-gg6h-894w-4m9c), so the upgrade that would retire the `smol-toml` pin waits for a release without either. `.github/dependabot.yml` skips 0.50.0 alone, so Dependabot proposes the next release for the same check.

The `jsdom` pin is not a vulnerability fix, and it is exact on purpose. jsdom 27 and later depend on the ESM-only `@exodus/bytes`, which made serverless functions fail with `ERR_REQUIRE_ESM` (#995). `next.config.ts` keeps those packages out of the server bundle and `__tests__/deploy-config.test.ts` guards that, but lifting the pin also needs a deployed check of the routes that sanitize HTML, so it stays until that check is done. The project's own jsdom (the Vitest environment) is a direct dependency at the same release.

`__tests__/package-overrides-documented.test.ts` fails when an override is added without a row here.
