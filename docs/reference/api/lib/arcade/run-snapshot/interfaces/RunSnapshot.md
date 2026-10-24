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

### rngState?

> `readonly` `optional` **rngState?**: `number`

The gameplay stream's state at the save, from the session's
`rng.getState()` (#2544), so a restored run draws the same numbers and a
reload cannot re-roll a bad draw. Absent for a session without a seeded
stream and in saves written before it existed, which still read.

***

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

### step?

> `readonly` `optional` **step?**: `number`

The fixed-step count at the save, from the session's `clock.getStep()`
(#2544). Absent when the session has no step clock.

***

### tags?

> `readonly` `optional` **tags?**: [`RunTags`](../../run-tags/interfaces/RunTags.md)

Every view and input the run has used and the assists it reached
(#2547), so a resumed run keeps its ratchet and its score is labelled
honestly. Absent in saves written before it existed, which still read.

***

### tuning

> `readonly` **tuning**: `Readonly`\<`Record`\<`string`, `number` \| `boolean`\>\>

The input tuning the run played with, such as touch assist strengths.

***

### view

> `readonly` **view**: [`FormFactor`](../../form-factor/type-aliases/FormFactor.md)

The view that was playing, which labels the run for score records.
