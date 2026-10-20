[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/arcade/run-snapshot](../README.md) / runSnapshotKey

# Function: runSnapshotKey()

> **runSnapshotKey**(`slug`): `string`

The storage key for a game's run snapshot, `arcade_run_<slug>_v1`. The
`_v1` names the envelope's own shape; a change to a game's state bumps its
`schema` instead. The optional `rngState` and `step` fields (#2544) were
added without a bump, because a v1 save without them still reads.

## Parameters

### slug

`string`

The game's id, such as `laser-loon`.

## Returns

`string`

The key.
