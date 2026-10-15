[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/garmin-engine](../README.md) / pauseGame

# Function: pauseGame()

> **pauseGame**(`state`, `now?`, `auto?`): [`GameEngineState`](../interfaces/GameEngineState.md)

Pause a running session. Only a playing run can pause. `auto` marks a
pause the cabinet made on its own (a hidden tab), which the face calls
Auto Pause; a pause the player pressed is just paused (#2239).

## Parameters

### state

[`GameEngineState`](../interfaces/GameEngineState.md)

### now?

`number` = `...`

### auto?

`boolean` = `false`

## Returns

[`GameEngineState`](../interfaces/GameEngineState.md)
