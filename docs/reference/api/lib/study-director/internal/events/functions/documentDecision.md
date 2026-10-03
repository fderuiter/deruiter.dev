[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/study-director/internal/events](../README.md) / documentDecision

# Function: documentDecision()

> **documentDecision**(`state`, `eventId`): [`ActionResult`](../../../types/type-aliases/ActionResult.md)

Writes up a decision after the fact (#1689): the latest undocumented
answer to an event is marked documented and the documentation debt it
added is repaid, in full the same day and by half on a later day, since
notes written from memory are thinner. The record keeps the day it was
decided. Refuses when there is nothing undocumented for the event.

## Parameters

### state

[`StudyState`](../../../types/interfaces/StudyState.md)

### eventId

`string`

## Returns

[`ActionResult`](../../../types/type-aliases/ActionResult.md)
