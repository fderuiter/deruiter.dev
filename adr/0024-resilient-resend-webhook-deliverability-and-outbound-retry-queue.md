# ADR 0024: Resilient Resend Webhook Deliverability and Outbound Retry Queue

## Status

Accepted

## Context

The portfolio dispatches transactional communications across multiple user journeys:

1. Inbound contact inquiries (`/api/contact`) with visitor confirmation auto-replies.
2. Case study peer feedback alerts (`/api/case-studies/feedback`).
3. Systems dispatch newsletter subscriptions (`/api/newsletter`).

Under high traffic, serverless cold starts, or upstream Resend API maintenance/rate-limiting (429), transactional emails could fail without retry mechanisms. Additionally, lack of automated bounce/spam complaint processing risked domain reputation degradation when visitors submitted malformed or invalid email addresses.

## Decision

We implement a **Dual-Layer Deliverability and Outbound Resilience Architecture**:

### 1. Inbound Deliverability Webhook Engine (`/api/webhooks/resend`)

- Ingests Resend delivery lifecycle webhooks (`email.sent`, `email.delivered`, `email.bounced`, `email.complained`).
- Enforces strict cryptographic signature verification via Svix (`RESEND_WEBHOOK_SECRET` / `svix-id`, `svix-timestamp`, `svix-signature`).
- Persists hard-bounced and spam-complaint email addresses into a `SuppressionList` table in PostgreSQL via Prisma.
- `EmailService` pre-checks recipient addresses against the suppression list before dispatching, preventing reputation damage.

### 2. Resilient Outbound Retry Queue (`OutboundEmailQueue`)

- When upstream Resend API returns 429 rate limits or network connection timeouts, the pending email payload is persisted to `OutboundEmailQueue` with exponential backoff (`attempts`, `nextRetryAt`, `status: PENDING | RETRYING | DELIVERED | FAILED`).
- A lightweight idempotent cron / worker process processes queued dispatches.
- In test and local environments without database connections, `EmailService` gracefully falls back to deterministic mock simulation.

### 3. Production Sender Identity Standardization

- Canonical from-address standardized to `Frederick de Ruiter <notifications@deruiter.dev>` (or `updates@deruiter.dev`) with reply-to explicitly configured.

## Consequences

- **Positive**:
  - Eliminates message loss during upstream API outages or rate limits.
  - Automatically shields domain reputation against repeated delivery attempts to hard-bounced addresses.
  - Maintains strict test isolation with mock simulation in CI and Vitest.
- **Negative**:
  - Adds schema migrations in Prisma for `SuppressionList` and `OutboundEmailQueue`.
