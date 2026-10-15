[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/garmin-finisher](../README.md) / stepFinisherCard

# Function: stepFinisherCard()

> **stepFinisherCard**(`prev`, `shownClockMs`, `next`): [`GameEngineState`](../../garmin-engine/interfaces/GameEngineState.md)

The Finisher Card at work after each engine step: the card the pole showed
on the last frame drawn is collected, and a third card pays out its lives
with a badge banner. Does nothing unless the run collects cards.

`shownClockMs` is the run clock of the face last drawn, which can be a few
fixed steps behind `prev` when one display frame runs several steps.

## Parameters

### prev

[`GameEngineState`](../../garmin-engine/interfaces/GameEngineState.md)

### shownClockMs

`number` \| `undefined`

### next

[`GameEngineState`](../../garmin-engine/interfaces/GameEngineState.md)

## Returns

[`GameEngineState`](../../garmin-engine/interfaces/GameEngineState.md)
