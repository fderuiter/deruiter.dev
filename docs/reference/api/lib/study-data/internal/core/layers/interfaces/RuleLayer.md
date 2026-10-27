[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/core/layers](../README.md) / RuleLayer

# Interface: RuleLayer

One rule family in the matrix.

## Properties

### author

> `readonly` **author**: `string`

Who wrote the rules.

***

### evidence

> `readonly` **evidence**: readonly [`LayerEvidence`](LayerEvidence.md)[]

***

### explainedFailures?

> `readonly` `optional` **explainedFailures?**: `number`

Failing rules whose every finding has a recorded explanation.

***

### id

> `readonly` **id**: `string`

***

### note

> `readonly` **note**: `string`

***

### outcomes

> `readonly` **outcomes**: `Readonly`\<`Partial`\<`Record`\<[`RuleState`](../type-aliases/RuleState.md), `number`\>\>\>

Items by state. Empty when the layer is one state as a whole.

***

### runBy

> `readonly` **runBy**: `string`

What runs them, and when.

***

### scope

> `readonly` **scope**: `string`

What they ran over.

***

### state?

> `readonly` `optional` **state?**: [`RuleState`](../type-aliases/RuleState.md)

The whole layer's state, when it has no per-item outcomes.

***

### title

> `readonly` **title**: `string`

***

### unit

> `readonly` **unit**: `"check"` \| `"rule"`

What each counted item is.
