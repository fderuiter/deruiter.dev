[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/table](../README.md) / AmendmentPreview

# Interface: AmendmentPreview

What using a SAP Amendment would do, for the confirm step (#1086).

## Properties

### bonus

> **bonus**: `object`

+Mult a correction against the rule earns, before and after.

#### from

> **from**: `number`

#### to

> **to**: `number`

***

### consumableId

> **consumableId**: `string`

***

### description

> **description**: `string`

***

### fromId

> **fromId**: `string`

The rulebook in force now, and the one using it puts in force.

***

### name

> **name**: `string`

***

### penalty

> **penalty**: `object`

+Mult a standing redline against the rule costs, before and after.

#### from

> **from**: `number`

#### to

> **to**: `number`

***

### refusal

> **refusal**: `string` \| `null`

Why it cannot be used now, or null.

***

### ruleId

> **ruleId**: `string` \| `null`

The rule it amends, e.g. "SAP-DM-03", and its category's label.

***

### ruleLabel

> **ruleLabel**: `string`

***

### staled

> **staled**: `object`[]

The outputs in hand compiled under `fromId`, which go stale, in hand order.

#### cardId

> **cardId**: `string`

#### name

> **name**: `string`

***

### toId

> **toId**: `string`
