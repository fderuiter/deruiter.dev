[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/game-utils](../README.md) / buildGameFont

# Function: buildGameFont()

> **buildGameFont**(`size`, `weight?`, `family?`): `string`

Builds a canvas `font` shorthand from a size, weight and family list.
Pure, so the string format is testable without a DOM.

## Parameters

### size

`number`

Font size in CSS pixels; non-finite or non-positive sizes become 10.

### weight?

[`GameFontWeight`](../type-aliases/GameFontWeight.md) = `400`

Numeric weight (clamped to 100 to 900) or a keyword.

### family?

`string` = `""`

Leading family list, such as the resolved Geist Mono family. Empty means the fallback stack alone.

## Returns

`string`

A string such as `700 12px "Geist Mono", ui-monospace, monospace`.
