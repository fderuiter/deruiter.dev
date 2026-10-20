[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/garmin/plan](../README.md) / PlanNode

# Interface: PlanNode

One node of the map.

## Properties

### col

> **col**: `number`

Map column, 0 to 3.

***

### day

> **day**: `string`

The calendar day it sits on, e.g. "Wednesday".

***

### id

> **id**: [`PlanNodeId`](../type-aliases/PlanNodeId.md)

***

### kind

> **kind**: [`PlanNodeKind`](../type-aliases/PlanNodeKind.md)

***

### name

> **name**: `string`

***

### next

> **next**: readonly [`PlanNodeId`](../type-aliases/PlanNodeId.md)[]

The nodes clearing this one opens.

***

### row

> **row**: `number`

Map row: 0 for week 1, 1 for week 2.

***

### stage

> **stage**: `number` \| `null`

The stage a workout plays; null for a hut.

***

### week

> **week**: `number`

The week it sits in, 1 or 2.
