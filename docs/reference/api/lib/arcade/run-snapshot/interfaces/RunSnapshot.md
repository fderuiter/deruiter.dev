[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/arcade/run-snapshot](../README.md) / RunSnapshot

# Interface: RunSnapshot\<State\>

One versioned run snapshot per game (ADR 0062). A live view swap, the save
when the page hides and Resume on the next visit all read and write this
one envelope under [runSnapshotKey](../functions/runSnapshotKey.md).

## Type Parameters

### State

`State`

## Properties

### savedAt

> `readonly` **savedAt**: `number`

When the run was saved, in milliseconds since the epoch.

***

### schema

> `readonly` **schema**: `number`

The game's own state version. Bump it on any change to `state`.

***

### state

> `readonly` **state**: `State`

The run itself, as plain data from the session's `snapshot()`.

***

### tuning

> `readonly` **tuning**: `Readonly`\<`Record`\<`string`, `number` \| `boolean`\>\>

The input tuning the run played with, such as touch assist strengths.

***

### view

> `readonly` **view**: [`FormFactor`](../../form-factor/type-aliases/FormFactor.md)

The view that was playing, which labels the run for score records.
