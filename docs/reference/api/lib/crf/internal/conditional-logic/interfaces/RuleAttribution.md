[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/crf/internal/conditional-logic](../README.md) / RuleAttribution

# Interface: RuleAttribution

Why a field ended up visible, hidden or required - the specific rule
responsible, and the sentence explaining how it evaluated.

## Properties

### actionType

> **actionType**: [`ConditionalActionType`](../type-aliases/ConditionalActionType.md)

***

### result

> **result**: [`ConditionResult`](../../../types/type-aliases/ConditionResult.md)

Four-valued outcome of the rule's conditions.

***

### ruleId

> **ruleId**: `string`

***

### ruleName

> **ruleName**: `string`

***

### summary

> **summary**: `string`

Human-readable explanation drawn from the shared rule explainer.
