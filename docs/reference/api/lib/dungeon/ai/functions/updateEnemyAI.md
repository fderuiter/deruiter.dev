[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dungeon/ai](../README.md) / updateEnemyAI

# Function: updateEnemyAI()

> **updateEnemyAI**(`enemies`, `grid`, `playerX`, `playerY`, `deltaMs`): [`AIUpdateResult`](../interfaces/AIUpdateResult.md)

Updates AI states (patrol, chase, stunned, confused, frozen) and positions for all active enemies.

An enemy never moves onto the player. One that would instead touches them:
the player loses `ENEMY_CONTACT_DAMAGE` HP, and the enemy stays where it is
and holds still for `ENEMY_CONTACT_RECOIL_MS`.

## Parameters

### enemies

[`Enemy`](../../types/interfaces/Enemy.md)[]

### grid

`string`[][]

### playerX

`number`

### playerY

`number`

### deltaMs

`number`

Real time since the previous call, which counts down the
stun, freeze and confusion timers.

## Returns

[`AIUpdateResult`](../interfaces/AIUpdateResult.md)
