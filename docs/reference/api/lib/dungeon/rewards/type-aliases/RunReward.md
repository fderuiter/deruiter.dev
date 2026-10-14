[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dungeon/rewards](../README.md) / RunReward

# Type Alias: RunReward

> **RunReward** = \{ `description`: `string`; `kind`: `"weapon"`; `name`: `string`; `weaponId`: [`WeaponId`](../../types/type-aliases/WeaponId.md) \| `null`; \} \| \{ `description`: `string`; `hp`: `number`; `kind`: `"heal"`; `name`: `string`; \} \| \{ `description`: `string`; `kind`: `"passive"`; `name`: `string`; `passiveId`: [`RunPassiveId`](RunPassiveId.md); \}

One reward card. A weapon reward adds a tool to the loadout at full ammo;
when the loadout is full it refills every tool instead (`weaponId` null).
