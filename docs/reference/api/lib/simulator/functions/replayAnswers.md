[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/simulator](../README.md) / replayAnswers

# Function: replayAnswers()

> **replayAnswers**(`indices`): `object`

Replays answer indices through the tree, stopping at the first index that
does not name an option of the current question.

## Parameters

### indices

readonly `number`[]

Option indices, one per answered question.

## Returns

`object`

The step reached, the steps visited and the options chosen.

### answers

> **answers**: [`SimulatorOption`](../interfaces/SimulatorOption.md)[]

### history

> **history**: [`SimulatorQuestionId`](../type-aliases/SimulatorQuestionId.md)[]

### step

> **step**: [`SimulatorStepId`](../type-aliases/SimulatorStepId.md)
