[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dungeon/rewards](../README.md) / drawRunRewards

# Function: drawRunRewards()

> **drawRunRewards**(`seed`, `step`, `loadout`): \[[`RunReward`](../type-aliases/RunReward.md), [`RunReward`](../type-aliases/RunReward.md), [`RunReward`](../type-aliases/RunReward.md)\]

The three rewards offered after a room: a weapon, a heal and a passive, in
that order. The weapon is one the loadout does not carry; a full loadout is
offered a refill instead.

## Parameters

### seed

`string`

The run seed.

### step

`number`

The zero-based run position of the room just cleared.

### loadout

readonly [`WeaponId`](../../types/type-aliases/WeaponId.md)[]

The current loadout.

## Returns

\[[`RunReward`](../type-aliases/RunReward.md), [`RunReward`](../type-aliases/RunReward.md), [`RunReward`](../type-aliases/RunReward.md)\]

The weapon, heal and passive cards.
