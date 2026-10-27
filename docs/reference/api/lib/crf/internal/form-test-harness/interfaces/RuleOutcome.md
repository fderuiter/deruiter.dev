[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/crf/internal/form-test-harness](../README.md) / RuleOutcome

# Interface: RuleOutcome

One rule's evaluation against the current synthetic record.

## Properties

### actionType

> **actionType**: `"show_field"` \| `"hide_field"` \| `"require_field"` \| `"raise_query"` \| `"set_value"`

***

### explanation

> **explanation**: [`RuleExplanation`](../../expression-evaluator/interfaces/RuleExplanation.md)

***

### queryMessage?

> `optional` **queryMessage?**: `string`

***

### raisesQuery

> **raisesQuery**: `boolean`

True only for a rule that both fires and raises a query.

***

### result

> **result**: [`ConditionResult`](../../../types/type-aliases/ConditionResult.md)

***

### ruleId

> **ruleId**: `string`

***

### ruleName

> **ruleName**: `string`

***

### targetFieldId

> **targetFieldId**: `string`
