[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/study-director-world/internal/rhythm](../README.md) / answerInterruption

# Function: answerInterruption()

> **answerInterruption**(`world`, `optionId`): [`WorldResult`](../../../types/type-aliases/WorldResult.md)\<\{ `result`: `string`; \}\>

Answers the pending interruption with one of its options. The option's
cost is paid first (and can be refused for time or energy); then its
effects land and it is marked as dealt with.

## Parameters

### world

[`WorldState`](../../../types/interfaces/WorldState.md)

### optionId

`string`

## Returns

[`WorldResult`](../../../types/type-aliases/WorldResult.md)\<\{ `result`: `string`; \}\>
