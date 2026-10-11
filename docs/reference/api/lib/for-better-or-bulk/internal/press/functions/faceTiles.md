[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/for-better-or-bulk/internal/press](../README.md) / faceTiles

# Function: faceTiles()

> **faceTiles**(`person`): [`Tile`](../../../types/interfaces/Tile.md)[]

The tiles a body can act on, the one in front of its nearest tile first.
A body is a circle of PLAYER_RADIUS, so when it straddles a boundary across
its facing, the tile in front of each tile it overlaps counts too (round 8,
ADR 0060). The list is never empty and its first entry is `frontTile`.

## Parameters

### person

`Pick`\<[`Player`](../../../types/interfaces/Player.md), `"x"` \| `"y"` \| `"facingX"` \| `"facingY"`\>

## Returns

[`Tile`](../../../types/interfaces/Tile.md)[]
