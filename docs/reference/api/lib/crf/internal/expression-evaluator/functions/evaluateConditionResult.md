[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/crf/internal/expression-evaluator](../README.md) / evaluateConditionResult

# Function: evaluateConditionResult()

> **evaluateConditionResult**(`condition`, `fieldValues`, `fieldsList`, `visitContext?`): [`ConditionResult`](../../../types/type-aliases/ConditionResult.md)

Evaluate a single AST condition to a four-valued result: "true", "false",
"missing" (an operand has no value), or "incompatible" (a type mismatch,
or an operator this evaluator doesn't recognize - defensive against an
imported expression using a shape this app never authors itself).

## Parameters

### condition

[`AstCondition`](../../../types/interfaces/AstCondition.md)

### fieldValues

`Record`\<`string`, `string` \| `number` \| `boolean` \| `null` \| `undefined`\>

### fieldsList

[`CRFField`](../../../types/interfaces/CRFField.md)[]

### visitContext?

`string`

## Returns

[`ConditionResult`](../../../types/type-aliases/ConditionResult.md)
