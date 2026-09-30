[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dungeon/weapons](../README.md) / grantAmmoForLoadout

# Function: grantAmmoForLoadout()

> **grantAmmoForLoadout**(`weapons`, `loadout`, `grantedId`, `charges`, `capAtMax`): [`AmmoGrantResult`](../interfaces/AmmoGrantResult.md)

Gives ammo the player's class can fire (#1667).

A grant for a weapon on the class's hotbar goes to that weapon. Otherwise
it converts to the class's first boss-damaging hotbar weapon, with enough
charges to deal at least the same damage. When the class carries no such
weapon, nothing changes and `weaponId` is null.

## Parameters

### weapons

`Record`\<[`WeaponId`](../../types/type-aliases/WeaponId.md), [`Weapon`](../../types/interfaces/Weapon.md)\>

The player's current weapons.

### loadout

readonly [`WeaponId`](../../types/type-aliases/WeaponId.md)[]

The class's hotbar weapons, in key order.

### grantedId

[`WeaponId`](../../types/type-aliases/WeaponId.md)

The weapon the pickup or purchase is for.

### charges

`number`

Charges of `grantedId` it grants.

### capAtMax

`boolean`

Whether the result is capped at the weapon's `maxAmmo`.

## Returns

[`AmmoGrantResult`](../interfaces/AmmoGrantResult.md)

The new weapons, which weapon got the ammo, and how much.
