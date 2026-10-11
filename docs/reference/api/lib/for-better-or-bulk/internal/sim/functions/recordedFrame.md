[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/for-better-or-bulk/internal/sim](../README.md) / recordedFrame

# Function: recordedFrame()

> **recordedFrame**(`state`, `frame`): [`Frame`](../../../types/interfaces/Frame.md)

The frame to record for a tick the engine has just applied. A brothers
decision the engine ignores (wrong phase, or one that does not validate) is
dropped, so a strict replay of the recording reproduces the live run.

## Parameters

### state

[`GameState`](../../../types/interfaces/GameState.md)

### frame

[`Frame`](../../../types/interfaces/Frame.md)

## Returns

[`Frame`](../../../types/interfaces/Frame.md)
