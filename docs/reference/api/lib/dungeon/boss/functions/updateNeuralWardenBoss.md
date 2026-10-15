[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dungeon/boss](../README.md) / updateNeuralWardenBoss

# Function: updateNeuralWardenBoss()

> **updateNeuralWardenBoss**(`boss`, `playerX`, `playerY`, `nowMs`, `gridWidth`, `gridHeight`, `playerHeading?`, `frameDeltaMs?`, `blocksShot?`): `object`

Updates the Neural Warden (#2178). It shares FaceForge's arena, projectile
rules and opening hold, but fights differently:

- Phase 1 fires lattice volleys down four lanes at once, alternating the +
  and the X; the lanes light up `NEURAL_WARDEN_TELEGRAPH_MS` before each
  volley, so stepping off them is a read, not luck.
- Phase 2 sweeps: a two-ended beam that turns 30 degrees every shot, so the
  safe spot keeps moving round the boss.
- Phase 3 aims its lattice at the lanes nearest the player, and follows
  every lattice with a fast shot at where the player is heading.

Same parameters and result as `updateFaceForgeBoss`.

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

### blocksShot?

(`col`, `row`) => `boolean`

## Returns

`object`

### spawnedDamage

> **spawnedDamage**: `number`

### updatedBoss

> **updatedBoss**: [`BossState`](../../types/interfaces/BossState.md)
