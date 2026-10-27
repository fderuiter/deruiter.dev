[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/study-workspace/internal/revision](../README.md) / openStudyWorkspace

# Function: openStudyWorkspace()

> **openStudyWorkspace**(`text`): [`OpenStudyWorkspaceResult`](../../../types/type-aliases/OpenStudyWorkspaceResult.md)

Opens a saved workspace file. It checks the shape and version, and that
the working document still matches its revision's hash, so a file edited
by hand outside the studio is reported rather than trusted.

## Parameters

### text

`string`

## Returns

[`OpenStudyWorkspaceResult`](../../../types/type-aliases/OpenStudyWorkspaceResult.md)
