[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/patty-drive-thru/internal/week](../README.md) / parseWeekSave

# Function: parseWeekSave()

> **parseWeekSave**(`value`): [`WeekState`](../../../types/interfaces/WeekState.md) \| `null`

Reads a saved week back, from the parsed JSON of a save. Anything that is
not a valid week (an unknown version, days out of order, a missing field)
returns null, so a broken save starts a fresh week rather than a broken
one.

## Parameters

### value

`unknown`

## Returns

[`WeekState`](../../../types/interfaces/WeekState.md) \| `null`
