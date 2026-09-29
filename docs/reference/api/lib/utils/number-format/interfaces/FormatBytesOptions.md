[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/utils/number-format](../README.md) / FormatBytesOptions

# Interface: FormatBytesOptions

Options accepted by [formatBytes](../functions/formatBytes.md).

## Properties

### decimals?

> `optional` **decimals?**: `number`

Maximum decimal places. Defaults to `1`.

***

### locale?

> `optional` **locale?**: `string`

BCP 47 locale tag. Defaults to `"en-US"`.

***

### trimZeros?

> `optional` **trimZeros?**: `boolean`

Drop trailing zeros (`"2 KB"` rather than `"2.0 KB"`). Defaults to `true`.

***

### unit?

> `optional` **unit?**: [`ByteUnit`](../type-aliases/ByteUnit.md)

Pin the output to one unit instead of choosing the largest that fits.
