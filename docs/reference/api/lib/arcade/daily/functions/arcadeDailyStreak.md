[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/arcade/daily](../README.md) / arcadeDailyStreak

# Function: arcadeDailyStreak()

> **arcadeDailyStreak**(`progress`, `today`): [`ArcadeDailyStreak`](../interfaces/ArcadeDailyStreak.md)

The streak on `today`: consecutive days with a daily played, ending today,
or ending yesterday while today is still unplayed (so the streak lives
until a whole UTC day is missed). `longest` is the best ever, at least the
current streak.

## Parameters

### progress

`Pick`\<[`ArcadeDailyProgress`](../interfaces/ArcadeDailyProgress.md), `"played"` \| `"longest"`\>

### today

`string`

## Returns

[`ArcadeDailyStreak`](../interfaces/ArcadeDailyStreak.md)
