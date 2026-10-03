[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/arcade/crt-pipeline](../README.md) / getCabinetCrtProfile

# Function: getCabinetCrtProfile()

> **getCabinetCrtProfile**(`gameId`): [`CabinetCrtProfile`](../interfaces/CabinetCrtProfile.md)

Returns a game's CRT profile. Unknown games are treated as DOM games that
leave the CRT to the cabinet, so the default is no overlay.

## Parameters

### gameId

`string`

The cabinet's game id, such as `laser-loon`.

## Returns

[`CabinetCrtProfile`](../interfaces/CabinetCrtProfile.md)

The game's surface type and whether it draws its own CRT.
