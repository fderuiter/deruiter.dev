# Explanation

Understanding-oriented material: why the codebase is shaped the way it is,
what was found during a retrospective audit, and what's being considered
for future work. Nothing here is required reading to get something done, 
for that, see the [tutorials](../tutorials/) and [how-to guides](../how-to/)
instead.

## Architectural Decision Records

The primary source of architectural explanation in this repository is the
set of Architecture Decision Records in [`adr/`](../../adr/README.md) at the
repository root (the [ADR index](../../adr/README.md) lists all of them), not duplicated here, to keep a single source of truth.
Each ADR records the context, the decision, and the consequences for a
specific architectural choice (for example,
[ADR 0023](../../adr/0023-diataxis-documentation-architecture-and-zero-drift-governance.md)
is the record behind this very documentation layout).

## Arcade playtest rubric

[The arcade playtest rubric](arcade-playtest-rubric.md) defines the ten points
every arcade playtest is scored on, for each of a game's desktop, tablet and
phone views.

## Audits

[`audits/`](audits/) contains point-in-time retrospective findings from
reviewing a specific subsystem or workflow, what was discovered, not a
live specification. Treat the codebase and its tests as ground truth over
an audit if the two disagree.

- [2026-09-09 agentic workflow and verification audit](audits/2026-09-09-agentic-workflow.md)
- [2026-09-09 Working With Duck audit](audits/2026-09-09-duck-game.md)
- [2026-09-12 GitHub to Vercel release workflow audit](audits/2026-09-12-github-vercel-release-governance.md)
- [2026-09-22 release, public repository, and Vercel readiness audit](audits/2026-09-22-release-public-vercel-readiness.md),
  the latest release-readiness audit. The current release process is
  [ADR 0063](../../adr/0063-weekly-release-train.md) and the
  [release and deploy guide](../how-to/release-and-deploy.md).
- [Product excellence evaluation](audits/product-excellence-evaluation.md),
  a point-in-time product opportunity catalog.

## Case studies

- [InBody QR decoder case study](inbody-qr-decoder-case-study.md), the InBody
  QR decoder and Sortify document classification deep dives.
- [Case study engineering notes](case-study-engineering-notes.md), the
  engineering notes behind several case studies.
- [Modularizing case studies data research (#3488)](research-3488-case-studies-modularization.md),
  the architectural research and scanner integration analysis for modularizing
  `lib/case-studies-data.ts`.

## Planning

[`planning/`](planning/) contains forward-looking design notes and
backlog proposals that haven't (or hadn't, at time of writing) landed as
accepted ADRs or shipped code. Treat these as working notes, not
commitments.

- [UI/UX improvement backlog](planning/ui-ux-backlog.md)
- [Design system tokens and editorial palette](planning/ui-ux-design-tokens.md)
- [UI/UX GitHub ticket proposal](planning/ui-ux-ticket-proposal.md)

## Developer Tooling & Infrastructure Research

- [Husky Hook Initialization Research](husky-hook-initialization-research.md), technical specifications and lifecycle detection research for Husky v9 hooks and setup automation (#3616).

