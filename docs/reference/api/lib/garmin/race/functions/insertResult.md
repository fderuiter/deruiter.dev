[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/garmin/race](../README.md) / insertResult

# Function: insertResult()

> **insertResult**(`board`, `entry`): `object`

Adds `entry` to `board` (after [liveEntries](liveEntries.md)), fastest first, capped
at [BOARD\_SIZE](../variables/BOARD_SIZE.md). Returns the new board and the entry's place (1-based),
or 0 when it did not make the board.

## Parameters

### board

readonly [`BoardEntry`](../interfaces/BoardEntry.md)[]

### entry

[`BoardEntry`](../interfaces/BoardEntry.md)

## Returns

`object`

### board

> **board**: [`BoardEntry`](../interfaces/BoardEntry.md)[]

### place

> **place**: `number`
