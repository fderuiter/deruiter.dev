[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/laser-loon/engine](../README.md) / isBossTelegraphing

# Function: isBossTelegraphing()

> **isBossTelegraphing**(`boss`, `actNumber`): `boolean`

True while a boss is winding up its next volley, so the game can warn the
player before the shots leave.

## Parameters

### boss

`Pick`\<[`Target`](../../types/interfaces/Target.md), `"isBoss"` \| `"bossPhase"` \| `"specialAttackTimer"`\>

The boss target.

### actNumber

`number`

The act being played.

## Returns

`boolean`
