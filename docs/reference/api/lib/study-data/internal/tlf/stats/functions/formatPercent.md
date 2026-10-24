[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/tlf/stats](../README.md) / formatPercent

# Function: formatPercent()

> **formatPercent**(`count`, `denominator`): `string` \| `null`

The percentage `count / denominator`, to one decimal, rounded half away
from zero. The percentage is one division of the two integers, so
`formatPercent(1, 8)` is exactly `"12.5"` and `formatPercent(1, 80)` is
`"1.3"`.

## Parameters

### count

`number`

### denominator

`number`

## Returns

`string` \| `null`

The percentage, or `null` when the denominator is zero.

## Throws

RangeError when either argument is not a non-negative integer.
