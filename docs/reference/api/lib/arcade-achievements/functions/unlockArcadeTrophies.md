[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/arcade-achievements](../README.md) / unlockArcadeTrophies

# Function: unlockArcadeTrophies()

> **unlockArcadeTrophies**(`trophyIds`): [`ArcadeTrophy`](../interfaces/ArcadeTrophy.md)[]

Unlocks named trophies a game awards from a finished run rather than from a
score. A trophy already unlocked keeps its first timestamp, and only the
newly unlocked ones are returned and announced.

## Parameters

### trophyIds

readonly `string`[]

## Returns

[`ArcadeTrophy`](../interfaces/ArcadeTrophy.md)[]
