[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/arcade/daily-store](../README.md) / recordArcadeDailyResult

# Function: recordArcadeDailyResult()

> **recordArcadeDailyResult**(`game`, `date`, `result`, `now?`): `boolean`

Records a finished daily run for a game and tells the hub. Returns false
when the run does not count (an old date) or storage is blocked; the game
plays the same either way.

## Parameters

### game

`"trial-and-error"` \| `"for-better-or-bulk"` \| `"study-director"` \| `"patty-drive-thru"` \| `"protocol-drift"`

### date

`string`

### result

[`ArcadeDailyResult`](../../daily/interfaces/ArcadeDailyResult.md)

### now?

`number` = `...`

## Returns

`boolean`
