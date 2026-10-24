[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/tlf/km-evaluate](../README.md) / atRiskReference

# Function: atRiskReference()

> **atRiskReference**(`registry`, `data`, `records`, `timeVariable`): [`ArsRowReference`](../../../../types/interfaces/ArsRowReference.md) \| `null`

The analysis rows of a number-at-risk count: the Kaplan-Meier risk set
of its records, so the count and the Kaplan-Meier results at the same
time share one row set (#2729). When a record has no valid time or
censoring flag it cannot be placed in a risk set, and the rows are
listed instead.

## Parameters

### registry

[`RowSetRegistry`](../../row-sets/classes/RowSetRegistry.md)

### data

[`Dataset`](../../../../types/interfaces/Dataset.md)

### records

readonly [`RecordContext`](../../where/interfaces/RecordContext.md)[]

### timeVariable

`string`

The time variable of `data`, such as AVAL.

## Returns

[`ArsRowReference`](../../../../types/interfaces/ArsRowReference.md) \| `null`

`null` when there are no records.
