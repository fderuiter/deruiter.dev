[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/explore](../README.md) / PromotionStep

# Interface: PromotionStep

One step of promoting an exploration to a higher report tier.

## Properties

### detail

> `readonly` **detail**: `string`

Why it is met, or what is still to do.

***

### id

> `readonly` **id**: `string`

Stable step id in kebab case.

***

### label

> `readonly` **label**: `string`

What the step asks for, in one sentence.

***

### status

> `readonly` **status**: `"met"` \| `"to-do"`

`met` when the spec already satisfies it; `to-do` when a person has to
act, such as naming an owner or signing off.

***

### tier

> `readonly` **tier**: `"managed"` \| `"certified"`

Tier the step is needed for.
