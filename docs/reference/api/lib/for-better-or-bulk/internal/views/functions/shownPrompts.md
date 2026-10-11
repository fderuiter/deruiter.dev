[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/for-better-or-bulk/internal/views](../README.md) / shownPrompts

# Function: shownPrompts()

> **shownPrompts**(`state`, `active`): readonly [`PlayerId`](../../../types/type-aliases/PlayerId.md)[]

The people whose status line the prompt panel shows. Solo shows the person at
the keyboard, and the partner as well while the partner is out or frozen (on
the phone, or retying a shoelace), so a call never goes unexplained (round 9,
task 4). Co-op shows both people and is not handled here.

## Parameters

### state

[`GameState`](../../../types/interfaces/GameState.md)

### active

[`PlayerId`](../../../types/type-aliases/PlayerId.md)

## Returns

readonly [`PlayerId`](../../../types/type-aliases/PlayerId.md)[]
