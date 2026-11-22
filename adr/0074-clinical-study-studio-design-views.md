# 0074. Clinical Study Studio Design Views

Date: 2026-11-22

## Status

Accepted on 2026-11-22 under
[#3397](https://github.com/fderuiter/deruiter.dev/issues/3397), recording the
decisions the owner approved on
[#3073](https://github.com/fderuiter/deruiter.dev/issues/3073) on 2026-11-10
and the naming decision recorded on #3397 on 2026-11-15. Part of roadmap
[#3071](https://github.com/fderuiter/deruiter.dev/issues/3071) and step
[#3072](https://github.com/fderuiter/deruiter.dev/issues/3072). Builds on
[ADR 0065](0065-study-data-pipeline-architecture.md) (synthetic-only clinical
data, deep modules) and sits beside
[ADR 0073](0073-clinical-study-studio-randomization-architecture.md), which
owns the Randomization work area. #3397 asked for number 0073 if it was still
free; ADR 0073 took it on 2026-11-19, so this record is 0074.

## Context

The roadmap started as a separate "Protocol Studio": its own module, its own
copy of the study and a blank-shell wireframe. By the time the design screen
was ready to start, three things had changed:

- `lib/study-workspace` (#3107) already holds an imported USDM v4 study, the
  study version and design chosen for work, an immutable revision history and
  the content it keeps but does not edit.
- CRF Studio, the study-data pipeline and the randomization work area all read
  that workspace. A second module holding its own copy of the study would give
  each design fact two owners.
- #3398 delivered the USDM v4 classes the design screens need
  (`UsdmV4StudyArm`, `UsdmV4StudyEpoch`, `UsdmV4StudyCell`,
  `UsdmV4StudyElement`, `UsdmV4StudyIntervention`, `UsdmV4Masking`) and
  `validateUsdmV4Document`, all in `lib/clinical-standards` (#3663). It
  did not add cell, element or arm operations to `lib/study-workspace`; those
  are still to be written (#3399).

## Decision

### 1. One feature name and one domain module

The feature is **Clinical Study Studio**. Its domain module is
`lib/study-workspace`. The design, schedule, narrative and analysis-intent
screens are views of that one workspace. There is no `lib/protocol-studio`, no
`ProtocolWorkspace` type and no second copy of imported USDM. Issue titles that
still say "protocol-studio" refer to this feature.

### 2. An imported study comes first

A session starts from an imported structured study. The person picks the study
version and design explicitly: import never chooses for them (it returns
`needs-selection` instead). The original document and everything the workspace
keeps but does not edit (other versions and designs, extension attributes) are
written back unchanged on export.

A blank skeleton is allowed only as a valid USDM v4 document holding the
minimum content the schema requires, with that content shown to the person.
The blank envelope belongs to #3399.

### 3. One versioned workspace, edited only through the facade

Editable design, schedule, narrative and analysis intent live in one versioned
workspace. Every edit:

- goes through a public entry point in `lib/study-workspace/index.ts`;
- produces a new immutable revision (`R1` for the import, then `R2`, `R3`)
  whose SHA-256 is computed from canonical JSON, so the same edits give the
  same bytes;
- is reversible, so undo and redo restore the exact document (#3399);
- names the revision it was made against, and fails with
  `StudyWorkspaceConflictError` when the workspace has moved on.

`STUDY_WORKSPACE_VERSION` changes when the workspace file shape changes.
Internal files stay private under `lib/study-workspace/internal/`.

### 4. Views are projections with stable source IDs

A view reads the working USDM document and returns a projection keyed by the
USDM `id` of each arm, epoch, cell, element and intervention. Lineage, findings
and edits refer to those IDs, never to a row index or display label.

When the study leaves something out, the view reports a finding instead of
inventing a value. For the design view, every arm and epoch pair has either a
cell or a visible finding (#3073, #3401).

### 5. Accessible equivalents and cited codelists

Drag-to-reuse of an element between cells has a keyboard equivalent, a "move
to cell" action (#3073). Masking, randomisation ratio, intent, and intervention
role and type use cited CDISC codelists, to be added to
`lib/clinical-standards/codelists.ts`; their values are never invented
(#3406).

### 6. Ownership around the workspace

- **Routes and layout** are presentation. #3400 owns the route shell and its
  discovery entries, under the Clinical Study Studio name. The
  `/protocol-studio` path in #3400's original steps comes from the retired
  name. The domain module creates no route.
- **Analysis intent.** #3423 owns the versioned win-ratio `AnalysisSpec` and
  its evidence identity. The design views add no competing analysis type.
- **Randomization.** ADR 0073 owns `lib/randomization` and the revision-bound
  randomization plans that the workspace stores.
- **Data.** Only client-side synthetic and reference studies are in scope:
  `TAVR_DEVICE_USDM`, `TAVR_SAVR_USDM` and DEMO-301. There are no production
  clinical systems, no model calls and no compliance claims.

## Invariant Compliance

- **AGENTS.md section 21**: consumers import `lib/study-workspace` through
  `index.ts` only, and `internal/` stays private. `npm run lint:boundaries`
  enforces this.
- **AGENTS.md section 9**: the public types are documented in
  `lib/study-workspace/README.md` and the TypeDoc reference.
  `npm run check-docs-drift` keeps them in step.
- **AGENTS.md sections 10 and 13** apply to the views when #3401 and #3406
  build them.
- **Verification**: `npm run typecheck`, `npm run lint:boundaries`,
  `npm run check-docs-drift`, `npm run quality`.

## Consequences

### Positive

- Each fact about a study has one owner, so CRF Studio, the study-data
  pipeline, randomization and the design views can't drift apart.
- #3399 and #3400 start from a written contract instead of a superseded
  wireframe and module name.
- Deterministic revisions and stable source IDs make edits, exports and lineage
  reproducible and testable.

### Negative / Trade-offs

- `lib/study-workspace` grows to own operations for several views. Its
  `internal/` folder has to stay organised by view to stay readable.
- Issues and plans written under the old "Protocol Studio" name stay open with
  that name in their titles until they close.
