[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dx/trackers](../README.md) / TrackerReport

# Interface: TrackerReport

## Properties

### claims

> **claims**: [`ClaimCount`](ClaimCount.md)[]

***

### drift

> **drift**: [`ChecklistDrift`](ChecklistDrift.md)[]

***

### epics

> **epics**: `number`[]

***

### repo

> **repo**: `string`

***

### staleClaims

> **staleClaims**: [`StaleClaim`](StaleClaim.md)[] \| `null`

Stale claims, or null when claim activity could not be read.

***

### unresolved

> **unresolved**: `number`[]

Checklist references that could not be resolved to an issue state.
