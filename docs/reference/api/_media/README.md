# Documentation

This repository's documentation is organized around the
[Diátaxis](https://diataxis.fr) framework: four quadrants, each answering a
different kind of question, so a guide doesn't have to be several things at
once. See [ADR 0023](../adr/0023-diataxis-documentation-architecture-and-zero-drift-governance.md)
for why.

| Quadrant | Answers | Start here |
| --- | --- | --- |
| [**Tutorials**](tutorials/) | "How do I get set up?" (learning-oriented) | [Local development & onboarding](tutorials/01-local-development-and-onboarding.md) |
| [**How-To Guides**](how-to/) | "How do I do X?" (goal-oriented) | [Add an API route & Zod contract](how-to/add-api-route-and-zod-contract.md) · [Configure Resend & webhooks](how-to/configure-resend-and-webhooks.md) · [Configure Clerk, Sentry, Upstash, Vercel Cron/Analytics & GitHub fetching](how-to/configure-integrations.md) · [Monitor Vercel headroom](how-to/monitor-vercel-headroom.md) · [Monitor GitHub Actions minutes](how-to/monitor-github-actions-minutes.md) · [Release and deploy](how-to/release-and-deploy.md) · [Restore the production database](how-to/restore-the-production-database.md) · [Manage dependency licenses](how-to/manage-dependency-licenses.md) |
| [**Reference**](reference/README.md) | "What's the exact contract or operational baseline?" (information-oriented) | [Reference index](reference/README.md) · [TypeDoc API reference](reference/api/README.md) · [`openapi.json`](../openapi.json) |
| [**Explanation**](explanation/) | "Why is it built this way?" (understanding-oriented) | [Explanation index](explanation/README.md) · [ADRs](../adr/) at the repository root |

## Keeping reference docs in sync

`docs/reference/api/` is compiled output, never hand-edited. After changing
a public export in `lib/`, `hooks/`, or `types/`:

```bash
npm run compile-docs      # recompiles docs/reference/api/ from source
npm run check-docs-drift  # zero-drift gate: fails on stale or uncommitted docs
```

Stage the regenerated files alongside your code change
(`git add docs/reference/api`) so the pre-commit `check-docs-drift` hook
runs against a clean tree. See
[how-to: add an API route and Zod contract](how-to/add-api-route-and-zod-contract.md)
for the full workflow including `openapi.json`.

## Other repository documentation

A few things live outside this four-quadrant structure by long-standing
repository convention (see [`AGENTS.md`](../AGENTS.md) at the repository
root, which governs how autonomous coding agents operate in this repo):

- [`adr/`](../adr/), Architecture Decision Records (the root source for
  the Explanation quadrant above).
- [`CONTEXT.md`](../CONTEXT.md), single-context domain overview.
- [`docs/agents/`](agents/), agent-tooling operating docs (issue tracker
  workflow, triage labels, domain-doc conventions) referenced directly by
  `AGENTS.md`.
- [`docs/CASE_STUDY.md`](CASE_STUDY.md), the Sortify air-gapped document
  classification case study deep dive.
- [`CASE_STUDY.md`](../CASE_STUDY.md), the cross-project engineering-note
  compendium used by the Mermaid corpus checks.
- [`PRODUCT_EXCELLENCE_EVALUATION.md`](../PRODUCT_EXCELLENCE_EVALUATION.md), a
  point-in-time opportunity catalog, not the live release-status source.
- `ARCHITECTURE.md`, `DEPLOYMENT.md`, `CONTRIBUTING.md`,
  `CMS_GUIDELINES.md`, and `DATABASE_MIGRATIONS.md` at the repository root.
