[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-platform/types](../README.md) / LineageImpact

# Interface: LineageImpact

What a change to one node reaches, and who to tell (#2637).

## Properties

### downstream

> `readonly` **downstream**: readonly [`LineageReach`](LineageReach.md)[]

Every downstream node, nearest first, then by id.

***

### notify

> `readonly` **notify**: readonly `object`[]

Roles accountable for a downstream node, each with the nodes they own, by role.

***

### origin

> `readonly` **origin**: `string`
