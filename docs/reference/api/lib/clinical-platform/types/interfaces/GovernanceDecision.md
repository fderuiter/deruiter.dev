[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-platform/types](../README.md) / GovernanceDecision

# Interface: GovernanceDecision

A key governance decision and who does what in it (#2638).

## Properties

### id

> `readonly` **id**: [`GovernanceDecisionId`](../type-aliases/GovernanceDecisionId.md)

***

### name

> `readonly` **name**: `string`

***

### policy

> `readonly` **policy**: [`GovernancePolicyId`](../type-aliases/GovernancePolicyId.md)

The policy the decision applies.

***

### raci

> `readonly` **raci**: `Readonly`\<`Record`\<[`StewardshipRoleId`](../type-aliases/StewardshipRoleId.md), [`RaciCode`](../type-aliases/RaciCode.md) \| `null`\>\>

Each role's part, or `null` for a role with none.

***

### when

> `readonly` **when**: `string`

When the decision is needed, in one sentence.
