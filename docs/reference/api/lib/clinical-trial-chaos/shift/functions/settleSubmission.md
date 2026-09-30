[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/shift](../README.md) / settleSubmission

# Function: settleSubmission()

> **settleSubmission**(`score`, `subject`, `allClean`, `gameMode`, `phase`, `adjustPoints?`): [`SettledSubmission`](../interfaces/SettledSubmission.md)

Scores a verified submission, applies it, and checks whether it clears the
phase. A phase-clear report must grade `scoreState`, the tallies after this
submission, so the final CRF's clean count is included (#1609).

## Parameters

### score

[`GameScoreState`](../../types/interfaces/GameScoreState.md)

The score state before the submission.

### subject

[`ClinicalSubject`](../../types/interfaces/ClinicalSubject.md)

The submitted subject.

### allClean

`boolean`

Whether every observation was resolved.

### gameMode

[`GameMode`](../../types/type-aliases/GameMode.md)

The running mode.

### phase

[`GamePhase`](../../types/type-aliases/GamePhase.md)

The running phase.

### adjustPoints?

(`points`) => `number`

Adjusts the points, for example for the office.

## Returns

[`SettledSubmission`](../interfaces/SettledSubmission.md)

The submission, the updated score state and the phase check.
