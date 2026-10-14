[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/patty-drive-thru/internal/week](../README.md) / recordWeekDay

# Function: recordWeekDay()

> **recordWeekDay**(`week`, `shift`): [`WeekState`](../../../types/interfaces/WeekState.md)

Adds a finished shift to the week as its next day. A shift still playing,
or one added after Friday, leaves the week unchanged.

## Parameters

### week

[`WeekState`](../../../types/interfaces/WeekState.md)

### shift

[`ShiftState`](../../../types/interfaces/ShiftState.md)

## Returns

[`WeekState`](../../../types/interfaces/WeekState.md)
