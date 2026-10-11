[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/for-better-or-bulk/internal/views](../README.md) / refusalFor

# Function: refusalFor()

> **refusalFor**(`state`, `person`): `string` \| `null`

The one line that says why an interact press does nothing for this person
(round 9, task 1), or null when the press lands. It reads the same rule as
the engine and the assist: `pressTileFor` decides whether a press lands, and
this names the faced tile when it does not. A press that lands always has no
refusal, and a refusal always means the press does nothing.

The reason is chosen from the first faced tile that holds something (a crate,
station, target or loose item), else from the tile in front. A plain tile
with free hands says nothing, since there is nothing to refuse.

## Parameters

### state

[`GameState`](../../../types/interfaces/GameState.md)

### person

[`Player`](../../../types/interfaces/Player.md)

## Returns

`string` \| `null`
