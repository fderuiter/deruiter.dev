[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/patty-drive-thru/internal/engine](../README.md) / replayShift

# Function: replayShift()

> **replayShift**(`config`, `timeline`): [`ShiftState`](../../../types/interfaces/ShiftState.md)

Replays a shift from its config: the actions are applied in order, each
after stepping the clock to its time. Useful for tests, saved runs and the
diary log.

## Parameters

### config

`Partial`\<[`ShiftConfig`](../../../types/interfaces/ShiftConfig.md)\>

### timeline

readonly `object`[]

## Returns

[`ShiftState`](../../../types/interfaces/ShiftState.md)
