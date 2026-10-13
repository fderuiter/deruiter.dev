[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/garmin-engine](../README.md) / pressSlam

# Function: pressSlam()

> **pressSlam**(`state`): [`GameEngineState`](../interfaces/GameEngineState.md)

Starts a Burpee Slam: the runner drops straight down at [SLAM\_VY](../../garmin-moves/variables/SLAM_VY.md)
until it lands. Only in the air on a fitness run (see [canSlam](canSlam.md));
otherwise the state is returned unchanged.

## Parameters

### state

[`GameEngineState`](../interfaces/GameEngineState.md)

## Returns

[`GameEngineState`](../interfaces/GameEngineState.md)
