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

- **High & Critical Severities:** Automatically trigger failure of the security check unless matched by a valid, active vulnerability override rule in `security-audit-ignore.json`.
- **Low & Moderate Severities:** Do not block execution by default, though developers are encouraged to remediate them during routine maintenance.

## CI Pipeline Security Gate Enforcement

Automated security checks are enforced across continuous integration and release workflows:

- **Pre-Commit Hook Gate:** Local commits perform dependency security vulnerability checks via `npm run audit:security` in `.husky/pre-commit` before remote push.
- **Pull Request & Branch CI Gate:** In `.github/workflows/ci.yml`, the `security-gate` job executes both audits against full Git history on every push to `main` and pull request targeting `main`. Unhandled vulnerabilities or unallowlisted secret-shaped values fail the gate.
- **Production Build Gate:** Vercel’s production build of `main` runs the offline migration integrity checks, applies migrations through the environment-guarded block in `scripts/build.js`, and then compiles the application. Dependency and secret audits remain mandatory CI and pre-commit gates; production database credentials remain confined to Vercel.

## Vulnerability Override Governance Rules

When a high or critical third-party vulnerability cannot be immediately resolved upstream (e.g., dev-only dependencies or non-exploitable utility modules), temporary suppressions can be configured in `security-audit-ignore.json` (at the root of the repository or in `scripts/security-audit-ignore.json`).

### Mandatory Override Parameters

All suppression rules in `security-audit-ignore.json` must strictly adhere to the following governance requirements:

1. **Advisory Identifier (`advisory` / `advisoryId` / `cve` / `ghsa` / `id`):** Must specify a valid advisory identifier (e.g., `GHSA-c2qf-rxjj-4v5w` or `CVE-XXXX-XXXX`). Entries missing an advisory ID are invalid and rejected by the audit tool.
2. **Severity Classification (`severity`):** Specifies the vulnerability severity (`critical` or `high`). If omitted, rules default to Critical severity validation limits (**14 days**) to fail closed.
3. **Business Justification (`reason` / `justification`):** Must contain a clear description of why the vulnerability is non-actionable or safe in the current deployment context (e.g., dev-only tool, build-time utility with no production runtime exposure).
4. **Risk Owner & Follow-Up Ticket (`owner` & `followUp`):** Must designate a responsible risk owner and linked follow-up issue/ticket.
5. **Expiration Date & Tiered Lifespan Limits (`expiresAt` / `expires`):** Must provide a valid ISO timestamp specifying when the override expires. Overrides are capped based on severity:
   - **Critical Severity:** Capped at a maximum lifespan of **14 days**.
   - **High Severity:** Capped at a maximum lifespan of **30 days**.
     Overrides exceeding their severity duration limit or creation threshold are flagged as invalid and fail the audit.
6. **Target Package Scope (`package` / `name`):** Optional parameter to restrict the override to a specific package name.

### Override Validation, Pre-Expiration Warnings & Automated Triage Escalation

During local, CI, or scheduled daily execution, the audit tool validates all active override rules and enforces reporting policies:

- **Expired Rules:** Rules whose expiration date has passed (`expiresAt <= now`) are rejected and cause the security audit to fail.
- **Invalid Rules:** Rules missing required fields, containing invalid severity values, or exceeding severity lifespan limits (14 days for Critical, 30 days for High) trigger explicit validation errors and fail the audit.
- **Tiered Pre-Expiration Warnings:** Pre-expiration warnings are logged prior to expiration:
  - **Critical Overrides:** Warning triggered when **7 days** or fewer remain.
  - **High Overrides:** Warning triggered when **14 days** or fewer remain.
- **Categorized Reporting:** CLI console logs and GitHub Step Summaries categorize vulnerabilities and overrides into distinct Critical and High severity reporting tables.
- **Automated Issue Triage Escalation:** Daily scheduled audit failures in `.github/workflows/scheduled-security-audit.yml` automatically create or update dedicated GitHub issues labeled `security-triage`, deduplicated by advisory identifier.

## npm Package Overrides

The `overrides` block in `package.json` pins transitive dependencies that an upstream package would otherwise resolve to a vulnerable or incompatible version. Each pin was re-audited on 2026-10-02 (#1109) by removing it in a scratch copy, regenerating the lockfile with `npm install --package-lock-only`, and running `npm audit`. With every pin in place, `npm audit` reports only the three moderate advisories already tracked in `security-audit-ignore.json` (fast-uri, js-yaml, markdownlint-cli).

| Override        | Pinned to  | Pulled in by                        | Resolves to without the pin | Effect of removing it                             |
| --------------- | ---------- | ----------------------------------- | --------------------------- | ------------------------------------------------- |
| `deepmerge-ts`  | `^8.0.1`   | `prisma` through `@prisma/config`   | 7.1.5                       | 3 new high advisories                             |
| `browserslist`  | `^4.28.8`  | `@serwist` build tooling            | 4.28.6                      | 2 new high advisories                             |
| `mysql2`        | `^3.24.3`  | `prisma`                            | 3.15.3                      | 1 new high and 1 new moderate advisory            |
| `lodash-es`     | `^4.18.1`  | `mermaid` through `chevrotain`      | 4.17.23                     | 5 new high advisories                             |
| `qs`            | `6.16.0`   | Stryker through `typed-rest-client` | 6.15.1                      | 2 new moderate advisories                         |
| `jsdom`         | `26.1.0`   | `isomorphic-dompurify`              | a second copy at 30.1.1     | no new advisories; kept for runtime compatibility |
| `source-map-js` | `^1.2.2`   | `postcss` through Next.js           | below 1.2.2                 | 1 new high advisory (GHSA-68fv-2mgg-jv7q)         |
| `katex`         | `^0.18.11` | `markdownlint-cli`                  | below 0.18.11               | 1 new moderate advisory (GHSA-238p-pmpm-9mq7)     |
| `smol-toml`     | `^1.9.0`   | `markdownlint-cli`                  | below 1.9.0                 | 1 new moderate advisory (GHSA-r4xh-jqrq-34v2)     |
| `sharp`         | `^0.35.5`  | `next` (image optimization)         | 0.35.4                      | 1 new high advisory (GHSA-wq5f-xc86-pv6w)         |
| `shell-quote`   | `^1.11.0`  | `concurrently`                      | 1.9.0                       | 1 new critical advisory (GHSA-pqg4-j6r4-53mv)     |

The `jsdom` pin is not a vulnerability fix. jsdom 27 and later depend on the ESM-only `@exodus/bytes`, which made serverless functions fail with `ERR_REQUIRE_ESM` (#995). `next.config.ts` keeps those packages out of the server bundle and `__tests__/deploy-config.test.ts` guards that, but lifting the pin also needs a deployed check of the routes that sanitize HTML, so it stays until that check is done.

Review this table whenever a pinned package's parent is upgraded: remove the pin in a scratch copy, rerun the audit, and drop the override only when the unpinned tree adds no advisories. `__tests__/package-overrides-documented.test.ts` fails when an override is added without a row here.
