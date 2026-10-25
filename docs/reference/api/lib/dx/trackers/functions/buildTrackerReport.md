[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dx/trackers](../README.md) / buildTrackerReport

# Function: buildTrackerReport()

> **buildTrackerReport**(`repo`, `epics`, `states`, `claims`): [`TrackerReport`](../interfaces/TrackerReport.md)

Builds the report from data already read.

## Parameters

### repo

`string`

`owner/name`, for the report header.

### epics

readonly `Pick`\<[`TrackerIssue`](../interfaces/TrackerIssue.md), `"number"` \| `"body"`\>[]

The open epics, with bodies.

### states

`ReadonlyMap`\<`number`, `"closed"` \| `"open"`\>

Issue states by number.

### claims

readonly `Pick`\<[`TrackerIssue`](../interfaces/TrackerIssue.md), `"number"` \| `"labels"` \| `"assignees"`\>[]

Open issues carrying the in-progress label.

## Returns

[`TrackerReport`](../interfaces/TrackerReport.md)

The tracker report.
