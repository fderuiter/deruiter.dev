[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/ast-debugger](../README.md) / AstRuleDebugTrace

# Interface: AstRuleDebugTrace

## Properties

### actionType

> **actionType**: `"show_field"` \| `"hide_field"` \| `"require_field"` \| `"raise_query"` \| `"set_value"`

***

### finalResult

> **finalResult**: [`ConditionResult`](../../types/type-aliases/ConditionResult.md)

***

### hasShortCircuit

> **hasShortCircuit**: `boolean`

***

### incompatibleFields

> **incompatibleFields**: `string`[]

***

### missingFields

> **missingFields**: `string`[]

***

### overallSummary

> **overallSummary**: `string`

***

### queryMessage?

> `optional` **queryMessage?**: `string`

***

### raisesQuery

> **raisesQuery**: `boolean`

***

### ruleId

> **ruleId**: `string`

***

### ruleName

> **ruleName**: `string`

***

### steps

> **steps**: [`AstDebugStep`](AstDebugStep.md)[]

***

### targetFieldId

> **targetFieldId**: `string`

***

### totalSteps

> **totalSteps**: `number`
