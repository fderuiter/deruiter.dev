[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/shift](../README.md) / scoreSubmission

# Function: scoreSubmission()

> **scoreSubmission**(`score`, `subject`, `allClean`, `adjustPoints?`): [`SubmissionScore`](../interfaces/SubmissionScore.md)

Scores a verified submission against the score state it was made in: the
points use the multiplier the player had going in, then the combo grows.

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

### adjustPoints?

(`points`) => `number`

Adjusts the points, for example for the office.

## Returns

[`SubmissionScore`](../interfaces/SubmissionScore.md)

The points, combo and multiplier.
