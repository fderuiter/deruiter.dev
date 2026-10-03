[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/game-utils](../README.md) / resolveGameFontFamily

# Function: resolveGameFontFamily()

> **resolveGameFontFamily**(): `string`

Reads the loaded Geist Mono family from the page's `--font-geist-mono`
variable. Canvas `font` strings cannot use `var()`, so canvas text needs the
resolved family name. Returns an empty string outside a document.

## Returns

`string`

The family list next/font registered, or an empty string.
