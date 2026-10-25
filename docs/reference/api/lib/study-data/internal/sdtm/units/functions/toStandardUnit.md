[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/sdtm/units](../README.md) / toStandardUnit

# Function: toStandardUnit()

> **toStandardUnit**(`testCode`, `value`, `unit`, `standardUnit`): `number` \| `null`

A collected result in the test's standard unit.

## Parameters

### testCode

`string`

The test short name.

### value

`number`

The collected numeric result.

### unit

`string` \| `null`

The collected unit.

### standardUnit

`string` \| `null`

The test's standard unit.

## Returns

`number` \| `null`

The result in the standard unit, rounded to two decimals when
converted, or null when the units differ and no conversion is defined.
