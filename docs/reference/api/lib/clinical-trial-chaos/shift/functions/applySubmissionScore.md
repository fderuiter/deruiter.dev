[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/shift](../README.md) / applySubmissionScore

# Function: applySubmissionScore()

> **applySubmissionScore**(`score`, `submission`, `allClean`): [`GameScoreState`](../../types/interfaces/GameScoreState.md)

Applies a scored submission to a score state.

## Parameters

### score

[`GameScoreState`](../../types/interfaces/GameScoreState.md)

The score state to update.

### submission

[`SubmissionScore`](../interfaces/SubmissionScore.md)

The result of `scoreSubmission`.

### allClean

`boolean`

Whether the submission counts as clean.

## Returns

[`GameScoreState`](../../types/interfaces/GameScoreState.md)

The updated score state.
