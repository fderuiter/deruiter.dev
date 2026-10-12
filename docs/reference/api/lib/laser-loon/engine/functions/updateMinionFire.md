[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/laser-loon/engine](../README.md) / updateMinionFire

# Function: updateMinionFire()

> **updateMinionFire**(`targets`, `dt`, `loonX`, `loonY`, `actNumber`, `nextId`, `rng?`): [`MinionFireResult`](../interfaces/MinionFireResult.md)

From Act 3 on, minions ahead of the loon shoot back: each on its own
timer, staggered by a random start, with a cap on shots in the air. Frozen
minions and the boss (which has its own volleys) do not fire here.

## Parameters

### targets

[`Target`](../../types/interfaces/Target.md)[]

All live targets.

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

### rng?

() => `number`

Random source, injectable for tests.

## Returns

[`MinionFireResult`](../interfaces/MinionFireResult.md)
