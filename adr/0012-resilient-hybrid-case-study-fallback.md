# 0012. Resilient Hybrid Fallback Data Architecture for Serverless Database Prerendering

## Status

Accepted

## Context

During production builds on Vercel (`VERCEL_ENV="production"`), Next.js performs static generation and prerendering of route entrypoints (including `/work/laser-loon`, `/case-studies/[slug]`, and `/case-studies`). When `CaseStudyPage` queried the remote Neon PostgreSQL database, newly added static case studies or unseeded database tables caused `findMany` / `findUnique` queries to miss requested records. Because production mode enforced strict database-only lookups and threw unhandled runtime exceptions (`throw new Error("Unable to fetch case study records...")`), static prerendering crashed with exit code 1, halting the entire deployment.

Furthermore, static params generation (`generateStaticParams`), dynamic sitemaps (`sitemap.ts`), and open graph cards (`opengraph-image.tsx`) were vulnerable to database connectivity latency, rate-limiting, and schema discrepancies during concurrent build worker execution.

## Decision

We instituted a **Resilient Hybrid Fallback Data Architecture** centralized in `CaseStudyService` (`lib/services/case-study-service.ts`):

- **Database-Priority Sourcing with Fallback Augmentation**: `CaseStudyService.getAllPublishedCaseStudies()` queries the PostgreSQL database via Prisma, maps live records, and seamlessly unions the result set with static entries from `FALLBACK_CASE_STUDIES` (deduplicating by `slug`).
- **Resilient Single Record Resolution**: `CaseStudyService.getCaseStudyBySlug(slug)` queries the database first; if the slug is absent or the database query encounters transient connection errors, it transparently falls back to `FALLBACK_CASE_STUDIES`. If the slug does not exist in either layer, it returns `null` to allow Next.js `notFound()` 404 handling rather than throwing an unhandled build exception.
- **Deduplicated Static Indexing**: `CaseStudyService.getAllPublishedSlugs()` supplies a complete union of published slugs to `generateStaticParams()` and dynamic sitemaps, ensuring 100% of case studies are prerendered and indexed regardless of remote database seeding state.
- **Consumer Decoupling**: Route entrypoints (`app/case-studies/[slug]/page.tsx`, `app/case-studies/page.tsx`, `app/page.tsx`, `app/sitemap.ts`, `app/case-studies/[slug]/opengraph-image.tsx`) consume `CaseStudyService` directly, eliminating fragmented ad-hoc database queries and arbitrary environment gates.

## Consequences

- Prerendering of `/work/laser-loon` and other static case studies succeeds deterministically across all environments (local, CI, Vercel preview, and Vercel production).
- Remote database connection failures or missing seed rows no longer trigger deployment failures or fatal 500 errors during build time.
- Production and preview builds remain fully decoupled from manual remote database seed synchronization.
- 404 responses are rendered cleanly for genuinely invalid routes via Next.js `notFound()`.
- End-to-end regression test suite (`__tests__/resilient-case-study-fallback.test.tsx` and Invariant #11 in `__tests__/defect-remediation-regression.test.ts`) guards against future regressions.
