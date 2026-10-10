[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/patty-drive-thru/internal/engine](../README.md) / createShift

# Function: createShift()

> **createShift**(`config?`): [`ShiftState`](../../../types/interfaces/ShiftState.md)

Starts a shift. A missing, empty or non-string seed falls back to the
default, and a duration that is not a finite number is replaced by the
default and then held between 10 seconds and one hour. Scenario dials are
clamped to their ranges.

## Parameters

### config?

`Partial`\<[`ShiftConfig`](../../../types/interfaces/ShiftConfig.md)\> = `{}`

## Returns

[`ShiftState`](../../../types/interfaces/ShiftState.md)
