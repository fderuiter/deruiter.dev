[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/visit-window](../README.md) / VisitConflictSummary

# Interface: VisitConflictSummary

## Properties

### conflicts

> **conflicts**: [`VisitWindowConflict`](VisitWindowConflict.md)[]

Flat list of all detected conflicts

***

### conflictsByVisitId

> **conflictsByVisitId**: `Record`\<`string`, [`VisitWindowConflict`](VisitWindowConflict.md)[]\>

Map of visitId -> array of conflicts involving this visit

***

### hasConflicts

> **hasConflicts**: `boolean`

True if one or more window conflicts exist

***

### totalConflicts

> **totalConflicts**: `number`

Total number of overlapping visit pairs detected
