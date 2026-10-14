[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dungeon/rewards](../README.md) / runLoadout

# Function: runLoadout()

> **runLoadout**(`starterWeapons`, `build`): [`WeaponId`](../../types/type-aliases/WeaponId.md)[]

The run's tools in slot order: the class tools, then the route weapons, up
to [RUN\_LOADOUT\_SLOTS](../variables/RUN_LOADOUT_SLOTS.md).

## Parameters

### starterWeapons

readonly [`WeaponId`](../../types/type-aliases/WeaponId.md)[]

The class's starter tools.

### build

[`RunBuild`](../interfaces/RunBuild.md)

The run build.

## Returns

[`WeaponId`](../../types/type-aliases/WeaponId.md)[]

The loadout.
