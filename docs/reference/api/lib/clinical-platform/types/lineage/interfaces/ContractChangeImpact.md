[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/lineage](../README.md) / ContractChangeImpact

# Interface: ContractChangeImpact

What a change between two releases of a data contract reaches through the
lineage graph, and who to tell (#2637). Used to review a contract change
(#2626) before it is released.

## Properties

### changed

> `readonly` **changed**: readonly `string`[]

Lineage node ids of the columns that changed or were removed, by id.

***

### downstream

> `readonly` **downstream**: readonly [`LineageReach`](LineageReach.md)[]

Every node downstream of a changed column, nearest first, then by id.

***

### from

> `readonly` **from**: `string`

Version of the earlier release.

***

### notify

> `readonly` **notify**: readonly `object`[]

Roles accountable for a downstream node, each with the nodes they own, by role.

***

### productId

> `readonly` **productId**: `string`

***

### to

> `readonly` **to**: `string`

Version of the later release.
