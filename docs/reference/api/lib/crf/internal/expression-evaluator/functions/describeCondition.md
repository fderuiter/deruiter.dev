[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/crf/internal/expression-evaluator](../README.md) / describeCondition

# Function: describeCondition()

> **describeCondition**(`condition`, `fieldValues`, `fieldsList`, `result`, `visitContext?`): `string`

One human-readable, truth-table-style sentence for a single leaf condition (#540).

## Parameters

### condition

[`AstCondition`](../../../types/interfaces/AstCondition.md)

### fieldValues

`Record`\<`string`, `string` \| `number` \| `boolean` \| `null` \| `undefined`\>

### fieldsList

[`CRFField`](../../../types/interfaces/CRFField.md)[]

### result

[`ConditionResult`](../../../types/type-aliases/ConditionResult.md)

### visitContext?

`string`

## Returns

`string`
