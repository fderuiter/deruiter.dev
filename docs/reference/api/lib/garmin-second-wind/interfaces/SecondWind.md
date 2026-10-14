[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/garmin-second-wind](../README.md) / SecondWind

# Interface: SecondWind

A Second Wind in progress.

## Properties

### cleared

> **cleared**: `boolean`

The goal has been met (Night Run: only settled when the time runs out).

***

### kind

> **kind**: [`SecondWindKind`](../type-aliases/SecondWindKind.md)

***

### medalId?

> `optional` **medalId?**: `number`

The medal the event pays out, if not already found.

***

### msLeft

> **msLeft**: `number`

Time left, in ms.

***

### progress

> **progress**: `number`

Progress towards the goal: metres, Kudos, high fives, or hits taken.

***

### stage

> **stage**: `number`

The stage it belongs to; it ends with the stage.
