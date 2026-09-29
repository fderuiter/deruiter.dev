[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/study-director/internal/events](../README.md) / resolveEvent

# Function: resolveEvent()

> **resolveEvent**(`state`, `eventId`, `optionId`, `documented`): [`ActionResult`](../../../types/type-aliases/ActionResult.md)

Answers an inbox event with one of its options. `documented` spends extra
attention to record the decision, and is what saves you at inspection.

## Parameters

### state

[`StudyState`](../../../types/interfaces/StudyState.md)

### eventId

`string`

### optionId

`string`

### documented

`boolean`

## Returns

[`ActionResult`](../../../types/type-aliases/ActionResult.md)
