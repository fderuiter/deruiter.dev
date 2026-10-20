[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/arcade/run-snapshot](../README.md) / RunSnapshotFormat

# Interface: RunSnapshotFormat\<State\>

How a game reads its snapshot back.

## Type Parameters

### State

`State`

## Properties

### schema

> `readonly` **schema**: `number`

The schema version this build writes and accepts.

***

### state

> `readonly` **state**: `ZodType`\<`State`\>

Parses the stored `state`. A failed parse discards the save.
