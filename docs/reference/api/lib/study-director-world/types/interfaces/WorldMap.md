[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-director-world/types](../README.md) / WorldMap

# Interface: WorldMap

A walkable map: ASCII rows plus the rooms and stations drawn on it.

## Properties

### height

> **height**: `number`

***

### id

> **id**: `string`

***

### name?

> `optional` **name?**: `string`

What the map is called on screen; the CRO floor leaves it out.

***

### rooms

> **rooms**: readonly [`Room`](Room.md)[]

***

### rows

> **rows**: readonly `string`[]

One string per row, `width` characters each.

***

### spawn

> **spawn**: [`PlayerState`](PlayerState.md)

Where the player stands on arrival.

***

### stations

> **stations**: readonly [`Station`](Station.md)[]

***

### width

> **width**: `number`
