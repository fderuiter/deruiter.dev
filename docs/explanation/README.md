# Explanation

Understanding-oriented material: why the codebase is shaped the way it is,
what was found during a retrospective audit, and what's being considered
for future work. Nothing here is required reading to get something done, 
for that, see the [tutorials](../tutorials/) and [how-to guides](../how-to/)
instead.

## Architectural Decision Records

The primary source of architectural explanation in this repository is the
set of Architecture Decision Records in [`adr/`](../../adr/) at the
repository root, not duplicated here, to keep a single source of truth.
Each ADR records the context, the decision, and the consequences for a
specific architectural choice (for example,
[ADR 0023](../../adr/0023-diataxis-documentation-architecture-and-zero-drift-governance.md)
is the record behind this very documentation layout).

## Audits

[`audits/`](audits/) contains point-in-time retrospective findings from
reviewing a specific subsystem or workflow, what was discovered, not a
live specification. Treat the codebase and its tests as ground truth over
an audit if the two disagree.

Current release evidence: [2026-09-22 release, public repository, and Vercel
readiness audit](audits/2026-09-22-release-public-vercel-readiness.md).

## Planning

[`planning/`](planning/) contains forward-looking design notes and
backlog proposals that haven't (or hadn't, at time of writing) landed as
accepted ADRs or shipped code. Treat these as working notes, not
commitments.
