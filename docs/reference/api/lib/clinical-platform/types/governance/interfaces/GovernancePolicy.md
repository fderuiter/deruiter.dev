[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/governance](../README.md) / GovernancePolicy

# Interface: GovernancePolicy

A governance policy, written as data so a page and a test read the same rules (#2638).

## Properties

### id

> `readonly` **id**: [`GovernancePolicyId`](../type-aliases/GovernancePolicyId.md)

***

### purpose

> `readonly` **purpose**: `string`

What the policy is for, in one sentence.

***

### rules

> `readonly` **rules**: readonly [`GovernancePolicyRule`](GovernancePolicyRule.md)[]

***

### title

> `readonly` **title**: `string`
