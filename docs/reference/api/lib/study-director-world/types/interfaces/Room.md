[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-director-world/types](../README.md) / Room

# Interface: Room

A room: a named rectangle of floor and what it is for.

## Properties

### anchor

> **anchor**: [`TilePoint`](TilePoint.md)

Where the directory walks the player to when the room is chosen.

***

### blurb

> **blurb**: `string`

One sentence the room description starts with.

***

### bounds

> **bounds**: `object`

Interior rectangle in tiles, walls excluded.

#### height

> **height**: `number`

#### width

> **width**: `number`

#### x

> **x**: `number`

#### y

> **y**: `number`

***

### department?

> `optional` **department?**: [`TeamRole`](../../../study-director/types/type-aliases/TeamRole.md)

The team role whose desks are here, for department rooms.

***

### id

> **id**: [`RoomId`](../type-aliases/RoomId.md)

***

### name

> **name**: `string`

***

### seats

> **seats**: [`TilePoint`](TilePoint.md)[]

Floor tiles beside the desks where the department's people stand.
