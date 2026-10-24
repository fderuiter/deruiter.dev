[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/tlf/stats](../README.md) / inferDecimalPlaces

# Function: inferDecimalPlaces()

> **inferDecimalPlaces**(`values`): `number`

The number of decimal places a value is recorded with, read from its
shortest round-trip decimal form: `141.1` has one, `146` none. The result
is capped at [MAX\_RAW\_DECIMALS](../variables/MAX_RAW_DECIMALS.md), so floating-point noise such as
`0.30000000000000004` cannot ask for seventeen decimals.

## Parameters

### values

readonly `number`[]

The recorded values. Non-finite values are ignored.

## Returns

`number`

The largest number of decimals among the values, 0 when empty.
