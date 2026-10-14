[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/garmin-race](../README.md) / raceOutcomeOf

# Function: raceOutcomeOf()

> **raceOutcomeOf**(`state`): [`RaceOutcome`](../interfaces/RaceOutcome.md)

The race outcome of a run, built from its engine state. A run that reached
the summary finished; any other end is a DNF.

## Parameters

### state

#### gameState

`string`

#### gearTaken?

`boolean`

#### kudosMissed?

`number`

#### lapSplits?

readonly `number`[]

#### medalsFound?

readonly `number`[]

#### runClockMs?

`number`

## Returns

[`RaceOutcome`](../interfaces/RaceOutcome.md)
