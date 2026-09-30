[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/garmin-engine](../README.md) / resumeGame

# Function: resumeGame()

> **resumeGame**(`state`, `now?`): [`GameEngineState`](../interfaces/GameEngineState.md)

Resume a paused session. The allocation and obstacle timers run on wall
time, so they shift by the paused duration; otherwise a long pause would
fire an allocation and a spawn the moment play resumes (#1216).

## Parameters

### state

[`GameEngineState`](../interfaces/GameEngineState.md)

### now?

`number` = `...`

## Returns

[`GameEngineState`](../interfaces/GameEngineState.md)
