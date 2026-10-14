[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/patty-drive-thru/internal/week](../README.md) / getWeekDayConfig

# Function: getWeekDayConfig()

> **getWeekDayConfig**(`week`, `durationSec?`): [`ShiftConfig`](../../../types/interfaces/ShiftConfig.md) \| `null`

The shift config for the next day of the week: the day's dials, its
rushes, the birthday unlock and the meters carried from the day before.
Replaying this config with the day's actions gives the same day exactly.
Returns null once the week is over.

## Parameters

### week

[`WeekState`](../../../types/interfaces/WeekState.md)

### durationSec?

`number` = `DEFAULT_SHIFT_CONFIG.durationSec`

## Returns

[`ShiftConfig`](../../../types/interfaces/ShiftConfig.md) \| `null`
