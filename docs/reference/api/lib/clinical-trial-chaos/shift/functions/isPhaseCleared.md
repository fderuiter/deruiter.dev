[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/shift](../README.md) / isPhaseCleared

# Function: isPhaseCleared()

> **isPhaseCleared**(`gameMode`, `phase`, `submittedBefore`): `boolean`

Whether the submission being completed clears the campaign phase. Endless
mode has no phase target.

## Parameters

### gameMode

[`GameMode`](../../types/type-aliases/GameMode.md)

The running mode.

### phase

[`GamePhase`](../../types/type-aliases/GamePhase.md)

The running phase.

### submittedBefore

`number`

CRFs locked before this submission.

## Returns

`boolean`

True when this submission reaches the phase target.
