[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/study-director-world/internal/movement](../README.md) / forgivingStep

# Function: forgivingStep()

> **forgivingStep**(`world`, `facing`, `map?`, `people?`): [`WorldResult`](../../../types/type-aliases/WorldResult.md)\<\{ `moved`: `boolean`; \}\>

An arrow key with corner forgiveness. It is `step`, except that a key
pressed into a wall one tile off a doorway slides the player into line
with the door instead of stopping dead: the step sideways is taken (and
paid for) and the player keeps facing the way they pressed. It only
slides when exactly one side opens onto a free tile ahead, so it never
guesses between two doors, never slides into furniture or stations, and
never moves the player when a person is the thing in the way.

## Parameters

### world

[`WorldState`](../../../types/interfaces/WorldState.md)

### facing

`"up"` \| `"down"` \| `"left"` \| `"right"`

### map?

[`WorldMap`](../../../types/interfaces/WorldMap.md) = `CRO_FLOOR`

### people?

readonly [`TilePoint`](../../../types/interfaces/TilePoint.md)[] = `[]`

## Returns

[`WorldResult`](../../../types/type-aliases/WorldResult.md)\<\{ `moved`: `boolean`; \}\>
