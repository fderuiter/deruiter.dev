[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/patty-drive-thru/internal/dilemmas](../README.md) / stepDilemmas

# Function: stepDilemmas()

> **stepDilemmas**(`state`, `events`): [`ShiftState`](../../../types/interfaces/ShiftState.md)

Runs the dilemma clock for a shift whose time has just moved: an open
dilemma whose timer ran out, or that is still open at close, takes its
default answer, and the next planned dilemma is offered once its time has
come and nothing else is open.

## Parameters

### state

[`ShiftState`](../../../types/interfaces/ShiftState.md)

### events

[`ShiftEvent`](../../../types/type-aliases/ShiftEvent.md)[]

## Returns

[`ShiftState`](../../../types/interfaces/ShiftState.md)
