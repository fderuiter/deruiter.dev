[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/patty-drive-thru/internal/dilemmas](../README.md) / dealWeekDilemmas

# Function: dealWeekDilemmas()

> **dealWeekDilemmas**(`weekSeed`, `days`): [`DilemmaId`](../../../types/type-aliases/DilemmaId.md)[][]

Deals a week's dilemmas (#2139): the shuffled shared dilemmas, three a day
from Monday, with each day's own dilemma in the middle of its three. No
dilemma comes up twice in a week.

## Parameters

### weekSeed

`string`

The week's seed; the same seed always deals the same.

### days

readonly [`WeekdayId`](../../../types/type-aliases/WeekdayId.md)[]

The weekdays in order.

## Returns

[`DilemmaId`](../../../types/type-aliases/DilemmaId.md)[][]

One deck per day, in the order of `days`.
