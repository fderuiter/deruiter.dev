[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dungeon/types](../README.md) / BossState

# Interface: BossState

## Properties

### attackIntervalMs

> **attackIntervalMs**: `number`

***

### defeated

> **defeated**: `boolean`

***

### holdFireUntilMs?

> `optional` **holdFireUntilMs?**: `number`

No salvo is fired before this time, so a room never opens mid-volley.

***

### hp

> **hp**: `number`

***

### lastSalvoTime

> **lastSalvoTime**: `number`

***

### maxHp

> **maxHp**: `number`

***

### mesh

> **mesh**: [`WireframeMesh`](WireframeMesh.md)

***

### name

> **name**: `string`

***

### phase

> **phase**: `1` \| `2` \| `3`

***

### phaseTitle?

> `optional` **phaseTitle?**: `string`

***

### projectiles

> **projectiles**: [`MeshProjectile`](MeshProjectile.md)[]

***

### salvoCount?

> `optional` **salvoCount?**: `number`

Salvos fired so far; phase 1 turns every third one into a ring.

***

### shieldActive?

> `optional` **shieldActive?**: `boolean`

***

### x

> **x**: `number`

***

### y

> **y**: `number`
