# 0018. Resilient Transactional Email Architecture, Zero-Dependency Templates & Frictionless Bot Defense

## Status

Accepted

## Context

The portfolio showcases interactive software engineering systems, clinical CDISC engines, and research case studies. To facilitate direct communication with recruiters, collaborators, and technical peers, the site requires an integrated messaging channel, alongside automated administrative notifications when visitors leave feedback on case studies.

Key constraints & requirements:

1. **Zero Public Performance Degradation**: Outbound email processing must not block edge routing, introduce heavy third-party client scripts (such as CAPTCHA iframes), or bloat client bundles with unnecessary libraries.
2. **Frictionless Bot Defense**: The public contact endpoint must withstand spam bots and email flooding without imposing invasive CAPTCHA challenges on human visitors.
3. **Architectural Aesthetic & Type Safety**: Email templates must reflect the portfolio's Swiss editorial design system (`#0d0e11` graphite, Precision Amber `#f59e0b`, hairline micro-borders), and the email dispatcher must be governed by strict Zod schemas and typed result contracts.
4. **Deterministic Offline Development & CI Resilience**: Static builds (`npm run build`), Vitest unit suites, and GitHub Actions CI pipelines must execute cleanly without requiring live Resend API keys or making external network requests.
5. **Zero Documentation Drift**: The new API endpoint (`/api/contact`) and service contracts must be fully registered across `openapi.json`, `lib/env.ts`, `lib/schemas.ts`, and TypeDoc docs.

## Decision

We implement a **Unified Transactional Email Service** powered by the official `resend` SDK and structured around a Spec & Handler pattern:

- **Unified Email Service (`lib/services/email-service.ts`)**: Encapsulates all transactional email operations (`sendContactInquiry`, `sendFeedbackNotification`) behind a narrow, well-typed interface returning `{ success: boolean; data?: { id: string }; error?: string; simulated?: boolean }`.
- **Zero-Dependency Architectural HTML Templates**: Email markup is generated via pure TypeScript template functions (`lib/email-templates.ts`) that apply Swiss graphite styling, responsive tables, and input sanitization via `isomorphic-dompurify`, completely avoiding `@react-email` dependency overhead and React 19 SSR conflicts.
- **Frictionless Bot Defense & Rate Limiting**: The `/api/contact` route applies multi-layered protection:
  - Invisible honeypot trap field (`_gotcha` / `company_url`).
  - Timestamp elapsed verification (rejecting submissions occurring $< 2$ seconds from page load).
  - Anonymous connection-hash rate limiting (maximum 5 submissions per 10 minutes per IP/User-Agent hash via `lib/moderation.ts`).
  - Tone and constructive content validation (`validateConstructiveContent`).
- **Resilient Hybrid Fallback & Simulation**: When `RESEND_API_KEY` is not present (or during `VITEST=1` / local development), the service operates in deterministic simulation mode, logging structured message previews to the console and returning simulated message IDs (`sim_msg_<hash>`) without throwing exceptions or generating false-alarm Sentry errors.
- **Case Study Feedback Integration**: Inbound feedback submitted to `/api/case-studies/feedback` triggers an asynchronous admin alert email via `EmailService.sendFeedbackNotification()`.
- **Integrated UI Contact Component**: An accessible, WCAG 2.1 AA compliant `<ContactForm />` component with real-time feedback and clear state transitions embedded into the Landing Page (`#contact`) and Schedule Page (`/schedule`).

## Consequences

- Direct messaging is fully integrated into the portfolio without routing visitors away to external email clients.
- Automated notifications keep the site author informed of visitor inquiries and case study comments in real time.
- Zero external CAPTCHA scripts or heavy email layout dependencies are introduced.
- Development, CI, and test runners operate offline with 100% test coverage and zero flaky external network dependencies.
- Full compliance with repository architectural invariants, OpenAPI specifications, and TypeDoc documentation gates.
