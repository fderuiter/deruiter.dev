[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/meme-echo](../README.md) / EchoRound

# Interface: EchoRound

One Echo round. Treat it as immutable: every transition returns a copy.

## Properties

### expectedPad

> **expectedPad**: `number` \| `null`

The pad the vault expected when the round ended, or null.

***

### inputIndex

> **inputIndex**: `number`

How many pads of the current sequence the player has repeated.

***

### phase

> **phase**: [`EchoPhase`](../type-aliases/EchoPhase.md)

***

### seed

> **seed**: `string`

Seed the pad sequence is drawn from.

***

### sequence

> **sequence**: readonly `number`[]

Pad indices (0 to 7) the vault plays, in order.

***

### streak

> **streak**: `number`

Sequences repeated in full this round.
