[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/study-director-world/internal/team](../README.md) / daySchedule

# Function: daySchedule()

> **daySchedule**(`world`, `memberId`, `map?`): [`DaySchedule`](../../../types/interfaces/DaySchedule.md) \| `null`

A member's day, derived from their workload rather than scripted. A calm
member (50 or less) takes a coffee outside mid-morning and lunches in the
break room. A busy one grabs a coffee and comes straight back, and above
65 eats lunch at the desk. An overloaded one (above 75) is in early,
skips the coffee, eats at the desk and leaves late. Everyone else leaves
at six, and everyone is at their desk when the office opens. Leaving and
lunch follow `workHours`; the other times vary a little by seed and day.

## Parameters

### world

[`WorldState`](../../../types/interfaces/WorldState.md)

### memberId

`string`

### map?

[`WorldMap`](../../../types/interfaces/WorldMap.md) = `CRO_FLOOR`

## Returns

[`DaySchedule`](../../../types/interfaces/DaySchedule.md) \| `null`
