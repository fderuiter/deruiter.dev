[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/rule-wires](../README.md) / RuleWire

# Interface: RuleWire

One drawable, listable source-to-target connection.

## Properties

### actionType

> **actionType**: `string`

***

### condition?

> `optional` **condition?**: [`AstCondition`](../../types/interfaces/AstCondition.md)

A copy of the condition this wire carries, for condition wires.

***

### conditionIndex?

> `optional` **conditionIndex?**: `number`

***

### description

> **description**: `string`

A complete sentence describing the connection, for lists and screen readers.

***

### editable

> **editable**: `boolean`

***

### groupId?

> `optional` **groupId?**: `string`

Present for condition and comparison wires.

***

### groupIndex?

> `optional` **groupIndex?**: `number`

***

### id

> **id**: `string`

Derived only from the rule id, the group id and the condition's position
in that group, never from layout or selection, so a wire keeps its id
when the canvas is resized or a different field is selected.

***

### readOnlyReason?

> `optional` **readOnlyReason?**: `string`

Why this wire is read-only, when it is.

***

### role

> **role**: [`RuleWireRole`](../type-aliases/RuleWireRole.md)

***

### ruleId

> **ruleId**: `string`

***

### sourceFieldId

> **sourceFieldId**: `string`

Field id (or variable name) exactly as the rule references it.

***

### targetFieldId

> **targetFieldId**: `string`
