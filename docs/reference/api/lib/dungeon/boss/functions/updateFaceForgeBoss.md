[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dungeon/boss](../README.md) / updateFaceForgeBoss

# Function: updateFaceForgeBoss()

> **updateFaceForgeBoss**(`boss`, `playerX`, `playerY`, `nowMs`, `gridWidth`, `gridHeight`, `playerHeading?`, `frameDeltaMs?`): `object`

Updates boss animations, attack patterns, and projectile trajectories.

## Parameters

### boss

[`BossState`](../../types/interfaces/BossState.md)

### playerX

`number`

### playerY

`number`

### nowMs

`number`

### gridWidth

`number`

### gridHeight

`number`

### playerHeading?

#### dx

`number`

#### dy

`number`

### frameDeltaMs?

`number` = `BOSS_REFERENCE_FRAME_MS`

Real time since the previous update. Projectiles and
mesh spin advance in proportion to it, so volleys travel at the same speed
on a 60 Hz and a 144 Hz display (#1665). Defaults to one 60 Hz frame.

## Returns

`object`

### spawnedDamage

> **spawnedDamage**: `number`

### updatedBoss

> **updatedBoss**: [`BossState`](../../types/interfaces/BossState.md)
