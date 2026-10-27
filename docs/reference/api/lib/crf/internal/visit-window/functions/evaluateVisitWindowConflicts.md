[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/crf/internal/visit-window](../README.md) / evaluateVisitWindowConflicts

# Function: evaluateVisitWindowConflicts()

> **evaluateVisitWindowConflicts**(`visits`, `armId?`): [`VisitConflictSummary`](../interfaces/VisitConflictSummary.md)

Evaluates visit target days and windows (windowBefore, windowAfter) in real time to detect overlaps.
Detects window overlaps where `targetDay_A + windowAfter_A >= targetDay_B - windowBefore_B`
for consecutive visits.

Unscheduled visits happen whenever a site needs them, so their target day
is a placeholder rather than a place on the timeline; they are left out.

## Parameters

### visits

[`StudyVisit`](../../../types/interfaces/StudyVisit.md)[]

### armId?

`string`

## Returns

[`VisitConflictSummary`](../interfaces/VisitConflictSummary.md)
