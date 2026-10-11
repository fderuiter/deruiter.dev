[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/for-better-or-bulk/internal/views](../README.md) / CoachStep

# Interface: CoachStep

One coach line, and the tile it points at when it points at one. A wait
step (`waiting`) points at a station that is still busy, so the outline is
drawn dashed.

## Properties

### text

> `readonly` **text**: `string`

***

### tile

> `readonly` **tile**: [`Tile`](../../../types/interfaces/Tile.md) \| `null`

***

### waiting?

> `readonly` `optional` **waiting?**: `boolean`
