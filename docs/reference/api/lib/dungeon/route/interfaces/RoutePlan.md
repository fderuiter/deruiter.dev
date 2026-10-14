[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dungeon/route](../README.md) / RoutePlan

# Interface: RoutePlan

How a room library splits into a run.

## Properties

### bosses

> `readonly` **bosses**: readonly `number`[]

Library positions of the boss rooms that close every run, in order.

***

### length

> `readonly` **length**: `number`

Rooms in a run, start and bosses included.

***

### middle

> `readonly` **middle**: readonly `number`[]

Library positions the route picks from between the start and the bosses.

***

### middleSteps

> `readonly` **middleSteps**: `number`

How many middle rooms a run visits.

***

### start

> `readonly` **start**: `number`

Library position of the room every run opens on.
