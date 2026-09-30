[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/stakes](../README.md) / StakeLevel

# Interface: StakeLevel

One rung of the ladder: the rule it adds on top of the ones below.

## Properties

### id

> **id**: `"ROUTINE_MONITORING"` \| `"SPONSOR_AUDIT"` \| `"FOR_CAUSE_AUDIT"` \| `"REGULATORY_INSPECTION"` \| `"FORM_483_ISSUED"` \| `"WARNING_LETTER"`

***

### modifier

> **modifier**: `Partial`\<[`StakeModifiers`](StakeModifiers.md)\>

The modifiers this stake sets.

***

### name

> **name**: `string`

***

### rule

> **rule**: `string`

The rule this stake adds, in one line.

***

### stake

> **stake**: `number`
