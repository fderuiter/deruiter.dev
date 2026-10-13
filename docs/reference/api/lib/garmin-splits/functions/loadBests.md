[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/garmin-splits](../README.md) / loadBests

# Function: loadBests()

> **loadBests**(`device`): [`GarminBests`](../interfaces/GarminBests.md)

Loads the bests for a device key. Corrupt JSON and wrong shapes are dropped,
and invalid split entries end the list early, so only the valid leading
splits are kept. Never throws.

## Parameters

### device

`string`

## Returns

[`GarminBests`](../interfaces/GarminBests.md)
