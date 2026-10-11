[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/for-better-or-bulk/internal/assist](../README.md) / assistInput

# Function: assistInput()

> **assistInput**(`state`, `id`): [`PlayerInput`](../../../types/interfaces/PlayerInput.md)

The input the solo assist gives `id` on this tick. Pure: the same state
always gives the same input. It returns nothing for someone who is out,
busy on a call or re-tying shoes, or who has no useful step.

## Parameters

### state

[`GameState`](../../../types/interfaces/GameState.md)

### id

[`PlayerId`](../../../types/type-aliases/PlayerId.md)

## Returns

[`PlayerInput`](../../../types/interfaces/PlayerInput.md)
