[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/tlf/row-ids](../README.md) / adamRowId

# Function: adamRowId()

> **adamRowId**(`dataset`, `rowIndex`): `string`

The stable id of one ADaM row.

## Parameters

### dataset

[`Dataset`](../../../../types/interfaces/Dataset.md)

An analysis dataset whose `keys` identify its rows.

### rowIndex

`number`

Zero-based row index.

## Returns

`string`

For example `ADVS:DEMO-301-0001:5`.

## Throws

RangeError when the row is out of range, the dataset has no key
  variables besides `STUDYID`, or a key value is missing.
