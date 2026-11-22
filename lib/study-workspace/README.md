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

| Export                                         | What it does                                                                                                                                                                                                                                                           |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `importUsdmStudy(input, options)`              | Imports USDM v4 JSON (`{ text }` or `{ document }`). Returns `ok` with a workspace and an import report, `needs-selection` with the study versions and designs to choose from, or `rejected` with the problems. Schema issues are reported and do not stop the import. |
| `commitStudyRevision(workspace, usdm, change)` | Makes the next revision from an edited document. `change.expectedRevisionId` must be the current revision, or it throws `StudyWorkspaceConflictError`. The workspace passed in is left as it was.                                                                      |
| `exportStudyUsdm(workspace)`                   | Returns the working USDM document for export or a hand-off.                                                                                                                                                                                                            |
| `serializeStudyWorkspace(workspace)`           | Writes the workspace file as JSON text.                                                                                                                                                                                                                                |
| `openStudyWorkspace(text)`                     | Opens a saved workspace file. Checks its shape and version, and that the working document still matches its revision hash. Returns `ok` or `invalid` with the problem.                                                                                                 |
| `StudyWorkspaceConflictError`                  | Thrown when an edit names a revision that is no longer current.                                                                                                                                                                                                        |
| `TAVR_DEVICE_USDM`, `TAVR_SAVR_USDM`           | The two synthetic device reference studies: single-arm TAVR, and randomised TAVR versus SAVR analysed by win ratio.                                                                                                                                                    |

The public types are in `types.ts`: `StudyWorkspace` and its parts
(`StudyWorkspaceSource`, `StudyWorkspaceSelection`, `StudyWorkspaceRevision`,
`StudyWorkspaceLocks`, `PreservedItem`), the import results
(`StudyImportResult`, `StudyImportReport`, `StudyImportProblem`,
`StudyVersionChoice`, `StudyContentCounts`), and the open results
(`OpenStudyWorkspaceResult`, `StudyWorkspaceFileProblem`).

## Versioning

- `STUDY_WORKSPACE_VERSION` is the version of the workspace file shape. Change
  it when the fields change. `openStudyWorkspace` refuses versions it does not
  know.
- Revisions are immutable. The import is `R1`, and each commit makes the next
  number with its parent's id, the author's note and the SHA-256 of the working
  document's canonical JSON. The same edits give the same bytes.
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
something out instead of inventing a value. These are still to come:

- the blank workspace envelope, reversible operations with undo and redo, and
  validating export (#3399);
- the design view's arms-by-epochs grid (#3401), and its interventions list and
  trial schema figure (#3406).

Each view adds its public projection types to `types.ts` together with the code
that produces them. Routes and layout live outside this module (#3400).

Only synthetic and reference studies are in scope.
