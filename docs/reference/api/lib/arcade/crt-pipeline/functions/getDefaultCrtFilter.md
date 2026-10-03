[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/arcade/crt-pipeline](../README.md) / getDefaultCrtFilter

# Function: getDefaultCrtFilter()

> **getDefaultCrtFilter**(`gameId`): [`CabinetCrtFilter`](../type-aliases/CabinetCrtFilter.md)

The wizard's CRT setting for a player who has not chosen one: Soft for
canvas games and Off for DOM games, whose text a raster would only blur.

## Parameters

### gameId

`string`

The cabinet's game id.

## Returns

[`CabinetCrtFilter`](../type-aliases/CabinetCrtFilter.md)

`soft` or `off`.
