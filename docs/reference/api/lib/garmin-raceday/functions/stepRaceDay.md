[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/garmin-raceday](../README.md) / stepRaceDay

# Function: stepRaceDay()

> **stepRaceDay**(`prev`, `next`, `deltaMs`): [`GameEngineState`](../../garmin-engine/interfaces/GameEngineState.md)

Race Day after one engine step from `prev` to `next`: The Wall steps out
near the finish, moves through its pattern, and holds the finish pole out of
reach until it is beaten. A Wall that leaves the course with no life lost
was beaten; one that leaves with a life lost comes back at full strength
when the runner reaches it again. Any other run is returned unchanged.

## Parameters

### prev

[`GameEngineState`](../../garmin-engine/interfaces/GameEngineState.md)

### next

[`GameEngineState`](../../garmin-engine/interfaces/GameEngineState.md)

### deltaMs

`number`

## Returns

[`GameEngineState`](../../garmin-engine/interfaces/GameEngineState.md)
