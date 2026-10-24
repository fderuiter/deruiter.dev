[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/tlf/plan](../README.md) / reportedVisits

# Function: reportedVisits()

> **reportedVisits**(`definition`): `object`

The visits the change-from-baseline table reports: the baseline visit (the
first planned on or after day 1) and every later visit, in schedule order.

## Parameters

### definition

[`StudyDefinition`](../../../../types/interfaces/StudyDefinition.md)

## Returns

`object`

### baseline

> `readonly` **baseline**: [`VisitDefinition`](../../../../types/interfaces/VisitDefinition.md)

### post

> `readonly` **post**: readonly [`VisitDefinition`](../../../../types/interfaces/VisitDefinition.md)[]
