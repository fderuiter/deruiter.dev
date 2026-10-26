# 0036. Free-Tier Offloading and Provider Quota Governance

Date: 2026-09-12

## Status

Accepted — architectural policy governing parent epic #632 and child integration tickets (#621, #626, #694, #696, #698, and new leaf issues).

## Context

The portfolio platform is deployed on Vercel Hobby alongside generous external free tiers:

- **Vercel Hobby**: 10 GB functions storage, 100 build hours/month, strictly **one** scheduled cron job per day (`0 0 * * *`), 10-second serverless execution timeout. At the decision date, the account was observed at **9.6 / 10 GB (96%)** Functions Storage and **86 / 100 hours (86%)** build time (audited in #691, #698). These values are historical context, not live meters; the dated retention inventory is the operational evidence record.
- **Neon Postgres**: 0.5 GiB storage, compute auto-suspends after 5 minutes of inactivity. Direct un-cached public queries wake compute, adding 1–3s cold-start latency and consuming monthly compute hours.
- **Upstash Redis**: 10,000 commands/day, 256 MB storage, 100 requests/sec. Uncached rate-limit queries on every static request would quickly burn the daily command budget.
- **Resend**: 100 emails/day, 3,000/month, 1 sending domain. Spam bots hitting contact forms can rapidly exhaust daily quotas, while outbound retries require a reliable scheduler.
- **Sentry**: 5,000 errors/month, 10,000 transaction spans/month. 100% trace sampling burns quota within days.
- **Clerk**: 10,000 MAU free tier, dedicated solely to `/admin`.

Without an explicit governance model, independent provider quotas collide with Hobby limitations, leading to silent drops, degraded latency, or surprise billing.

## Decision

We adopt the **Free-Tier Offloading Architecture & Quota Governance Strategy**:

### 1. Two-Tier Shield for Database Compute (Neon)

To ensure Neon's serverless compute remains suspended in zero-compute sleep states across public visitor traffic:

- **Tier 1 (Static Edge Prerendering)**: Full-page editorial routes (case studies, dossier specs) use Next.js Incremental Static Regeneration (ISR) with `revalidate = 86400`, and content writes revalidate their paths on demand (each regeneration bills Vercel active CPU, #2971). Static requests cost 0 database queries and 0 Redis commands at runtime.
- **Tier 2 (Upstash Redis Read-Through Cache)**: Dynamic data queries in `CaseStudyService` and reaction counters query Upstash Redis first with a 1-hour TTL. Only cache misses wake Neon Postgres.
- **Write Buffering**: Visitor reactions and telemetry events are buffered in Upstash Redis (`HINCRBY`, `RPUSH`) rather than issuing immediate mutative SQL queries per request.

### 2. Upstash Command Budget Protection (10,000 Commands/Day)

To guarantee Upstash daily command usage remains strictly under 2,000 commands/day (< 20% of quota):

- **L1 In-Memory Ephemeral Caching**: Rate limiters in `@upstash/ratelimit` configure local memory caching (`ephemeralCache`) so repeat requests within the sliding window evaluate in memory without consuming Redis REST commands.
- **Selective Mutative-Only Rate Limiting**: Rate limiting is strictly enforced on mutative endpoints (`/api/contact`, `/api/newsletter`, `/api/telemetry`), bypassing static GET assets.
- **Pipelined Multi-Commands**: Multi-key writes (e.g. queue push + TTL expiration) use `redis.pipeline()` to execute in a single round-trip.
- **Environment Namespacing**: Automatic `preview:` prefixing in preview deployments isolates PR keys from production without provisioning separate paid Redis instances.

### 3. Unified Scheduled Maintenance Pipeline (Vercel Hobby 1-Cron Limit)

Because Vercel Hobby permits only **one cron job per day**, all scheduled operational maintenance is consolidated into a single secured endpoint (`/api/cron/maintenance` or alias `/api/telemetry/sync`):

- **Sequential Bounded Execution**: The job runs once daily at midnight UTC (`0 0 * * *`) and sequentially executes:
  1. Telemetry and reaction-buffer draining into Postgres.
  2. A maximum of five leased outbound email retries, each carrying a stable provider idempotency key.
  3. Transactional retention pruning: roll up raw events older than 30 days into `TelemetryDailyRollup`, then delete only the source rows covered by that transaction. Upstash's own TTL expiry remains authoritative for volatile rate-limit keys so the job does not waste free-tier commands scanning for keys Redis has already removed.
- **Execution Budget**: Total execution is clamped to $\le 8$ seconds to satisfy Hobby's 10-second serverless timeout.
- **Sub-Daily Option (Upstash QStash)**: For sub-daily email retry latency (< 15 minutes), an event-driven webhook via Upstash QStash (free tier: 500 messages/day) may be attached without requiring Vercel Pro.

### 4. Defense-in-Depth Bot Filtration for Resend (100 Emails/Day)

Before an email can reach Resend's sending API:

- Human Duration Gate ($\ge 2000$ms elapsed since form mount).
- Hidden Honeypot trap (`_gotcha`).
- Anonymous connection-hash rate limiting (5 requests / 10 minutes).
- Synchronous profanity and toxic rant pattern filter.
- Simulated delivery mode in development, preview, and test environments.
- Retry rows use an expiring optimistic lease so overlapping function invocations cannot double-dispatch. The Resend idempotency key remains stable across lease expiry and ambiguous network failures, and retry delays add deterministic jitter to avoid synchronized bursts.

### 5. Sentry Quota Bounds (5k Errors / 10k Spans)

- `tracesSampleRate`: 0% in preview and development, bounded to 5% (0.05) in production.
- `beforeSend` filtering: Silently drops benign noise (`AbortError`, client browser extension script errors, crawler 404s).
- PII scrubbing: Strips sensitive headers, query parameters, and email bodies before transmission.

### 6. Dual-Tracker Issue Delivery & External Agent Review Briefs

All child issues governing this architecture are delivered using the dual-tracker pattern:

- Standalone markdown tickets in `.scratch/issues/` for context isolation.
- Synchronized GitHub issues under parent epic #632 with standard labels (`integration`, `ready-for-agent`, `p1-critical`).
- Each issue concludes with an **Agent Review Brief** block providing explicit file paths, acceptance criteria, and invariant verification commands (`npm test`, `npm run verify:*`, `npm run quality`) for external reviewer agents (Claude Code / OpenAI).

## Consequences

### Positive

- Zero cloud infrastructure costs: operates entirely within supported free tiers across all 5 external providers.
- Bounded operational blast radius: rate limits, cold starts, and quota exhaustion in one provider cannot cascade to others.
- Low-latency visitor experience: edge caching and suspended database compute keep TTFB low while preserving live interactivity.
- External agent readiness: unambiguous acceptance criteria and verification commands allow autonomous agents to verify or implement leaves with minimal hallucinations.

### Negative / Trade-offs

- Cache Invalidation Complexity: Mutation of case studies or author data requires explicit cache bust (`revalidateTag` or Redis key eviction).
- 24-Hour Email Retry Backoff on Hobby Base: Transient email failures processed by daily cron may wait up to 24 hours unless Upstash QStash event-driven scheduler is active.
