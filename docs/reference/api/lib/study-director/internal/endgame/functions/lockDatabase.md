[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/study-director/internal/endgame](../README.md) / lockDatabase

# Function: lockDatabase()

> **lockDatabase**(`state`): `object`

Locks the database. Queries still open at lock cost days and integrity, so
a backlog the player ignored comes due here.

## Parameters

### state

[`StudyState`](../../../types/interfaces/StudyState.md)

## Returns

`object`

### state

> **state**: [`StudyState`](../../../types/interfaces/StudyState.md)

### summary

> **summary**: [`LockSummary`](../../../types/interfaces/LockSummary.md)
