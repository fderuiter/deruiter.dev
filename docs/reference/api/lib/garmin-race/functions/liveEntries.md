[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/garmin-race](../README.md) / liveEntries

# Function: liveEntries()

> **liveEntries**(`board`, `seed`): [`BoardEntry`](../interfaces/BoardEntry.md)[]

The entries of `board` that still count for `seed` at the current
[COURSE\_VERSION](../variables/COURSE_VERSION.md): an older version or another day's Daily seed is a
different course, so it starts a fresh board.

## Parameters

### board

readonly [`BoardEntry`](../interfaces/BoardEntry.md)[]

### seed

`number`

## Returns

[`BoardEntry`](../interfaces/BoardEntry.md)[]
