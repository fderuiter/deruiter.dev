[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/arcade/crt-pipeline](../README.md) / shouldCabinetDrawCrt

# Function: shouldCabinetDrawCrt()

> **shouldCabinetDrawCrt**(`gameId`, `filter`): `boolean`

Whether the cabinet should draw its CRT layer for a game and setting.

## Parameters

### gameId

`string`

The cabinet's game id.

### filter

[`CabinetCrtFilter`](../type-aliases/CabinetCrtFilter.md)

The wizard's CRT setting.

## Returns

`boolean`

False for `off` and for games that draw their own CRT.
