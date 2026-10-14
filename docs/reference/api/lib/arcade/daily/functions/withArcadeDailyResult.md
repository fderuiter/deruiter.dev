[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/arcade/daily](../README.md) / withArcadeDailyResult

# Function: withArcadeDailyResult()

> **withArcadeDailyResult**(`progress`, `game`, `date`, `result`, `today`): [`ArcadeDailyProgress`](../interfaces/ArcadeDailyProgress.md)

The record with a game's daily result added. Only today's or yesterday's
daily counts, so an old daily link replays its seed without changing the
streak or the bests. A result below the day's best keeps the best but
still marks the day played. Pure; returns the same record when nothing
counts.

## Parameters

### progress

[`ArcadeDailyProgress`](../interfaces/ArcadeDailyProgress.md)

### game

`"trial-and-error"` \| `"for-better-or-bulk"` \| `"study-director"` \| `"patty-drive-thru"` \| `"protocol-drift"`

### date

`string`

### result

[`ArcadeDailyResult`](../interfaces/ArcadeDailyResult.md)

### today

`string`

## Returns

[`ArcadeDailyProgress`](../interfaces/ArcadeDailyProgress.md)
