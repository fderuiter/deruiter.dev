[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/utils/number-format](../README.md) / FormatPercentOptions

# Interface: FormatPercentOptions

Options accepted by [formatPercent](../functions/formatPercent.md).

## Properties

### decimals?

> `optional` **decimals?**: `number`

Fixed decimal places. Defaults to `0`.

***

### locale?

> `optional` **locale?**: `string`

BCP 47 locale tag. Defaults to `"en-US"`.

***

### scale?

> `optional` **scale?**: `"fraction"` \| `"whole"`

Scale of the input: `"fraction"` (default) treats `0.5` as 50%, and
`"whole"` treats `50` as 50%.
