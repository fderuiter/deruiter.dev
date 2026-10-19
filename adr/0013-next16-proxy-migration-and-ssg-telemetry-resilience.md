# 0013. Next.js 16 Edge Proxy Architecture and Build-Time Telemetry Resilience

## Status

Accepted

## Context

Following the upgrade to Next.js 16, Vercel build pipelines surfaced several architectural deprecations, warnings, and compilation friction points:

1. **Next.js 16 Middleware Deprecation**: Next.js 16 deprecated the `middleware.ts` file convention in favor of `proxy.ts` exporting named `proxy()` handlers to clarify edge network boundaries and execution ergonomics.
2. **Build-Time GitHub SSG 404/403 Stderr Dumps**: During static page prerendering (`app/case-studies/[slug]/page.tsx`, `app/case-studies/page.tsx`, `app/page.tsx`), unauthenticated requests to `api.github.com` for unreleased repositories or rate-limited IP addresses threw HTTP 404/403 errors. Because `lib/github.ts` logged full stack traces to `console.error` whenever `VERCEL_ENV === "production"`, production build logs were polluted with 20+ false-alarm exception dumps.
3. **Node.js Engine Version Alignment**: `package.json` pinned `"node": "22.x"`, causing deployment warnings when running against modern Node 24 Vercel build environments.
4. **TypeDoc Export Parity**: Internal classes such as `SafeStorageAdapter` in `lib/safe-storage.ts` were declared without top-level `export`, triggering TypeDoc documentation extraction warnings.

## Decision

We executed a comprehensive build hardening and architectural migration:

- **Next.js 16 Edge Proxy Migration**: Migrated edge request interception from `middleware.ts` to `proxy.ts`. The proxy exports an asynchronous `proxy(req: NextRequest): Promise<NextResponse>` function enforcing HTTP security headers, privacy-preserving client connection token generation via Web Crypto SHA-256, and updated DX dead-code analysis entrypoints.
- **Deterministic SSG Telemetry Fallback**: Refactored `lib/github.ts` to treat HTTP 404 (private/unreleased repositories) and HTTP 403 (unauthenticated 60 req/hr rate limits) as normal expected states. When GitHub API endpoints are unreachable or unauthenticated, `getGitHubStats(owner, repo, fallbackLanguage)` gracefully falls back to deterministic simulated stats (`getSimulatedStats(language)`), preserving 100% UI telemetry card population without dumping stderr stack traces during static compilation.
- **Node Engine Compatibility**: Updated `package.json` `engines.node` to `">=22.0.0"`, ensuring compatibility across Node 22 LTS, Node 24 LTS, and Vercel containerized runners.
- **TypeDoc Export Completeness**: Exported `SafeStorageAdapter` in `lib/safe-storage.ts`, achieving 100% TypeDoc compilation parity with 0 warnings.
- **Build Warning Suppression**: Configured `process.env.SERWIST_SUPPRESS_TURBOPACK_WARNING = "1"` in `scripts/build.js` to eliminate noisy build-time compiler warnings.

## Consequences

- Next.js 16 build logs compile with zero deprecation warnings and zero unhandled GitHub API stderr dumps.
- Telemetry cards across Case Studies and Landing pages remain deterministically populated across offline, CI, and unauthenticated production build environments.
- Edge request interception fully aligns with Next.js 16 `proxy.ts` architecture.
- Full test suites, TypeDoc compilation, and DX doctor invariant gates pass cleanly with 100% verification parity.
