[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/for-better-or-bulk/internal/views](../README.md) / getCoachStep

# Function: getCoachStep()

> **getCoachStep**(`state`, `id`, `options?`): [`CoachStep`](../interfaces/CoachStep.md) \| `null`

The coach's next step for one person: the line and the tile it points at.
It follows what the person holds. Null when there is nothing useful for them
to do (the level is over, or they are away). Co-op options give each person
their own starting job.

## Parameters

### state

[`GameState`](../../../types/interfaces/GameState.md)

### id

[`PlayerId`](../../../types/type-aliases/PlayerId.md)

### options?

[`HintOptions`](../../../types/interfaces/HintOptions.md) = `{}`

## Returns

[`CoachStep`](../interfaces/CoachStep.md) \| `null`
