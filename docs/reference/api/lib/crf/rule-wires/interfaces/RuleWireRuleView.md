[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/rule-wires](../README.md) / RuleWireRuleView

# Interface: RuleWireRuleView

One rule projected into wires.

## Properties

### actionType

> **actionType**: `string`

***

### groupLogicalOperator?

> `optional` **groupLogicalOperator?**: `"AND"` \| `"OR"`

***

### groups

> **groups**: [`RuleWireGroup`](RuleWireGroup.md)[]

***

### ownedKeys

> **ownedKeys**: keyof [`EditCheckRule`](../../types/interfaces/EditCheckRule.md)[]

Which wire-owned keys were present on the rule, so absent stays absent.

***

### passthrough

> **passthrough**: `Partial`\<[`EditCheckRule`](../../types/interfaces/EditCheckRule.md)\>

Everything the wire view does not own (name, query text, formula,
preserved unsupported expressions, and the legacy flat mirror of a
grouped rule), carried through untouched.

***

### readOnlyReason?

> `optional` **readOnlyReason?**: `string`

***

### representation

> **representation**: `"legacy"` \| `"grouped"`

"grouped" when the rule carries explicit conditionGroups.

***

### ruleId

> **ruleId**: `string`

***

### ruleName

> **ruleName**: `string`

***

### sentence

> **sentence**: `string`

The natural-language rendering, identical to describeRuleLogic.

***

### supported

> **supported**: `boolean`

False when the whole rule must be shown read-only.

***

### targetFieldId

> **targetFieldId**: `string`

***

### triggerFieldIds

> **triggerFieldIds**: `string`[]

***

### wires

> **wires**: [`RuleWire`](RuleWire.md)[]
