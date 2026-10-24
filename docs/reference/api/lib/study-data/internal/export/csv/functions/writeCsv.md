[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/export/csv](../README.md) / writeCsv

# Function: writeCsv()

> **writeCsv**(`dataset`): `string`

Serialises one dataset as RFC 4180 CSV.

Numbers use ECMAScript's shortest round-trip form (no locale, no
thousands separators); dates stay ISO 8601 text; missing values are empty
fields. A dataset with no rows is its header row alone.

## Parameters

### dataset

[`Dataset`](../../../../types/interfaces/Dataset.md)

## Returns

`string`

## Throws

TypeError or RangeError when a value does not match its column.
