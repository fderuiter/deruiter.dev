[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/visit-window](../README.md) / calculateBaselineDrift

# Function: calculateBaselineDrift()

> **calculateBaselineDrift**(`currentVisits`, `baselineVisits?`, `baselineLabel?`): [`BaselineDriftComparison`](../interfaces/BaselineDriftComparison.md)

Calculates cumulative schedule drift compared against a baseline snapshot.
Falls back gracefully when no baseline snapshot exists.

## Parameters

### currentVisits

[`StudyVisit`](../../types/interfaces/StudyVisit.md)[]

### baselineVisits?

[`StudyVisit`](../../types/interfaces/StudyVisit.md)[]

### baselineLabel?

`string`

## Returns

[`BaselineDriftComparison`](../interfaces/BaselineDriftComparison.md)
