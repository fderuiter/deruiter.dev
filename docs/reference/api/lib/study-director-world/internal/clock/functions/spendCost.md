[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/study-director-world/internal/clock](../README.md) / spendCost

# Function: spendCost()

> **spendCost**(`world`, `cost`): [`WorldResult`](../../../types/type-aliases/WorldResult.md)\<\{ `cost`: [`ActionCost`](../../../types/interfaces/ActionCost.md); \}\>

Spends an arbitrary cost of time, energy and focus, with the same overtime
and refusal rules as `spend`. Used by actions that are not one of the
standard kinds, such as answering an interruption.

## Parameters

### world

[`WorldState`](../../../types/interfaces/WorldState.md)

### cost

[`ActionCost`](../../../types/interfaces/ActionCost.md)

## Returns

[`WorldResult`](../../../types/type-aliases/WorldResult.md)\<\{ `cost`: [`ActionCost`](../../../types/interfaces/ActionCost.md); \}\>
