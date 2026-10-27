[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/crf/internal/test-scenarios](../README.md) / runScenariosForForm

# Function: runScenariosForForm()

> **runScenariosForForm**(`study`, `formId`, `now?`): `object`

Runs every scenario targeting one form and returns the updated study plus a
per-scenario summary, so an author can re-check a form after an amendment in
one action.

## Parameters

### study

[`StudyProtocol`](../../../types/interfaces/StudyProtocol.md)

### formId

`string`

### now?

`Date`

## Returns

`object`

### study

> **study**: [`StudyProtocol`](../../../types/interfaces/StudyProtocol.md)

### summaries

> **summaries**: `object`[]
