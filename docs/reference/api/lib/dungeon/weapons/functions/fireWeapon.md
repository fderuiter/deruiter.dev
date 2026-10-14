[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dungeon/weapons](../README.md) / fireWeapon

# Function: fireWeapon()

> **fireWeapon**(`weaponId`, `weapons`, `playerX`, `playerY`, `playerHp`, `maxPlayerHp`, `enemies`, `boss`, `nowMs`, `currentRam?`, `aoeRadiusBonus?`): [`WeaponFireResult`](../interfaces/WeaponFireResult.md)

Fires a cybersecurity weapon or exploit with damage, CVE multipliers, particles, and side-effects.

## Parameters

### weaponId

[`WeaponId`](../../types/type-aliases/WeaponId.md)

### weapons

`Record`\<[`WeaponId`](../../types/type-aliases/WeaponId.md), [`Weapon`](../../types/interfaces/Weapon.md)\>

### playerX

`number`

### playerY

`number`

### playerHp

`number`

### maxPlayerHp

`number`

### enemies

[`Enemy`](../../types/interfaces/Enemy.md)[]

### boss

[`BossState`](../../types/interfaces/BossState.md) \| `undefined`

### nowMs

`number`

### currentRam?

`number` = `32`

### aoeRadiusBonus?

`number` = `0`

## Returns

[`WeaponFireResult`](../interfaces/WeaponFireResult.md)
