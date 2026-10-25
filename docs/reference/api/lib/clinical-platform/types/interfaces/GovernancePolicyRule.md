[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-platform/types](../README.md) / GovernancePolicyRule

# Interface: GovernancePolicyRule

One rule of a governance policy (#2638).

## Properties

### appliedBy

> `readonly` **appliedBy**: `string` \| `null`

Name of the `@/lib/clinical-platform` export that applies the rule, a
check or the derivation that produces the governed value, or `null` for
a rule a person applies in review.

***

### text

> `readonly` **text**: `string`

The rule, in one or two sentences.
