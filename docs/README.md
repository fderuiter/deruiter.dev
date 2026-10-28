# Documentation

This repository's documentation is organized around the
[Diátaxis](https://diataxis.fr) framework: four quadrants, each answering a
different kind of question, so a guide doesn't have to be several things at
once. See [ADR 0023](../adr/0023-diataxis-documentation-architecture-and-zero-drift-governance.md)
for why.

| Quadrant | Answers | Start here |
| --- | --- | --- |
| [**Tutorials**](tutorials/) | "How do I get set up?" (learning-oriented) | [Local development & onboarding](tutorials/01-local-development-and-onboarding.md) |
| [**How-To Guides**](how-to/) | "How do I do X?" (goal-oriented) | [Add an API route & Zod contract](how-to/add-api-route-and-zod-contract.md) · [Configure Resend & webhooks](how-to/configure-resend-and-webhooks.md) · [Configure Clerk, Sentry, Upstash, Vercel Cron/Analytics & GitHub fetching](how-to/configure-integrations.md) · [Monitor Vercel headroom](how-to/monitor-vercel-headroom.md) · [Monitor GitHub Actions minutes](how-to/monitor-github-actions-minutes.md) · [Release and deploy](how-to/release-and-deploy.md) · [Write a database migration](how-to/write-a-database-migration.md) · [Use a Preview deployment](how-to/use-a-preview-deployment.md) · [Back up the production database](how-to/back-up-the-production-database.md) · [Restore the production database](how-to/restore-the-production-database.md) · [Use least-privilege database roles](how-to/use-least-privilege-database-roles.md) · [Manage dependency licenses](how-to/manage-dependency-licenses.md) · [Type-check the project](how-to/type-check-the-project.md) · [Set up Claude cloud sessions](how-to/set-up-claude-cloud-sessions.md) · [Sync issues with GitHub](how-to/sync-issues-with-github.md) · [Run an arcade real-device check](how-to/run-an-arcade-real-device-check.md) · [Run the arcade phone device matrix](how-to/run-the-arcade-phone-device-matrix.md) · [Record arcade replay fixtures](how-to/record-arcade-replay-fixtures.md) · [Refresh the recorded CDISC CORE findings](how-to/refresh-cdisc-core-findings.md) · [Refresh the win-ratio reference values](how-to/refresh-win-ratio-reference-values.md) · [Watch and upgrade the clinical standards](how-to/watch-and-upgrade-clinical-standards.md) · [Build an arcade game for three views](how-to/build-an-arcade-game-for-three-views.md) · [Add a guided tutorial to an arcade game](how-to/add-a-guided-tutorial-to-an-arcade-game.md) |
| [**Reference**](reference/README.md) | "What's the exact contract or operational baseline?" (information-oriented) | [Reference index](reference/README.md) · [`openapi.json`](../openapi.json) · TypeDoc API reference (`npm run compile-docs`) |
| [**Explanation**](explanation/) | "Why is it built this way?" (understanding-oriented) | [Explanation index](explanation/README.md) · [ADR index](../adr/README.md) at the repository root |

## Keeping reference docs in sync

The TypeDoc reference for `lib/`, `hooks/` and `types/` is built, not
committed. `docs/reference/api/` is git-ignored:

```bash
npm run compile-docs      # writes docs/reference/api/ to browse locally
npm run check-docs-drift  # compiles it with warnings as errors, checks openapi.json
```

There is nothing generated to stage. See
[how-to: add an API route and Zod contract](how-to/add-api-route-and-zod-contract.md)
for the full workflow including `openapi.json`.

## Other repository documentation

A few things live outside this four-quadrant structure by long-standing
repository convention (see [`AGENTS.md`](../AGENTS.md) at the repository
root, which governs how autonomous coding agents operate in this repo):

- [`adr/`](../adr/README.md), Architecture Decision Records (the root source for
  the Explanation quadrant above).
- [`CONTEXT.md`](../CONTEXT.md), single-context domain overview.
- [`docs/agents/`](agents/), agent-tooling operating docs (issue tracker
  workflow, triage labels, domain-doc conventions) referenced directly by
  `AGENTS.md`.
- [InBody QR decoder case study](explanation/inbody-qr-decoder-case-study.md),
  the InBody QR decoder and Sortify air-gapped document classification deep
  dives.
- [Case study engineering notes](explanation/case-study-engineering-notes.md),
  the cross-project engineering-note compendium used by the Mermaid corpus
  checks.
- [Product excellence evaluation](explanation/audits/product-excellence-evaluation.md),
  a point-in-time opportunity catalog, not the live release-status source.
- [CMS guidelines](reference/cms-guidelines.md) and
  [write a database migration](how-to/write-a-database-migration.md).
- `ARCHITECTURE.md`, `DEPLOYMENT.md` and `CONTRIBUTING.md` at the repository
  root.
