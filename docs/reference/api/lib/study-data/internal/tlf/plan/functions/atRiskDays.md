[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/tlf/plan](../README.md) / atRiskDays

# Function: atRiskDays()

> **atRiskDays**(`definition`): readonly `object`[]

The days of the number-at-risk table: the scheduled day of every visit on
or after day 1, in schedule order. AVAL counts the first-dose day as day
1, so a subject is at risk on day t when AVAL is t or later.

## Parameters

### definition

[`StudyDefinition`](../../../../types/interfaces/StudyDefinition.md)

## Returns

readonly `object`[]
