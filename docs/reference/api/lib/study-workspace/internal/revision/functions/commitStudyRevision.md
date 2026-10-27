[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/study-workspace/internal/revision](../README.md) / commitStudyRevision

# Function: commitStudyRevision()

> **commitStudyRevision**(`workspace`, `usdm`, `change`): [`StudyWorkspace`](../../../types/interfaces/StudyWorkspace.md)

Makes the next revision from an edited USDM document. The workspace
passed in is left as it was; the result is a new workspace whose parent
is that revision. `expectedRevisionId` guards against applying an edit
to a workspace that moved on in the meantime (another tab, a stale undo).

## Parameters

### workspace

[`StudyWorkspace`](../../../types/interfaces/StudyWorkspace.md)

### usdm

[`UsdmV4Document`](../../../../clinical-standards/usdm-v4-types/interfaces/UsdmV4Document.md)

### change

#### expectedRevisionId

`string`

#### note

`string`

## Returns

[`StudyWorkspace`](../../../types/interfaces/StudyWorkspace.md)

## Throws

StudyWorkspaceConflictError when `expectedRevisionId` is not the
  current revision.
