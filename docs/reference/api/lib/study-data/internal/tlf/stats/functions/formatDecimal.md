[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/tlf/stats](../README.md) / formatDecimal

# Function: formatDecimal()

> **formatDecimal**(`value`, `decimals`): `string`

Rounds half away from zero and prints exactly `decimals` decimals, with no
exponent and no negative zero.

`toFixed` rounds the binary value, so `(1.005).toFixed(2)` is `"1.00"`.
This rounds the shortest decimal form instead, the way the value reads:
`formatDecimal(1.005, 2)` is `"1.01"` and `formatDecimal(-2.5, 0)` is
`"-3"`. A value that rounds to zero prints without a sign.

## Parameters

### value

`number`

A finite number.

### decimals

`number`

Decimal places, an integer from 0 to 20.

## Returns

`string`

## Throws

RangeError when the value is not finite or `decimals` is out of range.
