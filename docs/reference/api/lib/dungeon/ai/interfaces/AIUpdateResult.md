[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dungeon/ai](../README.md) / AIUpdateResult

# Interface: AIUpdateResult

## Properties

### contactedPlayer

> **contactedPlayer**: `boolean`

True when an enemy touched the player this step. Contact costs HP only;
the run ends when HP reaches 0, not on contact itself (#1665).

***

### damageToPlayer

> **damageToPlayer**: `number`

HP the player loses this step, 25 for each enemy that touched them.

***

### updatedEnemies

> **updatedEnemies**: [`Enemy`](../../types/interfaces/Enemy.md)[]
