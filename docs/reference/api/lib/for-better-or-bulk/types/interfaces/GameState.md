[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/for-better-or-bulk/types](../README.md) / GameState

# Interface: GameState

## Properties

### brothersAt

> `readonly` **brothersAt**: `number` \| `null`

Level time the brothers' text landed, once it has.

***

### burntBatches

> `readonly` **burntBatches**: `number`

***

### duration

> `readonly` **duration**: `number`

***

### finishedAt

> `readonly` **finishedAt**: `number` \| `null`

Level time at which everything planned was done, if before the end.

***

### firstFilledAt

> `readonly` **firstFilledAt**: `number` \| `null`

Level time the first target became full, if one has.

***

### floor

> `readonly` **floor**: readonly [`FloorItem`](FloorItem.md)[]

***

### interruptions

> `readonly` **interruptions**: readonly [`InterruptionRecord`](InterruptionRecord.md)[]

***

### phase

> `readonly` **phase**: [`Phase`](../type-aliases/Phase.md)

***

### players

> `readonly` **players**: `Readonly`\<`Record`\<[`PlayerId`](../type-aliases/PlayerId.md), [`Player`](Player.md)\>\>

***

### presence

> `readonly` **presence**: [`PresenceDecision`](PresenceDecision.md) \| `null`

***

### returnsAt

> `readonly` **returnsAt**: `number` \| `null`

When Fred is due back, in level seconds, while he is away.

***

### setup

> `readonly` **setup**: [`Setup`](Setup.md)

***

### stations

> `readonly` **stations**: readonly [`Station`](Station.md)[]

***

### stock

> `readonly` **stock**: `Readonly`\<`Record`\<[`SupplyKind`](../type-aliases/SupplyKind.md), `number`\>\>

What is left in the car and shed, by kind.

***

### supplies

> `readonly` **supplies**: readonly [`Supply`](Supply.md)[]

***

### targets

> `readonly` **targets**: readonly [`Target`](Target.md)[]

***

### tick

> `readonly` **tick**: `number`

***

### time

> `readonly` **time**: `number`

Seconds since 9:00 in game time; the level ends at `duration`.
