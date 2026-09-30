[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dungeon/weapons](../README.md) / AmmoGrantResult

# Interface: AmmoGrantResult

What an ammo pickup or purchase actually gave the player.

## Properties

### charges

> **charges**: `number`

Charges added, after any conversion and cap.

***

### updatedWeapons

> **updatedWeapons**: `Record`\<[`WeaponId`](../../types/type-aliases/WeaponId.md), [`Weapon`](../../types/interfaces/Weapon.md)\>

***

### weaponId

> **weaponId**: [`WeaponId`](../../types/type-aliases/WeaponId.md) \| `null`

The weapon that received the charges, or null when none could.
