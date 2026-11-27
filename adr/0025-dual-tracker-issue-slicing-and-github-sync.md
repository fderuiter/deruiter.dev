# ADR 0025: Dual-Tracker Issue Slicing Pattern and GitHub CLI Synchronization

## Status

Accepted

## Context

When planning multi-ticket refactors or feature builds, autonomous agents perform best with self-contained, context-isolated tracer-bullet tickets in the local workspace (`.scratch/issues/`). However, engineering visibility, issue tracking, and PR linking benefit from native GitHub Issues with milestone tags and dependency references.

## Decision

We adopt the **Dual-Tracker Issue Slicing Pattern**:

1. **Local Tracer-Bullet Specification (`.scratch/issues/`)**:
   - Every ticket is authored as a standalone markdown file (`0001-<slug>.md`, `0002-<slug>.md`) declaring:
     - `Status`: `OPEN` | `IN_PROGRESS` | `DONE`
     - `Blocked By`: List of predecessor ticket IDs
     - `Context & Seam`: Target files and architecture boundaries
     - `Red-Green TDD Plan`: Explicit failing tests and implementation steps
     - `Verification Gates`: Quality invariant commands to run
2. **Automated GitHub Synchronization (planned — `scripts/sync-issues.ts` and `npm run dx issues:sync` do not exist yet)**:
   - Planned as a zero-dependency script utilizing GitHub CLI (`gh issue list`, `gh issue create`, `gh issue edit`) to create or synchronize local tickets into GitHub Issues. Until it lands, synchronization is performed manually with the `gh` CLI as described in [`docs/agents/issue-tracker.md`](../docs/agents/issue-tracker.md).
   - Would attach standardized triage labels (`area:email`, `area:docs`, `area:dx`, `type:feature`, `type:refactor`), milestone assignments, and dependency references (`Blocked by #X`).
3. **Execution Boundary**:
   - Agents work from local ticket files via `/implement`, clearing context between tickets, while commits and PRs reference both the ticket ID and GitHub issue number.

## Consequences

- **Positive**:
  - Provides optimal token hygiene and smart-zone protection for AI agents while keeping human team trackers 100% updated.
  - Zero manual copy-pasting between local specs and GitHub Issues.
- **Negative**:
  - Requires active GitHub CLI authentication (`gh auth status`) for remote sync.
