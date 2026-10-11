[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/for-better-or-bulk/types](../README.md) / Frame

# Interface: Frame

The inputs for one tick, plus the brothers decision when one is made.

## Properties

### assisted?

> `readonly` `optional` **assisted?**: [`PlayerId`](../type-aliases/PlayerId.md)

In solo play, the person the player is not controlling this tick. The
solo assist acts for them only when the setup turns it on and their input
here is idle.

***

### decision?

> `readonly` `optional` **decision?**: [`PresenceDecision`](PresenceDecision.md)

***

### inputs

> `readonly` **inputs**: `Readonly`\<`Record`\<[`PlayerId`](../type-aliases/PlayerId.md), [`PlayerInput`](PlayerInput.md)\>\>
