[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dungeon/route](../README.md) / RouteMapStep

# Interface: RouteMapStep

One step of the route map.

## Properties

### rooms

> `readonly` **rooms**: readonly [`RouteMapRoom`](RouteMapRoom.md)[]

The rooms at this step; empty for an undrawn step ahead.

***

### state

> `readonly` **state**: `"current"` \| `"cleared"` \| `"choice"` \| `"ahead"`

`cleared` for rooms already behind the player, `current` for the room
just played, `choice` for the next step's options and `ahead` for later
steps: a known boss, or no rooms when the route has not reached it.

***

### step

> `readonly` **step**: `number`

Zero-based position in the run.
