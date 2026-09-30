[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/engine](../README.md) / getNextShiftScoreState

# Function: getNextShiftScoreState()

> **getNextShiftScoreState**(`prev`, `continuesCampaign`, `highScore`): [`GameScoreState`](../../types/interfaces/GameScoreState.md)

Score state for the next shift. Advancing to campaign phase 2 or 3
continues the same run, so the score and running tallies carry over and the
campaign ends on one total (#1325); the combo, the multiplier and the
phase's own lock count restart (#1673). Any
other start (phase 1 or endless) is a fresh run.

## Parameters

### prev

[`GameScoreState`](../../types/interfaces/GameScoreState.md)

The score state at the end of the previous shift.

### continuesCampaign

`boolean`

True when advancing to campaign phase 2 or 3.

### highScore

`number`

The best score saved so far.

## Returns

[`GameScoreState`](../../types/interfaces/GameScoreState.md)

The score state to start the shift with.
