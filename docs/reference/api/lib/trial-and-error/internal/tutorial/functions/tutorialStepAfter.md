[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/tutorial](../README.md) / tutorialStepAfter

# Function: tutorialStepAfter()

> **tutorialStepAfter**(`steps`, `current`, `event`, `state`): `number`

The step to show after the latest table event: the current step, or the
first later one whose outcome the table does not already show. Steps done
out of order are skipped, so a player who selects the Pair before closing
the Inspect view is not asked to do it again. Returns `steps.length` once
every step is done. Next-only steps are passed with [nextTutorialStep](nextTutorialStep.md).

## Parameters

### steps

readonly [`TutorialStep`](../interfaces/TutorialStep.md)[]

### current

`number`

### event

[`TableEvent`](../../table/interfaces/TableEvent.md) \| `null`

### state

[`TableState`](../../table/interfaces/TableState.md)

## Returns

`number`
