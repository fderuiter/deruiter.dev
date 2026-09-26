[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/laser-loon/engine](../README.md) / LoonCollisionResult

# Interface: LoonCollisionResult

## Properties

### contact

> **contact**: \{ `x`: `number`; `y`: `number`; \} \| `null`

Where the contact happened, for effects.

***

### hitsLeft

> **hitsLeft**: `number`

***

### invulnerableUntil

> **invulnerableUntil**: `number`

***

### outcome

> **outcome**: `"none"` \| `"hit"` \| `"blocked"`

"hit" costs a hit, "blocked" was absorbed by the Pronto Pup shield.

***

### targets

> **targets**: [`Target`](../../types/interfaces/Target.md)[]

Targets after contact: a regular enemy that touches the loon is knocked out.
