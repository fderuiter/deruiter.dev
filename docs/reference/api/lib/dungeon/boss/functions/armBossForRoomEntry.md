[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dungeon/boss](../README.md) / armBossForRoomEntry

# Function: armBossForRoomEntry()

> **armBossForRoomEntry**(`boss`, `nowMs`): [`BossState`](../../types/interfaces/BossState.md)

Readies a boss for a room that has just loaded: no salvo until
`BOSS_OPENING_GRACE_MS` after `nowMs`.

## Parameters

### boss

[`BossState`](../../types/interfaces/BossState.md)

The boss as generated for the room.

### nowMs

`number`

The current animation-frame clock (`performance.now()`).

## Returns

[`BossState`](../../types/interfaces/BossState.md)

The boss with its opening hold set.
