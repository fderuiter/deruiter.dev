[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dungeon/tsp](../README.md) / tspWallTelegraph

# Function: tspWallTelegraph()

> **tspWallTelegraph**(`grid`, `walls`, `moveCount`): [`TspWallTelegraph`](../interfaces/TspWallTelegraph.md)

The telegraph for the walls of a TSP room grid. It runs the same
updateTSPMovingWalls rule the game runs on each move, so the drawing and the
countdown always agree with what the next moves will do.

## Parameters

### grid

`string`[][]

### walls

[`TSPMovingWall`](../../types/interfaces/TSPMovingWall.md)[]

### moveCount

`number`

## Returns

[`TspWallTelegraph`](../interfaces/TspWallTelegraph.md)
