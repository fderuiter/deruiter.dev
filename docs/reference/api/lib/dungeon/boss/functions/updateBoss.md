[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dungeon/boss](../README.md) / updateBoss

# Function: updateBoss()

> **updateBoss**(...`args`): `object`

Updates whichever boss a room holds: the Neural Warden by its own rules,
every other boss by FaceForge's (#2178).

Same parameters and result as `updateFaceForgeBoss`.

## Parameters

### args

...\[`boss`: [`BossState`](../../types/interfaces/BossState.md), `playerX`: `number`, `playerY`: `number`, `nowMs`: `number`, `gridWidth`: `number`, `gridHeight`: `number`, `playerHeading?`: `object`, `frameDeltaMs`: `number`, `blocksShot?`: (`col`, `row`) => `boolean`\]

## Returns

`object`

### spawnedDamage

> **spawnedDamage**: `number`

### updatedBoss

> **updatedBoss**: [`BossState`](../../types/interfaces/BossState.md)
