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

## CI Pipeline Security Gate Enforcement

Automated security checks are enforced across continuous integration and release workflows:

- **Pre-Commit Hook Gate:** Local commits perform dependency security vulnerability checks via `npm run audit:security` in `.husky/pre-commit` before remote push.
- **Pull Request & Branch CI Gate:** In `.github/workflows/ci.yml`, the `security-gate` job executes three audits (dependency vulnerabilities, licenses and secrets in full Git history) on every push to `main` and pull request targeting `main`. Unhandled vulnerabilities or unallowlisted secret-shaped values fail the gate.
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
- **Re-audit when a parent is upgraded, and at least monthly.** Remove each pin in a scratch copy, regenerate the lockfile with `npm install --package-lock-only`, run `npm audit --package-lock-only` and compare the resolved versions. Drop a pin whose removal adds no advisory and changes nothing it was kept for, and narrow one whose vulnerable copies sit under a single parent.

### Current pins

Re-audited on 2026-10-31 (#3671) by the method above. Eight global pins added nothing once removed, because their parents now resolve fixed releases by themselves, so they were dropped: `deepmerge-ts`, `mysql2`, `lodash-es`, `source-map-js`, `sharp`, `shell-quote` and `fast-uri` resolve to the same versions without a pin, and without the `browserslist` pin `@serwist/next` resolves its own browserslist 4.29.5. The rest were scoped to the parents that pull the vulnerable copies. With every pin in place, `npm audit` reports no advisories except the one waived below.

| Override                                           | Pinned to  | Pulled in by                                       | Resolves to without the pin | Effect of removing it                                         | Drop it when                                                                                  |
| -------------------------------------------------- | ---------- | -------------------------------------------------- | --------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `@serwist/next > zod`                              | `$zod`     | `@serwist/next`, `@serwist/build` and its plugins  | 4.6.5                       | 1 new high advisory (GHSA-mrhx-c7xc-m3w5)                     | Serwist depends on a zod release the advisory lists as fixed                                  |
| `@serwist/next > glob`                             | `^14.0.2`  | `@serwist/build`, which pins glob 13.0.6           | 13.0.6                      | 1 new moderate advisory (GHSA-3g3m-2fjr-6pw4)                 | `@serwist/build` depends on glob 14.0.2 or later (the Serwist 10 previews pin 11.0.3)         |
| `@sentry/bundler-plugins > glob`                   | `^14.0.2`  | `@sentry/nextjs` through `@sentry/bundler-plugins` | 13.0.6                      | 1 new moderate advisory (GHSA-3g3m-2fjr-6pw4)                 | `@sentry/bundler-plugins` depends on glob 14.0.2 or later                                     |
| `typed-rest-client > qs`                           | `^6.16.1`  | Stryker through `typed-rest-client` 2.3            | 6.15.1                      | 4 new moderate advisories                                     | Stryker depends on `typed-rest-client` 3, which requires qs `^6.16.0`                         |
| `isomorphic-dompurify > jsdom`                     | `26.1.0`   | `isomorphic-dompurify`                             | a second copy at 30.1.3     | no new advisories; kept for runtime compatibility (see below) | a deployed check of the routes that sanitize HTML passes on jsdom 27 or later                 |
| `micromark-extension-math > katex`                 | `^0.18.11` | `markdownlint-cli` through `markdownlint`          | 0.16.47                     | 1 new low advisory (GHSA-238p-pmpm-9mq7)                      | `micromark-extension-math` depends on katex 0.18.11 or later                                  |
| `markdownlint-cli > js-yaml`                       | `~5.4.3`   | `markdownlint-cli`                                 | 5.2.3                       | 1 new moderate advisory (GHSA-r3ph-w7gj-g6xm)                 | `markdownlint-cli` depends on a fixed js-yaml whose dependencies pass the license policy      |
| `markdownlint-cli > minimatch`                     | `^11.0.1`  | `markdownlint-cli`                                 | 10.2.6                      | 1 new moderate advisory (GHSA-g3hv-75wg-m249)                 | `markdownlint-cli` depends on minimatch 11.0.1 or later (0.50.0 still asks for `~10.2.6`)     |
| `markdownlint-cli > smol-toml`                     | `^1.9.0`   | `markdownlint-cli` 0.49                            | 1.7.2                       | 1 new moderate advisory (GHSA-r4xh-jqrq-34v2)                 | the upgrade to `markdownlint-cli` 0.50 (smol-toml `~1.9.1`), once it adds no advisory (below) |
| `@typescript-eslint/typescript-estree > minimatch` | `^11.0.1`  | `typescript-eslint` through `eslint-config-next`   | 10.2.5                      | 1 new moderate advisory (GHSA-g3hv-75wg-m249)                 | `@typescript-eslint/typescript-estree` depends on minimatch 11.0.1 or later                   |
| `@stryker-mutator/core > minimatch`                | `^11.0.1`  | Stryker                                            | 10.2.6                      | 1 new moderate advisory (GHSA-g3hv-75wg-m249)                 | `@stryker-mutator/core` depends on minimatch 11.0.1 or later (10.1.1 asks for `~10.2.4`)      |

The `qs` pin was exact (`6.16.1`) with no stated reason; it is now a floor at the same release. `typed-rest-client` is its only consumer.

The `fast-glob` → `tinyglobby` swap for `@next/eslint-plugin-next` (#1783) was removed on 2026-10-31. It kept `braces` out of the tree for GHSA-vfj7-8cjw-p6xm, which has since been withdrawn as not practically exploitable, so the plugin now gets the `fast-glob` it declares.

The `glob` and `minimatch` pins answer two moderate advisories published on 2026-10-31 (#3670). glob 14 depends on minimatch 11, and the scoped minimatch pins move the minimatch 10 copies whose packages call nothing minimatch 11 removed. Two kinds of caller can't move, so `config/security-audit-ignore.json` waives GHSA-g3hv-75wg-m249 on `minimatch` until 2026-11-30 (#3667): the ESLint plugins bundled by `eslint-config-next` and `@eslint/eslintrc`, which need minimatch 3's CommonJS default export, and `typedoc` 0.28, which calls `Minimatch.matchOne`. Both run only at lint and docs time. The waiver is renewed while `eslint-config-next` still bundles those plugins (#3671).

The `js-yaml` pin is scoped to `markdownlint-cli` so ESLint keeps its own js-yaml 4. It stops at 5.4.x because js-yaml 5.5 moves to `argparse` 3, which is PSF-2.0 and not in `config/license-policy.json`. `markdownlint-cli` 0.50.0 asks for js-yaml `~5.5.0`, and it also brings `re2js` 2.8.6, which has a high advisory (GHSA-gg6h-894w-4m9c), so the upgrade that would retire the `smol-toml` pin waits for a release without either.

The `jsdom` pin is not a vulnerability fix, and it is exact on purpose. jsdom 27 and later depend on the ESM-only `@exodus/bytes`, which made serverless functions fail with `ERR_REQUIRE_ESM` (#995). `next.config.ts` keeps those packages out of the server bundle and `__tests__/deploy-config.test.ts` guards that, but lifting the pin also needs a deployed check of the routes that sanitize HTML, so it stays until that check is done. The project's own jsdom (the Vitest environment) is a direct dependency at the same release.

`__tests__/package-overrides-documented.test.ts` fails when an override is added without a row here.
