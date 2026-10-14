[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dungeon/metaprogression](../README.md) / firmwareTierCost

# Function: firmwareTierCost()

> **firmwareTierCost**(`firmware`, `id`): `number` \| `null`

The crypto the next tier of a firmware track costs.

## Parameters

### firmware

The profile's firmware tiers.

#### exploitRadiusTier

`number`

#### maxRamTier

`number`

#### scanSpeedTier

`number`

#### startChipsTier

`number`

### id

`"maxRamTier"` \| `"scanSpeedTier"` \| `"exploitRadiusTier"` \| `"startChipsTier"`

The track.

## Returns

`number` \| `null`

The cost, or null when the track is at its top tier.
