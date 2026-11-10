# How-To: Configure Resend and Webhooks

Goal: get transactional email (contact form replies, newsletter
confirmations, case-study feedback alerts) and the inbound Resend
deliverability webhook working locally or in a new deployment environment.
See [ADR 0018](../../adr/0018-resilient-transactional-email-and-bot-defense.md)
and [ADR 0024](../../adr/0024-resilient-resend-webhook-deliverability-and-outbound-retry-queue.md)
for why the retry queue and the bounce and complaint handling work the way
they do. See the
[integration catalog](../reference/integrations-catalog.md) for how Resend
fits alongside this project's other external integrations, and
[how-to: configure Clerk, Sentry, Upstash, Vercel Cron/Analytics, and GitHub data fetching](configure-integrations.md)
for the rest of them.

## 1. Set the required environment variables

These three keys are declared in [`lib/env.ts`](../../lib/env.ts) and
mirrored in `.env.example`:

```bash
RESEND_API_KEY=""
RESEND_WEBHOOK_SECRET="whsec_example_secret_key"
RESEND_FROM_EMAIL="Your Name <notifications@yourdomain.com>"
```

- **`RESEND_API_KEY`**: from the [Resend dashboard](https://resend.com/api-keys).
  Mail is sent for real only when the application runs as Production.
  Development and Preview always simulate delivery, even if a key is attached
  by mistake. Tests exercise a mocked transport with an explicit
  `re_test_` fixture key and never contact Resend.
- **`RESEND_FROM_EMAIL`**: must be a verified sending address/domain in
  your Resend account, or sends will be rejected.
- **`RESEND_WEBHOOK_SECRET`**: the signing secret Resend gives you when you
  create a webhook endpoint (see step 3). It's a Svix signing secret
  (`whsec_...`), not a Resend API key.

Validate the file against the declared contract:

```bash
npm run env:check
```

## 2. Understand what the webhook receiver does

[`app/api/webhooks/resend/route.ts`](../../app/api/webhooks/resend/route.ts)
receives Resend's deliverability events (bounces, complaints, delivery
confirmations). It:

1. Requires all three Svix signature headers (`svix-id`, `svix-timestamp`,
   `svix-signature`). A request missing any of them gets a 400.
2. Verifies the signature via
   [`verifySvixSignature`](../../lib/services/email-service.ts) against
   `RESEND_WEBHOOK_SECRET` before it parses the body. An invalid signature
   gets a 401.
3. Parses and validates the JSON payload against `ResendWebhookEventSchema`
   in `lib/schemas.ts`. A payload that doesn't match gets a 422.

Because the signature is checked before the JSON is parsed, a webhook set up
with the wrong secret fails on the first event instead of quietly accepting
unverified ones.

### Event selection

Only `email.bounced` and `email.complained` trigger a suppression-list
write (`EmailService.recordSuppression`). Every other subscribed event type
(`email.sent`, `email.delivered`, `email.delivery_delayed`, `email.opened`,
`email.clicked`) is accepted and acknowledged (`handled: true`) but has no
side effect, because there is no delivery-analytics store for them yet.

### Retry and duplicate-delivery semantics

The route acknowledges an event with `200` only once it is durably
processed. If the suppression-list write throws (database outage, connection
drop, etc.), `EmailService.handleWebhookEvent` returns `{ handled: false }`
and the route responds `500`. Resend and Svix treat any non-2xx response as a
failed delivery and retry with backoff, so the event is not lost.

A legitimate redelivery (Svix retrying after a prior non-2xx, or Resend
sending a genuine duplicate) is never rejected. The route does not check
whether it has seen a `svix-id` before. Instead,
`recordSuppression` is an idempotent upsert keyed by the recipient's email
address, so replaying the same `email.bounced`/`email.complained` event any
number of times leaves the suppression list in the same state, with no
duplicate rows or side effects. A batch event with several recipients is also
safe to retry in full after a partial failure. Recipients already written are
upserted again with no change, and only the one that failed before changes
state.

That is a deliberate simplification for a Hobby-tier deployment. A ledger of
processed event IDs would let a duplicate be skipped without touching the
database, but a second write to the same suppression row is already safe and
cheap, so the upsert is enough.

### Suppression-check failure policy

`EmailService.isSuppressed` (the *read* path, consulted before every
outbound send) fails **open** on a database error. It returns
`{ suppressed: false }` and the send goes ahead, because a brief outage on the
read path should not stop all outbound mail. The *write* path above fails the
other way on purpose. A failed suppression-list write is never accepted
silently, because losing it could mean a bounced or complaining address keeps
getting mail.

### Secret rotation

Only a single active `RESEND_WEBHOOK_SECRET` is supported. There is no
window where both the old and the new secret verify. Rotate the secret in the
Resend dashboard and update the environment variable together, or requests
signed with the secret that is not configured will fail verification.

### Durable outbound retry safety

The daily maintenance route leases at most fifteen due queue rows
(`EMAIL_RETRY_BATCH_SIZE`) before dispatching them. An overlapping invocation can lease each row only once; if a
worker stops unexpectedly, its five-minute lease expires and the row becomes
eligible again. Every retry uses `portfolio-email-<queue-id>` as the Resend
idempotency key, so an ambiguous timeout and later retry converge on one
provider send. Failures use capped exponential backoff with deterministic
jitter, recheck the suppression list immediately before dispatch, and retain
structured tags without logging message bodies.

### Systems Dispatch newsletter and the daily budget

Newsletter signups are double opt-in (#841). A signup is stored as a
`PENDING` `NewsletterSubscriber` and gets one confirmation email; the address
receives nothing else until someone follows that link. A pending address is
re-sent a confirmation at most once an hour. Every later email carries a
visible unsubscribe link plus `List-Unsubscribe` and `List-Unsubscribe-Post`
headers, and `/api/newsletter/unsubscribe` works in one click with no sign-in.

Publishing a blog post queues a `NewsletterDispatch`. The maintenance run
also discovers posts published directly in the database within the last seven
days. Nothing is sent on publish. Each run's `newsletter` phase, which runs
before `emailRetry`, enqueues announcements into `OutboundEmailQueue` for
subscribers who were confirmed when the post was queued, rechecking the
suppression list for each one. The queue's own suppression recheck, leasing,
retry and idempotency then apply to the send.

**Why this cannot exhaust Resend's 100 emails a day:**

- Queued mail goes out only from the daily run, at most 15 per run
  (`EMAIL_RETRY_BATCH_SIZE`), and there is exactly one run a day. When QStash
  is configured, `app/api/webhooks/qstash/retry/route.ts` also retries a
  queued row within the day, one row per delivery, after a retryable send
  failure (5 minutes, then 15 minutes, then 1 hour).
- The newsletter phase enqueues at most 10 per run
  (`NEWSLETTER_DISPATCH_CAP`), and never more than the room left in the next
  batch after retries already waiting. Several posts published the same day
  share that same cap; the rest drain on later days.
- So queued mail, newsletter included, uses at most 15 of the 100. At least
  85 remain for mail sent inline: contact replies (two per inquiry), feedback
  alerts, and newsletter confirmation, welcome and admin mail (three per
  confirmed subscriber).

Preview and development never transmit: `shouldSimulateEmailDelivery` covers
the queue path too.

## 3. Register the webhook endpoint with Resend

In the Resend dashboard, add a webhook endpoint pointing at:

```text
https://<your-deployed-domain>/api/webhooks/resend
```

Resend generates a signing secret for that endpoint. Copy it into
`RESEND_WEBHOOK_SECRET`. To receive real webhook deliveries locally you need a
tunnel (an `ngrok`-style forwarding URL) pointing at `npm run dev`'s port.
Otherwise, test the route directly (see step 4).

## 4. Test the webhook locally without a live tunnel

Because signature verification is a pure function of the raw body and the
three Svix headers, you can construct a valid signed request in a test or a
local script with the secret in your `.env.local`, without Resend delivering
anything. Follow
[`__tests__/resend-webhook.test.ts`](../../__tests__/resend-webhook.test.ts)
for the exact signing scheme
(`${svixId}.${svixTimestamp}.${payload}`, HMAC over that string) and for
worked examples of both a valid and a tampered signature.

## 5. Confirm the full flow

```bash
npm run dev
```

Submit the contact form (or trigger a newsletter subscription) locally and
check the server logs for the simulated-send confirmation. Local development
never transmits. Live delivery and bounce/complaint verification must be done
from the protected Production environment with an approved synthetic
recipient. Confirm the event comes back through the webhook route without a
400, 401 or 422, and keep only evidence with the secrets redacted.

Before closing the provider configuration gate, an operator must verify the
Production sending domain and sender, register the canonical
`https://deruiter.dev/api/webhooks/resend` endpoint with the intended event
types, scope the API and webhook secrets to Production, and confirm Preview has
no way to send. None of these dashboard steps can be checked from the source
code, or automated without the protected account credentials.
