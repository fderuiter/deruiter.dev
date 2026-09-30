[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/utils/number-format](../README.md) / formatNumber

# Function: formatNumber()

> **formatNumber**(`value`, `options?`, `locale?`): `string`

Formats a number with `Intl.NumberFormat`, pinned to `"en-US"` by default.

Passing a number as `options` is shorthand for a fixed number of decimal
places without digit grouping, the drop-in replacement for
`value.toFixed(decimals)`. It rounds on the decimal representation, so
`formatNumber(1.005, 2)` yields `"1.01"` where `toFixed` yields `"1.00"`,
and a negative value that rounds to zero renders without a minus sign.
Passing an options object uses `Intl.NumberFormat` defaults, including
digit grouping (`formatNumber(12345)` yields `"12,345"`).

## Parameters

### value

`number` \| `null` \| `undefined`

The number to format.

### options?

`number` \| `NumberFormatOptions`

Fixed decimal places, or `Intl.NumberFormat` options.

### locale?

`string` = `DEFAULT_NUMBER_LOCALE`

BCP 47 locale tag. Defaults to `"en-US"`.

## Returns

`string`

The formatted string, or an em dash for non-finite input.
