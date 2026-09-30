[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/visit-window](../README.md) / evaluateVisitWindowConflicts

# Function: evaluateVisitWindowConflicts()

> **evaluateVisitWindowConflicts**(`visits`, `armId?`): [`VisitConflictSummary`](../interfaces/VisitConflictSummary.md)

Evaluates visit target days and windows (windowBefore, windowAfter) in real time to detect overlaps.
Detects window overlaps where `targetDay_A + windowAfter_A >= targetDay_B - windowBefore_B`
for consecutive visits.

## Parameters

### visits

[`StudyVisit`](../../types/interfaces/StudyVisit.md)[]

### armId?

`string`

## Returns

[`VisitConflictSummary`](../interfaces/VisitConflictSummary.md)
