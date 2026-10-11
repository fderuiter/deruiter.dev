[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/for-better-or-bulk/internal/press](../README.md) / faceTiles

# Function: faceTiles()

> **faceTiles**(`person`): [`Tile`](../../../types/interfaces/Tile.md)[]

The tiles a body can act on, the one in front of its nearest tile first.
A body is a circle of PLAYER_RADIUS, and it only counts as straddling a
boundary across its facing when its centre is within PLAYER_RADIUS / 2 of
that boundary (round 8, ADR 0060). A body that merely overlaps a neighbour
by a sliver faces only its own tile. The tile in front of a straddled
neighbour then counts too. The list is never empty and its first entry is
`frontTile`.

## Parameters

### person

`Pick`\<[`Player`](../../../types/interfaces/Player.md), `"x"` \| `"y"` \| `"facingX"` \| `"facingY"`\>

## Returns

[`Tile`](../../../types/interfaces/Tile.md)[]
