[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dungeon/metaprogression](../README.md) / recordCyberdeckRoomResult

# Function: recordCyberdeckRoomResult()

> **recordCyberdeckRoomResult**(`profile`, `result`): [`CyberdeckProfile`](../../types/interfaces/CyberdeckProfile.md)

Folds one room's result into the persistent Cyberdeck profile. Crypto and the
high score bank on every room, but `runsCompleted` counts runs, so it moves
only when the result ends one. It used to move on every room exit (#2048).

## Parameters

### profile

[`CyberdeckProfile`](../../types/interfaces/CyberdeckProfile.md)

The profile before the room ended.

### result

[`CyberdeckRoomResult`](../interfaces/CyberdeckRoomResult.md)

What the room earned, and whether the run is over.

## Returns

[`CyberdeckProfile`](../../types/interfaces/CyberdeckProfile.md)

The updated profile; the input is not changed.
