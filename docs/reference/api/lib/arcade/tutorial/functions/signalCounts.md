[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/arcade/tutorial](../README.md) / signalCounts

# Function: signalCounts()

> **signalCounts**(`script`, `state`, `name`): `boolean`

Whether a signal would count right now, so a game can send signals from a
hot loop without waking React for the ones that would not.

## Parameters

### script

[`TutorialScript`](../interfaces/TutorialScript.md)

The game's tutorial.

### state

[`TutorialState`](../interfaces/TutorialState.md)

The run so far.

### name

`string`

The signal.

## Returns

`boolean`

True when the signal advances the current practice.
