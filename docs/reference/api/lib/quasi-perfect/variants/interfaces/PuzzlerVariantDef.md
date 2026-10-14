[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/quasi-perfect/variants](../README.md) / PuzzlerVariantDef

# Interface: PuzzlerVariantDef

One constrained replay of a level, unlocked once it is proved honestly.

## Properties

### bannedTactic?

> `optional` **bannedTactic?**: [`TacticId`](../../types/type-aliases/TacticId.md)

The tactic removed from the hand (banned variants only).

***

### kind

> **kind**: [`PuzzlerVariantKind`](../../types/type-aliases/PuzzlerVariantKind.md)

***

### levelId

> **levelId**: `number`

***

### referenceProof

> **referenceProof**: readonly [`TacticId`](../../types/type-aliases/TacticId.md)[]

A proof that clears the variant, checked through the tactic engine.

***

### rule

> **rule**: `string`

The rule in one sentence, as the board states it.

***

### startingRam?

> `optional` **startingRam?**: `number`

Fixed starting RAM in GB, in either mode (tight RAM only).

***

### stepLimit?

> `optional` **stepLimit?**: `number`

Most tactics the proof may apply (step limit only).

***

### title

> **title**: `string`

Short name for the picker, such as "No linarith".
