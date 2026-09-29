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
2. **Business Justification (`reason` / `justification`):** Must contain a clear description of why the vulnerability is non-actionable or safe in the current deployment context (e.g., dev-only tool, build-time utility with no production runtime exposure).
3. **Expiration Date & Maximum 90-Day Lifespan (`expiresAt` / `expires`):** Must provide a valid ISO timestamp specifying when the override expires. Overrides are capped at a **maximum lifespan of 90 days** from creation/execution. Overrides exceeding 90 days are flagged as invalid and fail the audit.
4. **Target Package Scope (`package` / `name`):** Optional parameter to restrict the override to a specific package name.

### Override Validation & Enforcement

During local or CI execution, the audit tool validates all active override rules:

- **Expired Rules:** Rules whose expiration date has passed (`expiresAt <= now`) are rejected and cause the security audit to fail.
- **Invalid Rules:** Rules missing required fields or exceeding the 90-day limit trigger explicit validation errors and fail the audit.
- **Active Rules:** Valid, unexpired rules temporarily suppress matching high or critical vulnerabilities and log active remaining lifespan (in days) to console output.

## Dynamic Runtime Security Circuit Breaker & Manifest Integration

To prevent exploitation of unpatched dependency vulnerabilities on critical data paths, the system integrates build-time security audit manifests with dynamic API route middleware.

### Build-Time Security Manifest Generation

During build execution (and whenever `scripts/security-audit.ts` runs), the security audit tool processes active vulnerability override rules from `security-audit-ignore.json` and exports `lib/security-manifest.json`. This structured manifest contains:

- `generatedAt`: ISO timestamp of manifest generation.
- `activeRules`: List of active, valid, non-expired CVE override rules including advisory ID, target package, expiration date, owner, follow-up ticket, and justification.

### Runtime Route Circuit Breaker Enforcement

API route handlers wrapped with `createApiHandler` in `lib/route-wrapper.ts` declare their underlying package dependencies via the `packages` option (e.g. `packages: ["@upstash/redis", "@prisma/client"]`).

During request processing:

1. **In-Memory Manifest Inspection:** `createApiHandler` inspects `lib/security-manifest.json` in memory without adding database or network latency.
2. **Active CVE Matching:** If an active override rule in the security manifest targets a package declared by the route handler, the circuit breaker automatically trips.
3. **Traffic Shedding & Status Response:** Tripped endpoints shed traffic immediately with an `HTTP 503 Service Unavailable` response, returning `Retry-After: 300` and `X-Circuit-Breaker-Tripped: true` headers.
4. **Security Observability:** Circuit breaker trips log structured audit records containing the route, affected package, advisory ID, owner, follow-up ticket, and justification.
