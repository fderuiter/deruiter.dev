[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/laser-loon/types](../README.md) / EnemyTemplate

# Interface: EnemyTemplate

## Properties

### behavior?

> `optional` **behavior?**: `"sine"` \| `"linear"` \| `"homing"` \| `"bouncing"` \| `"boss-orbit"`

***

### color

> **color**: `string`

***

### hp

> **hp**: `number`

***

### isBoss?

> `optional` **isBoss?**: `boolean`

***

### label

> **label**: `string`

***

### points

> **points**: `number`

***

### radius

> **radius**: `number`

***

### resists?

> `optional` **resists?**: readonly [`LaserType`](../type-aliases/LaserType.md)[]

Optics this enemy shrugs off at reduced damage, still never immune.

***

### type

> **type**: [`CivicEnemyType`](../type-aliases/CivicEnemyType.md)

***

### weakTo?

> `optional` **weakTo?**: [`LaserType`](../type-aliases/LaserType.md)

The optic that lands a critical hit: double damage. Bosses have none.
