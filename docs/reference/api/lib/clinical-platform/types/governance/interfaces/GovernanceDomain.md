[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/governance](../README.md) / GovernanceDomain

# Interface: GovernanceDomain

A stewardship domain and the roles that own and steward its data (#2638).

## Properties

### id

> `readonly` **id**: [`GovernanceDomainId`](../type-aliases/GovernanceDomainId.md)

***

### name

> `readonly` **name**: `string`

***

### owners

> `readonly` **owners**: readonly `string`[]

Owner roles accountable for the domain's products and metrics.

***

### stewards

> `readonly` **stewards**: readonly `string`[]

Steward roles that look after their definitions and quality.

***

### summary

> `readonly` **summary**: `string`

What the domain's data describes, in one sentence.
