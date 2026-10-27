[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/crf/internal/expression-evaluator](../README.md) / getRuleGroups

# Function: getRuleGroups()

> **getRuleGroups**(`rule`): `object`

Normalizes a rule's conditions into explicit groups: `conditionGroups`
when present (#540), otherwise the legacy flat `conditions`/
`logicalOperator` wrapped as a single group, so evaluation and
explanation only ever need to handle one shape.

## Parameters

### rule

[`EditCheckRule`](../../../types/interfaces/EditCheckRule.md)

## Returns

`object`

### groupLogicalOperator

> **groupLogicalOperator**: `"AND"` \| `"OR"`

### groups

> **groups**: [`ConditionGroup`](../../../types/interfaces/ConditionGroup.md)[]
