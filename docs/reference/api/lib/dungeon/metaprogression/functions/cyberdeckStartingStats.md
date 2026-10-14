[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dungeon/metaprogression](../README.md) / cyberdeckStartingStats

# Function: cyberdeckStartingStats()

> **cyberdeckStartingStats**(`classId`, `firmware`): [`CyberdeckStartingStats`](../interfaces/CyberdeckStartingStats.md)

A class's starting HP, RAM and bypass chips for a run under the given
firmware.

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

[`CyberdeckStartingStats`](../interfaces/CyberdeckStartingStats.md)

The run's opening vitals.
