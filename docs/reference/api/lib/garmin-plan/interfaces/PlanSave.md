[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/garmin-plan](../README.md) / PlanSave

# Interface: PlanSave

A Training Plan in progress: everything the save keeps.

## Properties

### bag

> **bag**: [`GearItem`](../type-aliases/GearItem.md)[]

***

### cards

> **cards**: [`FinisherCard`](../../garmin-engine/type-aliases/FinisherCard.md)[]

Finisher Cards collected towards the next set of three (#1996).

***

### cleared

> **cleared**: [`PlanNodeId`](../type-aliases/PlanNodeId.md)[]

Nodes cleared: workouts finished and huts visited.

***

### continues

> **continues**: `number`

***

### cursor

> **cursor**: [`PlanNodeId`](../type-aliases/PlanNodeId.md)

The node the map cursor is on.

***

### dnfs

> **dnfs**: `number`

DNFs since the last cleared workout.

***

### finished

> **finished**: `boolean`

Race Day has been won: the finisher medal.

***

### huts

> **huts**: `Partial`\<`Record`\<[`PlanNodeId`](../type-aliases/PlanNodeId.md), [`GearItem`](../type-aliases/GearItem.md)\>\>

The item taken at each visited hut.

***

### lastTe

> **lastTe**: `number` \| `null`

Training Effect of the last cleared workout, if any.

***

### lives

> **lives**: `number`

***

### packed

> **packed**: [`GearItem`](../type-aliases/GearItem.md)[]

Items out of the bag, packed for the next workout (#1995).

***

### score

> **score**: `number`

Points from every workout cleared.

***

### seed

> **seed**: `number`

Shuffles what each hut hides.

***

### unlocked

> **unlocked**: [`PlanNodeId`](../type-aliases/PlanNodeId.md)[]

Nodes a Rest Day opened without clearing the workout before them (#1995).
