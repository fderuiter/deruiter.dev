[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/study-director-world/internal/clock](../README.md) / passTime

# Function: passTime()

> **passTime**(`world`, `minutes`): [`WorldResult`](../../../types/type-aliases/WorldResult.md)\<\{ `cost`: [`ActionCost`](../../../types/interfaces/ActionCost.md); \}\>

Lets some minutes pass doing nothing, such as waiting for someone to move
out of a doorway. It costs the minutes and nothing else; time past the end
of the day is overtime as for any other action.

## Parameters

### world

[`WorldState`](../../../types/interfaces/WorldState.md)

### minutes

`number`

## Returns

[`WorldResult`](../../../types/type-aliases/WorldResult.md)\<\{ `cost`: [`ActionCost`](../../../types/interfaces/ActionCost.md); \}\>
