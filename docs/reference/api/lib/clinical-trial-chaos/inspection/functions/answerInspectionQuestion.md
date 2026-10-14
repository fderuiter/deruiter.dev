[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-trial-chaos/inspection](../README.md) / answerInspectionQuestion

# Function: answerInspectionQuestion()

> **answerInspectionQuestion**(`round`, `optionId`): [`InspectionRound`](../interfaces/InspectionRound.md)

Answers the current question. `null` records a timeout. Ignored while the
previous answer is still showing or the round is over.

## Parameters

### round

[`InspectionRound`](../interfaces/InspectionRound.md)

The round.

### optionId

`string` \| `null`

The picked option, or `null` when the timer ran out.

## Returns

[`InspectionRound`](../interfaces/InspectionRound.md)

The round with the answer recorded, awaiting the next question.
