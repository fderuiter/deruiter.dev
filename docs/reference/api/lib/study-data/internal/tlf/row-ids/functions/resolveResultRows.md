[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/tlf/row-ids](../README.md) / resolveResultRows

# Function: resolveResultRows()

> **resolveResultRows**(`event`, `rows`, `result`): readonly [`ResultRow`](../../../../types/interfaces/ResultRow.md)[]

The ADaM rows one result was computed from, with the role each plays.
Each row set's rows come back once each, in dataset order.

## Parameters

### event

[`ArsReportingEvent`](../../../../types/interfaces/ArsReportingEvent.md)

The reporting event the result belongs to.

### rows

`ReadonlyMap`\<`string`, [`AdamRowLocation`](../../../../types/interfaces/AdamRowLocation.md)\>

The run's ADaM rows, from [indexAdamRows](indexAdamRows.md).

### result

[`ArsOperationResult`](../../../../types/interfaces/ArsOperationResult.md)

The result.

## Returns

readonly [`ResultRow`](../../../../types/interfaces/ResultRow.md)[]

## Throws

RangeError when the result names a row set the event does not
  hold, a row set includes another wrongly (see [rowSetRowIds](rowSetRowIds.md)), or
  a row id is not a row of the set's dataset in this run.
