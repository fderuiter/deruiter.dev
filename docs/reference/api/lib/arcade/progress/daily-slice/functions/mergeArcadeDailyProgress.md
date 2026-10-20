[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/arcade/progress/daily-slice](../README.md) / mergeArcadeDailyProgress

# Function: mergeArcadeDailyProgress()

> **mergeArcadeDailyProgress**(`a`, `b`): [`ArcadeDailyProgress`](../../../daily/interfaces/ArcadeDailyProgress.md)

The `arcade.daily` join (design §5): per game and date the better result,
the union of played dates, and the longest streak as the larger of the
stored ones and the one recomputed from the union.

## Parameters

### a

[`ArcadeDailyProgress`](../../../daily/interfaces/ArcadeDailyProgress.md)

One copy.

### b

[`ArcadeDailyProgress`](../../../daily/interfaces/ArcadeDailyProgress.md)

The other copy.

## Returns

[`ArcadeDailyProgress`](../../../daily/interfaces/ArcadeDailyProgress.md)

The merged record.
