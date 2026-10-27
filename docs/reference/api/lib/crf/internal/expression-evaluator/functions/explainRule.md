[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/crf/internal/expression-evaluator](../README.md) / explainRule

# Function: explainRule()

> **explainRule**(`rule`, `fieldValues`, `fieldsList`, `visitContext?`): [`RuleExplanation`](../interfaces/RuleExplanation.md)

Full truth-table-style explanation of a rule's evaluation (#540):
every leaf condition's own sentence and result, each group's combined
result, and an overall summary sentence - including the Raise Query
message when the rule fires and is configured to raise one.

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

[`RuleExplanation`](../interfaces/RuleExplanation.md)
