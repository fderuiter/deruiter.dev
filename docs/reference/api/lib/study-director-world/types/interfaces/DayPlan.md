[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-director-world/types](../README.md) / DayPlan

# Interface: DayPlan

The player's plan for one day.

## Properties

### day

> **day**: `number`

***

### excused?

> `optional` **excused?**: `string`[]

Ids that came while the player was away, held against nobody (#2189).

***

### handled

> **handled**: `string`[]

Ids of today's interruptions the player has dealt with.

***

### priority

> **priority**: `"desk"` \| `"sites"` \| `"people"` \| `null`

***

### queriesClosed?

> `optional` **queriesClosed?**: `number`

Queries the player closed at the EDC today, for the wrap-up (#2253).
