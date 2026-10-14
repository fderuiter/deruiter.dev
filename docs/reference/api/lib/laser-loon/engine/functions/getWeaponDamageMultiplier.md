[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/laser-loon/engine](../README.md) / getWeaponDamageMultiplier

# Function: getWeaponDamageMultiplier()

> **getWeaponDamageMultiplier**(`type`, `laserType`): `number`

Damage multiplier for a weapon against an enemy type: doubled on a
weakness, halved when resisted, otherwise 1. Never zero, so no enemy is
immune to any optic.

## Parameters

### type

[`CivicEnemyType`](../../types/type-aliases/CivicEnemyType.md)

Enemy type hit.

### laserType

[`LaserType`](../../types/type-aliases/LaserType.md)

Weapon that landed the hit.

## Returns

`number`
