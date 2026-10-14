[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/garmin-race-store](../README.md) / saveResult

# Function: saveResult()

> **saveResult**(`setup`, `timeMs`, `date`): `object`

Adds a judged time to its board and returns the new board with the result's
place (1-based, or 0 when it missed the top [BOARD\_SIZE](../../garmin-race/variables/BOARD_SIZE.md)). Never throws.

## Parameters

### setup

[`RaceSetup`](../../garmin-race/interfaces/RaceSetup.md)

### timeMs

`number`

### date

`Date`

## Returns

`object`

### board

> **board**: [`BoardEntry`](../../garmin-race/interfaces/BoardEntry.md)[]

### place

> **place**: `number`
