[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/laser-loon/engine](../README.md) / updateBossAttack

# Function: updateBossAttack()

> **updateBossAttack**(`targets`, `dt`, `loonX`, `loonY`, `actNumber`, `nextId`): [`BossAttackResult`](../interfaces/BossAttackResult.md)

Advances the live boss's attack timer and fires a volley aimed at the loon
when it runs out. Later acts and phase 2 (at or below half HP) fire more
often and add shots; phase 2 also speeds up the boss's flight. A frozen
boss neither winds up nor fires.

## Parameters

### targets

[`Target`](../../types/interfaces/Target.md)[]

All live targets, including the boss.

### dt

`number`

Frame delta, in 60 fps frames.

### loonX

`number`

The loon's x position.

### loonY

`number`

The loon's y position.

### actNumber

`number`

The act being played.

### nextId

`number`

The next free target id.

## Returns

[`BossAttackResult`](../interfaces/BossAttackResult.md)
