[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/arcade-achievements](../README.md) / recordArcadeMilestone

# Function: recordArcadeMilestone()

> **recordArcadeMilestone**(`gameId`, `milestone`): [`ArcadeTrophy`](../interfaces/ArcadeTrophy.md)[]

Records a named moment in a game's play (an act cleared, every level
proven) and unlocks the trophies that game ties to it. Unknown milestones
unlock nothing, so a game can fire them before a trophy exists (#2047).

## Parameters

### gameId

`string`

### milestone

`string`

## Returns

[`ArcadeTrophy`](../interfaces/ArcadeTrophy.md)[]
