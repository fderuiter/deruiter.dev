[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/tlf/where](../README.md) / selectAdamRows

# Function: selectAdamRows()

> **selectAdamRows**(`datasets`, `datasetName`, `clause`): readonly `number`[]

The rows of one ADaM dataset that satisfy an ARS where clause, such as an
analysis set, a group or a data subset. A condition on ADSL is applied to
each record through the subject's ADSL row.

## Parameters

### datasets

readonly [`Dataset`](../../../../types/interfaces/Dataset.md)[]

Datasets of a run; ADSL must be among them.

### datasetName

`string`

The ADaM dataset to select from, for example `ADAE`.

### clause

[`ArsWhereClause`](../../../../types/type-aliases/ArsWhereClause.md)

The where clause.

## Returns

readonly `number`[]

Zero-based row indexes, in dataset order.

## Throws

RangeError when a dataset is missing, a condition names a dataset
  other than ADSL and `datasetName`, or a comparator has the wrong number
  of values.
