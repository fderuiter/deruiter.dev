[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/game-utils](../README.md) / gameFont

# Function: gameFont()

> **gameFont**(`size`, `weight?`): `string`

Canvas font for game text in the site's Geist Mono, so canvas and DOM text
match. Use it wherever a canvas game would otherwise write
`ctx.font = "bold 10px monospace"`.

## Parameters

### size

`number`

Font size in CSS pixels.

### weight?

[`GameFontWeight`](../type-aliases/GameFontWeight.md) = `400`

Numeric weight or `normal` / `bold`. Defaults to 400.

## Returns

`string`

A canvas `font` shorthand led by the loaded Geist Mono family.

## Example

```ts
ctx.font = gameFont(10, 700);
```
