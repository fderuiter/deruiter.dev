[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-director-world/types](../README.md) / PersonPlacement

# Interface: PersonPlacement

Where a team member is on the floor. Today everyone stands at their
department desk; NPC schedules (#1688) supply placements of their own.

## Extends

- [`TilePoint`](TilePoint.md)

## Properties

### activity?

> `optional` **activity?**: [`PersonActivity`](../type-aliases/PersonActivity.md)

What the person is doing, when a schedule placed them (#1688).

***

### facing

> **facing**: `"up"` \| `"down"` \| `"left"` \| `"right"`

***

### memberId

> **memberId**: `string`

***

### name

> **name**: `string`

***

### role

> **role**: [`TeamRole`](../../../study-director/types/type-aliases/TeamRole.md)

***

### room

> **room**: [`RoomId`](../type-aliases/RoomId.md)

***

### x

> **x**: `number`

#### Inherited from

[`TilePoint`](TilePoint.md).[`x`](TilePoint.md#x)

***

### y

> **y**: `number`

#### Inherited from

[`TilePoint`](TilePoint.md).[`y`](TilePoint.md#y)
