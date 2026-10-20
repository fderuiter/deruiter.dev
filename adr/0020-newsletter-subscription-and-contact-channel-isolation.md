# 0020. Newsletter Subscription Engine, First-Class Contact Route & Zero-Exfiltration Channel Isolation

## Status

Accepted

## Context

To establish a direct editorial channel with technical peers and recruiters while safeguarding site communications from spam crawlers, the portfolio required two architectural evolutions:

1. **Engineering Dispatch Newsletter**: A lightweight subscription mechanism delivering occasional technical retrospectives on formal verification, AST logic compilers, CDISC clinical systems, and browser physics.
2. **Channel Consolidation & Email Scrubbing**: Removing raw, unauthenticated email links (`mailto:fpderuiter@gmail.com`) from public DOM structures, footers, homepage teaser cards, and structured JSON-LD schemas, funneling all inbound inquiries through the authenticated, bot-defended `<ContactForm />` and `/api/contact` pipeline.

Key constraints:

- Outbound emails must leverage the existing `resend` SDK and HTML templating engine (`lib/email-templates.ts`) without introducing heavy external client dependencies.
- Submissions must be hardened against automated bots via invisible honeypots (`_gotcha`), client duration gates ($> 2000$ms), and anonymous connection-hash sliding-window rate limiting.
- Offline and CI testing must remain 100% deterministic with zero external network dependencies.
- The new `/contact` route and `/api/newsletter` endpoint must maintain 100% synchronization across the 5-Point Discovery Matrix.

## Decision

1. **Transactional Newsletter Dispatcher (`lib/services/email-service.ts`)**:
   - Encapsulates newsletter subscription handling behind `EmailService.subscribeNewsletter()`.
   - Dispatches a Swiss-styled welcome receipt (`renderNewsletterWelcomeEmail`) to the subscriber alongside an administrative notification.
   - Operates in simulation mode during Vitest test execution and local development when `RESEND_API_KEY` is not present.
2. **First-Class `/contact` Route (`app/contact/page.tsx`)**:
   - Establishes a dedicated, WCAG 2.1 AA accessible contact hub featuring `<ContactForm />`, direct Google Calendar booking shortcut, newsletter signup widget, and network verification links.
   - Synchronized across `Navbar.tsx`, `Footer.tsx`, `CommandPalette.tsx`, `sitemap.ts`, `seo-metadata.ts`, and OpenGraph generator `app/contact/opengraph-image.tsx`.
3. **Public Email Scrubbing & Channel Isolation**:
   - Scrubbed all `mailto:fpderuiter@gmail.com` occurrences from `app/page.tsx` (Section 04), `app/schedule/page.tsx`, and `components/Footer.tsx`.
   - Removed `"email"` field from `getPersonNode()` in `lib/seo.ts` to prevent scraping by automated web crawlers.
   - Added regression test `__tests__/email-scrub-regression.test.tsx` ensuring zero instances of raw email addresses on rendered surfaces.

## Consequences

- Inbound inquiries are channelled exclusively through authenticated, rate-limited, and honeypot-protected endpoints.
- Newsletter subscribers receive immediate confirmation receipts without third-party iframe embeds.
- Zero drift across OpenAPI schemas (`scripts/generate-openapi.ts`) and TypeDoc documentation.
