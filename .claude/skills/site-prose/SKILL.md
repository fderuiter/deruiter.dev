---
name: site-prose
description: deruiter.dev house rules for editing prose. Use with the humanizer skill when writing or editing a blog post, case study, page copy, game copy, README, docs, a PR body or an issue in this repository.
---

The `humanizer` skill (`.claude/skills/humanizer/`, vendored from
upstream) removes AI writing tells. This skill adds what is specific to
this site. Run humanizer first, then check the draft against the rules
here. Where the two disagree, this file wins for this repository.

## Voice

- First person for blog posts and case studies. Plain, warm and a little
  dry. Keep real jokes, asides and opinions; cut the staging around them.
- Reference pages, how-to guides and ADRs stay neutral and plain.
- Describe AI-assisted work as "coding agents". Don't name a vendor or
  model.
- No em or en dashes in prose. Hyphens inside code, paths, CDISC
  variable names and ranges stay.

## Claims

- Every number, date and feature must come from merged work on `main`,
  a linked PR, or Fred. Don't round up, and don't describe planned work
  as shipped.
- Never name an employer, a role, hiring or a job search, and never say
  the site was built for one. `__tests__/peer-narrative-copy.test.ts`
  scans for the common phrases.
- No compliance claims: "X compliant", "100% ...", "complies with
  (a standard)", "immutable audit trail" and similar.
  `__tests__/clinical-claims-wording.test.ts` enforces the clinical set.
- Cite standards by name (SDTMIG, Define-XML, ICH E6) without literal
  version strings in `lib/`; `__tests__/clinical-standards-profile.test.ts`
  owns the exemptions.
- No professional-experience claims Fred hasn't given.

## Where the prose lives

| Surface                   | File                                                                               |
| ------------------------- | ---------------------------------------------------------------------------------- |
| Blog posts                | `lib/fallback-blog-posts.ts` (each post's `body` is Markdown in a template string) |
| Case studies              | `lib/case-studies-data.ts`, `app/case-studies/`                                    |
| FAQ                       | `lib/faq-content.ts`                                                               |
| Game manuals and listings | `lib/game-manuals.ts`, `lib/arcade/registry.ts`                                    |
| SEO descriptions          | `lib/seo-metadata.ts`, `app/**/opengraph-image.tsx`                                |
| Page copy                 | `app/**/page.tsx` and the components they render                                   |

Epic #3041 tracks the pass over each surface.

## Editing safely

- Use humanizer's file mode: change prose only. Leave code, inline code,
  identifiers, CDISC variable and dataset names, URLs, link targets, test
  fixtures and Markdown structure alone.
- In `.ts` and `.tsx` strings, keep escapes intact: backticks and `${` in
  template strings, `&apos;` and `{"..."}` in JSX.
- Some copy is asserted by tests (`*-copy.test.ts*`, snapshot and
  accessibility tests). If one fails, decide whether the test pins a fact
  or only old wording. Update wording-only assertions in the same PR;
  never weaken a guard.
- Don't edit `README.md` while another PR holds its lock (see the merge
  lane), and never edit generated files (`docs/reference/`, `openapi.json`).

## Leave alone

- Quotations, standard names, controlled terminology, legal text and
  licence files.
- `adr/` decision history: fix tells in a new ADR, but don't rewrite what
  an accepted ADR said.
- Upstream skills under `.agents/skills/` and `.claude/skills/humanizer/`.

## Check before you push

```bash
npx vitest run __tests__/peer-narrative-copy.test.ts __tests__/clinical-claims-wording.test.ts __tests__/clinical-standards-profile.test.ts
npm run typecheck && npm run lint && npm run lint:docs
```

Then search the diff once more for the tells that survive a rewrite:
not-X-but-Y contrasts, one-line closers, triads, dashes and bold labels.
