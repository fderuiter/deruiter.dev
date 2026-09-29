[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/laser-loon/engine](../README.md) / BossAttackResult

# Interface: BossAttackResult

The result of advancing a boss's attack pattern by one frame.

## Properties

### enteredPhaseTwo

> **enteredPhaseTwo**: `boolean`

True on the frame the boss enters phase 2.

***

### fired

> **fired**: `boolean`

True on the frame a volley leaves the boss.

***

### nextId

> **nextId**: `number`

The next free target id.

***

### targets

> **targets**: [`Target`](../../types/interfaces/Target.md)[]

The targets with the boss updated and any volley shots appended.
