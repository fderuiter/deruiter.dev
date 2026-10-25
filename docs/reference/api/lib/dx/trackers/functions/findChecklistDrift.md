[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dx/trackers](../README.md) / findChecklistDrift

# Function: findChecklistDrift()

> **findChecklistDrift**(`epics`, `states`): `object`

Compares each epic's checklist with the state of the issues it names.

An unticked line whose issue is closed is drift. A ticked line whose issue
is still open is reported too, since it is drift unless the line covers
only part of that issue, which a person can tell at a glance.

## Parameters

### epics

readonly `Pick`\<[`TrackerIssue`](../interfaces/TrackerIssue.md), `"number"` \| `"body"`\>[]

The open epics, with bodies.

### states

`ReadonlyMap`\<`number`, `"closed"` \| `"open"`\>

Issue states by number; a missing number is unresolved.

## Returns

`object`

The drift found and the references that could not be resolved.

### drift

> **drift**: [`ChecklistDrift`](../interfaces/ChecklistDrift.md)[]

### unresolved

> **unresolved**: `number`[]
