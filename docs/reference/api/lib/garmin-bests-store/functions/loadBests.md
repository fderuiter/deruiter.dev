[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/garmin-bests-store](../README.md) / loadBests

# Function: loadBests()

> **loadBests**(`device`): [`GarminBests`](../../garmin-splits/interfaces/GarminBests.md)

Loads the bests for a device key. Corrupt JSON and wrong shapes are dropped,
and invalid split entries end the list early, so only the valid leading
splits are kept. Never throws.

## Parameters

### device

`string`

## Returns

[`GarminBests`](../../garmin-splits/interfaces/GarminBests.md)
