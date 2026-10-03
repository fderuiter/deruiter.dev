[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/rule-wires](../README.md) / configureWireRule

# Function: configureWireRule()

> **configureWireRule**(`rule`, `updates`): [`EditCheckRule`](../../types/interfaces/EditCheckRule.md)

Change rule-level configuration (action, target, query text, formula,
name) from the wire surface. Wire-owned condition keys are ignored here;
use the condition operations instead.

## Parameters

### rule

[`EditCheckRule`](../../types/interfaces/EditCheckRule.md)

### updates

`Partial`\<`Pick`\<[`EditCheckRule`](../../types/interfaces/EditCheckRule.md), `"actionType"` \| `"targetFieldId"` \| `"name"` \| `"querySeverity"` \| `"queryMessage"` \| `"formulaExpression"`\>\>

## Returns

[`EditCheckRule`](../../types/interfaces/EditCheckRule.md)
