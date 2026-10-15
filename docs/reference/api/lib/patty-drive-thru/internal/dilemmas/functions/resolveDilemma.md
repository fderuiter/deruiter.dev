[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/patty-drive-thru/internal/dilemmas](../README.md) / resolveDilemma

# Function: resolveDilemma()

> **resolveDilemma**(`state`, `option`, `timedOut`, `events`): [`ShiftState`](../../../types/interfaces/ShiftState.md)

Answers the open dilemma: applies the option's meter changes, and its
Solidarity change when the player chose it rather than the clock (#2139),
records the choice and closes the dilemma. The caller has already
checked the option belongs to the open dilemma.

## Parameters

### state

[`ShiftState`](../../../types/interfaces/ShiftState.md)

### option

[`DilemmaOption`](../../../types/interfaces/DilemmaOption.md)

### timedOut

`boolean`

### events

[`ShiftEvent`](../../../types/type-aliases/ShiftEvent.md)[]

## Returns

[`ShiftState`](../../../types/interfaces/ShiftState.md)
