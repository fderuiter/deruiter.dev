[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dx/trackers](../README.md) / buildTrackerReport

# Function: buildTrackerReport()

> **buildTrackerReport**(`repo`, `epics`, `states`, `claims`, `activity?`): [`TrackerReport`](../interfaces/TrackerReport.md)

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

readonly `Pick`\<[`TrackerIssue`](../interfaces/TrackerIssue.md), `"number"` \| `"title"` \| `"labels"` \| `"assignees"`\>[]

Open issues carrying the in-progress label.

### activity?

Claim activity and the time to judge it at; leave it
  out when the activity could not be read.

#### byIssue

`ReadonlyMap`\<`number`, [`ClaimActivity`](../interfaces/ClaimActivity.md)\>

#### now

`Date`

## Returns

[`TrackerReport`](../interfaces/TrackerReport.md)

The tracker report.
