[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/crf/internal/expression-evaluator](../README.md) / evaluateRuleResult

# Function: evaluateRuleResult()

> **evaluateRuleResult**(`rule`, `fieldValues`, `fieldsList`, `visitContext?`): [`ConditionResult`](../../../types/type-aliases/ConditionResult.md)

Four-valued equivalent of evaluateRule: supports conditionGroups,
field/field operands, and reports a preserved unsupportedExpression (an
imported shape this evaluator couldn't map at all) as incompatible
rather than silently treating it as always-true or always-false.

## Parameters

### rule

[`EditCheckRule`](../../../types/interfaces/EditCheckRule.md)

### fieldValues

`Record`\<`string`, `string` \| `number` \| `boolean` \| `null` \| `undefined`\>

### fieldsList

[`CRFField`](../../../types/interfaces/CRFField.md)[]

### visitContext?

`string`

## Returns

[`ConditionResult`](../../../types/type-aliases/ConditionResult.md)
