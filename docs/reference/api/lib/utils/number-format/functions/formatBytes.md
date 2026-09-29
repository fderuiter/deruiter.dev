[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/utils/number-format](../README.md) / formatBytes

# Function: formatBytes()

> **formatBytes**(`bytes`, `options?`): `string`

Formats a byte count with binary (1024-based) units, e.g.
`formatBytes(1536)` yields `"1.5 KB"` and
`formatBytes(2621440, { unit: "MB", decimals: 2, trimZeros: false })`
yields `"2.50 MB"`. Zero, negative and non-finite input yields `"0 B"`.

## Parameters

### bytes

`number` \| `null` \| `undefined`

The raw byte count.

### options?

[`FormatBytesOptions`](../interfaces/FormatBytesOptions.md) = `{}`

Decimal places, pinned unit, zero trimming and locale.

## Returns

`string`

The human-readable size.
