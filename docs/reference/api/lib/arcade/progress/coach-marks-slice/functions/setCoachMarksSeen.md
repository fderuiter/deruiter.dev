[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/arcade/progress/coach-marks-slice](../README.md) / setCoachMarksSeen

# Function: setCoachMarksSeen()

> **setCoachMarksSeen**(`gameId`, `seen?`): `boolean`

Records a game's coach marks as seen or, with `seen` false, clears the
record so they show again on the next run ("Show tips again").

## Parameters

### gameId

`string`

The game's registry slug.

### seen?

`boolean` = `true`

Whether the tips have been seen. Defaults to true.

## Returns

`boolean`

True when the record reached localStorage.
