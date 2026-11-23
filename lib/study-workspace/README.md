# Study workspace

`lib/study-workspace` is the domain module of Clinical Study Studio
([ADR 0074](../../adr/0074-clinical-study-studio-design-views.md)). It holds
one USDM v4 study open for work: the original document, the study version and
design chosen for work, an immutable revision history and the content it keeps
but does not edit. CRF Studio, the study-data pipeline, the randomization work
area ([ADR 0073](../../adr/0073-clinical-study-studio-randomization-architecture.md))
and the design views all read this one workspace, so each fact about a study
has one owner.

Import it only through `@/lib/study-workspace` (`index.ts`). Files under
`internal/` are private (AGENTS.md section 21). The module depends on
`lib/clinical-standards` only.

## Public entry points

| Export                                                                                      | What it does                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `importUsdmStudy(input, options)`                                                           | Imports USDM v4 JSON (`{ text }` or `{ document }`). Returns `ok` with a workspace and an import report, `needs-selection` with the study versions and designs to choose from, or `rejected` with the problems. Schema issues are reported and do not stop the import.                                                        |
| `commitStudyRevision(workspace, usdm, change)`                                              | Makes the next revision from an edited document. `change.expectedRevisionId` must be the current revision, or it throws `StudyWorkspaceConflictError`. The workspace passed in is left as it was.                                                                                                                             |
| `exportStudyUsdm(workspace)`                                                                | Returns the working USDM document for export or a hand-off.                                                                                                                                                                                                                                                                   |
| `serializeStudyWorkspace(workspace)`                                                        | Writes the workspace file as JSON text.                                                                                                                                                                                                                                                                                       |
| `openStudyWorkspace(text)`                                                                  | Opens a saved workspace file. Checks its shape and version, and that the working document still matches its revision hash. Returns `ok` or `invalid` with the problem.                                                                                                                                                        |
| `StudyWorkspaceConflictError`                                                               | Thrown when an edit names a revision that is no longer current.                                                                                                                                                                                                                                                               |
| `createBlankStudyWorkspace(options)`                                                        | Starts a workspace from a blank USDM v4 study holding only what the schema requires. Every value filled in only for the schema, such as the Intervention Model term C82639 Parallel Study, is listed in `placeholders` for the studio to show.                                                                                |
| `createStudyEdit(workspace, patch, note)`                                                   | Makes a reversible edit from an RFC 6902 JSON Patch and works out the patch that undoes it. Throws `StudyPatchError` when a path does not exist.                                                                                                                                                                              |
| `applyStudyEdit`, `undoStudyEdit`, `redoStudyEdit`                                          | Commit an edit, its inverse or the edit again as the next revision, and return the updated undo and redo stacks. Undo and redo add revisions; they never remove one.                                                                                                                                                          |
| `applyStudyPatch(usdm, patch)`, `emptyStudyEditHistory()`                                   | Apply a patch to a copy of a document, all or nothing; start an empty history.                                                                                                                                                                                                                                                |
| `exportValidatedStudyUsdm(workspace)`                                                       | Checks the working study against the USDM v4.0.0 schema and returns canonical JSON with the revision hash, or the schema issues.                                                                                                                                                                                              |
| `projectStudyDesignGrid(workspace)`                                                         | Projects the selected design as an arms-by-epochs grid keyed by USDM ids. Epochs follow their `previousId`/`nextId` chain. Every arm and epoch pair has a cell or a finding (`missing-cell`, `duplicate-cell`, `orphan-cell`, `unknown-element`, `epoch-order`).                                                              |
| `addStudyArm`, `renameStudyArm`, `moveStudyArm`, `removeStudyArm`                           | Arm edits, returned as a `StudyEdit` for `applyStudyEdit`. A new arm takes a type from `STUDY_ARM_TYPES` and the data origin `DATA_GENERATED_WITHIN_STUDY`, which the grid shows on the arm. Removing an arm removes its cells and the elements only they used.                                                               |
| `addStudyEpoch`, `renameStudyEpoch`, `moveStudyEpoch`, `removeStudyEpoch`                   | Epoch edits. A new epoch takes a type from `STUDY_EPOCH_TYPES`. Adding, moving or removing an epoch rewrites the epochs in study order with their `previousId` and `nextId` links.                                                                                                                                            |
| `addStudyElement`, `renameStudyElement`, `moveStudyElement`, `removeStudyElement`           | Element edits in a cell. Adding or moving to an arm and epoch with no cell creates the cell. `moveStudyElement` is the keyboard equivalent of dragging an element to another cell.                                                                                                                                            |
| `StudyDesignError`                                                                          | Thrown when a design edit names an unknown id, an empty name or an uncited term, or would remove something another part of the study still names.                                                                                                                                                                             |
| `createStudyPayloadEdit`, `applyStudyPayloadPatch`                                          | Like `createStudyEdit` and `applyStudyPatch`, with paths rooted at the working payload `{ usdm, analyses, randomizationPlans }`. The edit carries `scope: "payload"` and goes through the same undo and redo.                                                                                                                 |
| `addStudyRandomizationPlan`, `updateStudyRandomizationPlan`, `removeStudyRandomizationPlan` | Randomization plan edits (#4003), returned as a `StudyEdit`. A plan is bound to the selected study version and design, names arms by USDM id, and keeps the engine mechanics as written. Its state is `draft`, `exploration` or `acknowledged-reference`; none of them means approval.                                        |
| `resolveStudyRandomizationPlan(workspace, planId)`                                          | Builds the engine request against the current revision, with arm labels from the design, and checks it with `validateRandomizationPlan`. Returns `ready` with the request, its digest and an inputs digest, or `draft` with findings (`different-design`, `unknown-arm`, `unmapped-arm`, `duplicate-arm`, `invalid-request`). |
| `bindStudyRandomizationEvidence`, `checkStudyRandomizationEvidence`                         | Record what an artifact was made from (source, design, revision, USDM and payload hashes, plan and inputs digests, engine versions), kept with the artifact outside the payload. The check returns `current`, `provenance-changed` when only the revision moved on, or `stale` with its reasons.                              |
| `TAVR_DEVICE_USDM`, `TAVR_SAVR_USDM`                                                        | The two synthetic device reference studies: single-arm TAVR, and randomised TAVR versus SAVR analysed by win ratio.                                                                                                                                                                                                           |

The public types are in `types.ts`: `StudyWorkspace` and its parts
(`StudyWorkspaceSource`, `StudyWorkspaceSelection`, `StudyWorkspaceRevision`,
`StudyWorkspaceLocks`, `PreservedItem`), the import results
(`StudyImportResult`, `StudyImportReport`, `StudyImportProblem`,
`StudyVersionChoice`, `StudyContentCounts`), the open results
(`OpenStudyWorkspaceResult`, `StudyWorkspaceFileProblem`), the blank start
(`BlankStudyWorkspace`, `BlankStudyPlaceholder`), edits (`StudyPatchOperation`,
`StudyEdit`, `StudyEditHistory`), `ValidatedStudyExport` and the design grid
(`StudyDesignGrid`, `StudyDesignGridRow`, `StudyDesignGridCell`, `StudyDesignArm`,
`StudyDesignEpoch`, `StudyDesignElement`, `StudyDesignTerm`, `StudyDesignCellRef`,
`StudyDesignFinding`, `StudyDesignFindingKind`).

## Versioning

- `STUDY_WORKSPACE_VERSION` is the version of the workspace file shape. Change
  it when the fields change. `openStudyWorkspace` refuses versions it does not
  know. Version 2 adds `analyses` (kept exactly as written for #3423),
  `randomizationPlans` and the revision's `payloadSha256`. A version 1 file
  opens as version 2 with empty collections.
- Revisions are immutable. The import is `R1`, and each commit makes the next
  number with its parent's id, the author's note and the SHA-256 of the working
  document's canonical JSON. `payloadSha256` hashes the USDM document,
  analyses and plans together, so a plan edit changes only that hash. The
  same edits give the same bytes.
- An edit records the revision it was made on (`madeOn`), and
  `applyStudyEdit` refuses it on any other revision.
- `locks` record the USDM version and CDISC CT package date the study was
  checked against.

## Preserved source

`source.original` is the imported document exactly as parsed, with its SHA-256,
file name and producing system. It is never edited. Content the workspace
keeps but does not edit is listed in `preserved` with a dotted path and a
reason: `other-study-version`, `other-study-design` or `extension-attributes`.
It is written back unchanged on export. Import never chooses a study version or
design on the person's behalf.

## Views

The design, schedule, narrative and analysis-intent screens are views of this
workspace, never separate modules. A view projects the working document by the
USDM `id` of each object, and reports a finding where the study leaves
something out instead of inventing a value. Views edit the study only through
`createStudyEdit` and `applyStudyEdit`, so every change can be undone. The
arms-by-epochs grid (`components/study-workspace/StudyDesignGrid.tsx`) and the
trial schema figure drawn from it (`TrialSchemaFigure.tsx`) are on
`/study-studio`. Still to come: the design view's interventions list (#3406).

Each view adds its public projection types to `types.ts` together with the code
that produces them. Routes and layout live outside this module (#3400).

Only synthetic and reference studies are in scope.
