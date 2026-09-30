[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/shift](../README.md) / getComboMultiplier

# Function: getComboMultiplier()

> **getComboMultiplier**(`combo`): `number`

Score multiplier for a combo: one step per three consecutive clean
submissions, capped at 4x.

## Parameters

### combo

`number`

Consecutive successful submissions.

## Returns

`number`

The multiplier, from 1 to 4.
