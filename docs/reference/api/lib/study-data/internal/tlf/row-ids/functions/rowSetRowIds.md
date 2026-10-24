[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/tlf/row-ids](../README.md) / rowSetRowIds

# Function: rowSetRowIds()

> **rowSetRowIds**(`event`, `rowSetId`): readonly `string`[]

Every row id of one row set: its own and those of the sets it includes,
each once, the set's own ids first. Because a set only includes sets
listed before it, nesting cannot loop. [resolveResultRows](resolveResultRows.md) gives
the same rows in dataset order.

## Parameters

### event

[`ArsReportingEvent`](../../../../types/interfaces/ArsReportingEvent.md)

The reporting event that holds the set.

### rowSetId

`string`

The set.

## Returns

readonly `string`[]

## Throws

RangeError when the event does not hold the set, or the set
  includes one that is missing, listed after it, or of another dataset.
