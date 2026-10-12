[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/for-better-or-bulk/internal/press](../README.md) / floorDropPress

# Function: floorDropPress()

> **floorDropPress**(`state`, `person`): `boolean`

Whether a press of the interact key would set the held item down on open
floor, the tile in front (see `pressTileFor`). Such a press does not act at
once: it starts a hold (ADR 0060 amendment). Pure.

## Parameters

### state

[`GameState`](../../../types/interfaces/GameState.md)

### person

`Pick`\<[`Player`](../../../types/interfaces/Player.md), `"x"` \| `"y"` \| `"facingX"` \| `"facingY"` \| `"holding"`\>

## Returns

`boolean`
