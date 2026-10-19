# 0014. Clerk Authentication & Edge Middleware Architecture for Admin & Author Portal

## Status

Accepted

## Context

The portfolio showcases interactive engineering studios, clinical CDISC engines, and published case studies. To support editorial workflows—such as authoring and previewing draft case studies, publishing updates, and inspecting raw analytics telemetry—the portfolio requires administrative capabilities without exposing write access to public visitors.

Key constraints:

1. **Zero Public Performance Degradation**: Public visitors must never encounter auth latency, blocking database user checks, or broken prerendering on static routes.
2. **Edge Security & Privacy Preservation**: The existing edge middleware pipeline (`middleware.ts`) applies HTTP security headers (`applySecurityHeaders`) and computes Web Crypto SHA-256 client connection tokens (`generateClientConnectionHash`) for anonymous rate limiting.
3. **CI/CD & Offline Test Resilience**: Test suites (Vitest, Playwright synthetic probes) and static builds (`npm run build`) must run deterministically without requiring live Clerk network credentials.
4. **Architectural Palette Alignment**: All auth surfaces must seamlessly integrate with the Swiss engineering graphite design system (`#0d0e11`, zinc borders, dark theme) and maintain WCAG 2.1 Level AA compliance.

## Decision

We adopt `@clerk/nextjs` configured with an **Edge Middleware Chaining & Environment-Gated Authorization Architecture**:

- **Edge Middleware Chaining**: Wrap `middleware.ts` with `clerkMiddleware()` using `createRouteMatcher` to guard `/admin(.*)` and `/api/admin(.*)`, while chaining existing security headers and anonymous connection hash generation across all requests.
- **Environment-Gated Admin Authorization**: Admin access is verified server-side against typed environment variable allowlists (`ADMIN_USER_IDS`, `ADMIN_EMAILS`) defined in `lib/env.ts`, avoiding unnecessary database user table synchronization.
- **Architectural Dark Auth Surface**: Auth pages (`/admin/login`) utilize `@clerk/themes` dark presets with bespoke styling aligned with `#0d0e11` graphite containers and monospace typography.
- **In-Route Access Denied Console & Graceful Authorization**: Rather than throwing unhandled server exceptions when authenticated non-admin visitors access `/admin`, `getAdminAuthSession()` returns structured authorization state, rendering an in-route 403 console with 1-click clipboard helpers for `ADMIN_EMAILS` and `ADMIN_USER_IDS`, account switching, and re-verification triggers.
- **Defensive Environment & Test Stubs**: Clerk keys (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`) are validated in `lib/env.ts` with test mocks in `vitest.setup.ts` to allow 100% offline static prerendering and test suite execution.

## Consequences

- The portfolio gains a secure, production-ready admin layer for content drafting and analytics inspection.
- Unlisted authenticated users receive clear, actionable self-service guidance with exact Clerk UIDs and emails without triggering Next.js error boundaries or false-alarm Sentry exceptions.
- Public routes remain 100% static, fast, and accessible without auth friction.
- Edge security headers and anonymous telemetry fingerprinting are preserved without conflict.
- The build, quality verification, and CI pipelines continue to run cleanly offline.
