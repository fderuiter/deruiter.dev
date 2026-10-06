[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/patty-drive-thru/internal/engine](../README.md) / stepShift

# Function: stepShift()

> **stepShift**(`state`, `dtSec`): [`StepResult`](../../../types/interfaces/StepResult.md)

Advances the shift by `dtSec` seconds: new orders arrive, old ones expire,
a flagged coworker finishes the coffee, and an idle player gets yelled at.
Steps longer than half a second are shortened, so a stalled tab cannot skip
the shift.

## Parameters

### state

[`ShiftState`](../../../types/interfaces/ShiftState.md)

### dtSec

`number`

## Returns

[`StepResult`](../../../types/interfaces/StepResult.md)
