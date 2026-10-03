[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/study-director-world/internal/save](../README.md) / parseWorld

# Function: parseWorld()

> **parseWorld**(`text`): [`WorldState`](../../../types/interfaces/WorldState.md) \| `null`

Reads a saved world run. Anything unreadable, from another version, or
missing its study is dropped (returns null) rather than trusted; numbers
are clamped to their ranges, and a position that is not a free tile on the
floor (or a save from before the floor existed) starts at the lobby.

## Parameters

### text

`string` \| `null`

## Returns

[`WorldState`](../../../types/interfaces/WorldState.md) \| `null`
