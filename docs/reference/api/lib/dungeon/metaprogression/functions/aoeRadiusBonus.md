[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dungeon/metaprogression](../README.md) / aoeRadiusBonus

# Function: aoeRadiusBonus()

> **aoeRadiusBonus**(`classId`, `firmware`): `number`

The tiles a run adds to the AoE exploit radius: firmware first, then the
class multiplier on the whole radius, so the two stack.

## Parameters

### classId

[`CyberdeckClassId`](../../types/type-aliases/CyberdeckClassId.md)

The Cyberdeck class.

### firmware

The firmware tiers in force for the run.

#### exploitRadiusTier

`number`

#### maxRamTier

`number`

#### scanSpeedTier

`number`

#### startChipsTier

`number`

## Returns

`number`

Tiles added to the base radius.
