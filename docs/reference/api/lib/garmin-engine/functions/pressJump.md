[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/garmin-engine](../README.md) / pressJump

# Function: pressJump()

> **pressJump**(`state`): [`GameEngineState`](../interfaces/GameEngineState.md)

Presses jump. On footing, or within [COYOTE\_MS](../variables/COYOTE_MS.md) of leaving it, the
runner jumps at once; in the air the press is remembered for
[JUMP\_BUFFER\_MS](../variables/JUMP_BUFFER_MS.md) and fires on landing. Holding the key (until
[releaseJump](releaseJump.md)) keeps the rise floaty for a higher jump.

## Parameters

### state

[`GameEngineState`](../interfaces/GameEngineState.md)

## Returns

[`GameEngineState`](../interfaces/GameEngineState.md)
