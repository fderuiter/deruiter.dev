[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/arcade/games](../README.md) / getArcadeNeighbors

# Function: getArcadeNeighbors()

> **getArcadeNeighbors**(`route`): `object`

The previous and next games for a game page, in hub order and wrapping at
both ends, so every game (Trial & Error and Study Director included) sits in
one ring that matches the hub (#1330).

## Parameters

### route

`"/arcade/working-with-duck"` \| `"/arcade/laser-loon"` \| `"/arcade/quasi-puzzler"` \| `"/arcade/garmin-watch"` \| `"/arcade/clinical-chaos"` \| `"/arcade/trial-and-error"` \| `"/arcade/study-director"` \| `"/arcade/patty-drive-thru"` \| `"/arcade/retro-labyrinth"`

## Returns

`object`

### next

> **next**: [`ArcadeNeighbor`](../interfaces/ArcadeNeighbor.md)

### prev

> **prev**: [`ArcadeNeighbor`](../interfaces/ArcadeNeighbor.md)
