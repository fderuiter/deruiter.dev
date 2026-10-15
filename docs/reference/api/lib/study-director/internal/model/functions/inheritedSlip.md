[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/study-director/internal/model](../README.md) / inheritedSlip

# Function: inheritedSlip()

> **inheritedSlip**(`state`): `number`

Days of slip a study started with and cannot win back (#2192): a rescue's
inherited delay, none otherwise. A decision that pulls the schedule in
recovers only slip this study has added, so committing to an earlier lock
no longer erased a rescue's six-day head start and left a careful rescue
finishing beside a calm study.

## Parameters

### state

[`StudyState`](../../../types/interfaces/StudyState.md)

## Returns

`number`
