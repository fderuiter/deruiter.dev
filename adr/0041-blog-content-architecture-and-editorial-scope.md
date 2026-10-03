# ADR 0041: Blog Content Architecture & Editorial Scope

## Status

Accepted on 2026-09-13. Governs epic #757 and its child tickets (#758–#767). Builds on the **Resilient Hybrid Fallback** and **Free-Tier Offloading Architecture** established for `CaseStudy` (ADR 0036) and the **High-Assurance Systems Case Study Standard** (`CONTEXT.md`).

The recruiter audience named below was retired by [ADR 0047](0047-peer-engineering-narrative-and-dual-layer-perspective.md): the site now writes for peer engineers.

## Context

The portfolio's SEO strategy already promises a **Systems Dispatch Newsletter** ("periodic technical retrospectives on formal verification, AST compilers, CDISC clinical data systems, and browser physics" in `lib/services/email-service.ts`, `/api/newsletter`), but nothing indexes, permalinks, or archives that writing. There is no crawlable surface for it, and no RSS feed for the technical readers (recruiters, engineers) this site is built for.

The only existing long-form content type is `CaseStudy`, and it is deliberately rigid: every row requires a `github_url` (or equivalent primary artifact per the **Platform-Agnostic Source Linking** pattern) and follows the mandatory 5-section **High-Assurance Systems Case Study Standard**. That structure is correct for "here is a specific system I built and proved works," but it cannot hold:

- a retrospective that spans multiple projects ("why I keep reaching for AST-based validation instead of regex"),
- a technique write-up aimed at long-tail search intent ("zero-CLS canvas text measurement with Pretext"),
- or a narrative/opinion piece that isn't anchored to a shippable artifact at all.

Before any blog code lands (route scaffold, schema, admin authoring, SEO, feed, telemetry; issues #759–#767), this ADR fixes the product decisions those tickets depend on, so implementation is an engineering exercise, not a series of ad hoc judgment calls.

## Decision

### 1. Purpose & positioning

The blog is the **permanent archive for the Systems Dispatch Newsletter** and the long-tail arm of the **Omni-Channel Tiered Search Funnel**. It is a distribution and discovery surface, not a discussion forum or a general-purpose CMS: every post exists to either (a) demonstrate systems-engineering judgment to a technically literate reader, or (b) capture a specific long-tail search query and route that visitor toward a case study, an interactive tool, or `/schedule`.

### 2. Scope boundary: `BlogPost` vs. `CaseStudy`

| Dimension      | `CaseStudy`                                                                  | `BlogPost`                                                                       |
| -------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Anchor         | Exactly one project; requires `github_url` or an equivalent primary artifact | None required: cross-project, retrospective, or narrative                        |
| Structure      | Mandatory 5-section High-Assurance Systems Case Study Standard               | Free-form long-form prose, tagged to one content pillar                          |
| Route          | `/case-studies/[slug]`                                                       | `/blog/[slug]`                                                                   |
| Job to be done | Prove a specific system was built and works                                  | Explain a technique, retrospective, or position; capture long-tail search intent |
| Interactivity  | Sandbox terminal, live telemetry, direct studio handoff                      | Cross-links to case studies/tools; no embedded sandbox                           |

A rule of thumb for future authors: **if the piece needs a `github_url` to make sense, it's a case study; if it would still make sense with zero code attached, it's a blog post.**

**Explicit non-goals**:

- No discussion-forum-style comments. Reader response is limited to the lightweight reaction mechanism already proven by `CaseStudyReaction` (see #765 / M8).
- No third-party CMS or SaaS content platform (Contentful, Sanity, Ghost, etc.); see §4.
- No new visual design system. Blog posts render inside the existing **High-Assurance Architectural Palette** and **Scientific & Engineering Editorial Design System**: same graphite surfaces, same type stack, same status-accent tokens.

### 3. Content pillars

Posts are tagged to exactly one pillar, each mapped to a tier of the **Target Search Intent Hierarchy**:

1. **Clinical Data Engineering & CDISC Standards**: Tier 1 (high-intent systems/recruiter discovery).
2. **Formal Verification & AST/Compiler Theory**: Tier 1.
3. **Accessibility & Cognitive-Reading Engineering**: Tier 1 and Tier 3 (dyslexia-typography techniques are genuinely useful public reference material, not just portfolio color).
4. **Browser Graphics, Canvas & Game Engineering**: Tier 3 (public web utility / "how do I do X in canvas" search traffic).
5. **Agent-First DX & Tooling**: Tier 1.
6. **Field Notes: Make Things Better**: career/ethos narrative pieces; supports the recruiter narrative directly rather than driving search traffic.

This taxonomy is the source of truth for `BlogPost.pillar`, implemented in #760 (M3) and used for tag/keyword generation in #762 (M5).

### 4. Editorial workflow: Prisma-backed rows via `/admin`, not in-repo MDX

**Decision**: blog posts are authored as `BlogPost` rows in Neon/Prisma through the existing Clerk-gated `/admin` surface (the same pattern `CMS_GUIDELINES.md` already establishes for `CaseStudy`), not as MDX files compiled at build time.

**Rationale**:

- Reuses the already-proven **Resilient Hybrid Fallback** service pattern, the existing sanitized-HTML allowlist (`architectural_narrative`'s permitted-element list), and the existing admin authentication/authorization boundary (`ADMIN_USER_IDS` / `ADMIN_EMAILS`), instead of standing up a second content pipeline with its own sanitization surface to audit.
- Avoids adding an MDX compiler/content-collection dependency (e.g. Contentlayer) purely to support arbitrary embedded React in post bodies: that trades a bounded sanitization problem for an open-ended one (MDX bodies can execute arbitrary component code at build time), which is a worse trade for a personal portfolio's threat model than it would be for a team blog with trusted committers only.

**Trade-off acknowledged**: this rules out embedding live interactive React components directly inside a post body. Mitigation: the existing sanitized allowlist already supports `<pre><code>` blocks and `<a>` cross-links into `/crf`, `/proof`, `/simulator`, etc., which covers the realistic case ("here's the technique, go try it live over there"). If a future post genuinely needs an embedded live demo inline, that is a signal the content belongs in a `CaseStudy` instead, not a reason to reopen the MDX question.

### 5. Success metrics

Measured entirely with infrastructure that already exists; no new paid analytics:

- Organic sessions to `/blog/*` (existing Vercel Web Analytics / telemetry pipeline).
- Click-through rate from a post to a linked `/case-studies/[slug]` or `/schedule`.
- Newsletter signups attributable to a blog referrer.
- `BlogPostReaction` counts (#765 / M8) as a soft engagement signal, not a hard KPI, since reactions are anti-abuse-bounded and low-volume by design.

### 6. Cadence & launch bar

No fixed recurring publishing cadence is mandated: manufacturing a schedule the site then has to enforce would pressure low-quality filler content, which works against the funnel this ADR exists to serve. The launch bar (#767 / M10) is **3–5 posts, one per top-weighted pillar**, published before `/blog` is linked prominently from the homepage/footer.

### 7. Schema shape

The field-level `BlogPost` (and `BlogPostReaction`) shape this decision implies is documented in `CMS_GUIDELINES.md` → "Blog Content Schema (`BlogPost`)". #760 (M3) implements and migrates it; this ADR is the rationale, not the migration.

## Consequences

- **Positive**: one content pipeline, one sanitization boundary, one admin auth path to audit: the blog inherits hardening work already done for case studies instead of duplicating it. The scope line against `CaseStudy` is unambiguous enough that later tickets require engineering judgment only, not further product decisions.
- **Positive**: the Systems Dispatch Newsletter finally has somewhere to point.
- **Negative**: authors cannot embed live interactive components inline in a post body; a post needing that is redirected to become a case study instead.
- **Negative**: no in-repo MDX means no git-based version history for post prose itself (it lives in Neon, covered instead by the existing database backup/restore posture, not git blame).
