[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/utils/number-format](../README.md) / formatPercent

# Function: formatPercent()

> **formatPercent**(`value`, `options?`): `string`

Formats a ratio as a percentage, e.g. `formatPercent(0.853, { decimals: 1 })`
yields `"85.3%"` and `formatPercent(42, { scale: "whole" })` yields `"42%"`.

## Parameters

### value

`number` \| `null` \| `undefined`

The ratio (fraction scale) or percentage (whole scale).

### options?

[`FormatPercentOptions`](../interfaces/FormatPercentOptions.md) = `{}`

Decimal places, input scale and locale.

## Returns

`string`

The formatted percentage, or an em dash for non-finite input.
