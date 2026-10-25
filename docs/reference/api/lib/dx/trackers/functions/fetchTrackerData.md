[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dx/trackers](../README.md) / fetchTrackerData

# Function: fetchTrackerData()

> **fetchTrackerData**(`repo`, `token`, `fetchImpl?`, `now?`): `Promise`\<[`TrackerReport`](../interfaces/TrackerReport.md)\>

Reads the epics, the states of the issues they name, the open claims and
the activity behind each claim.

Uses the REST API for the two label lists, one GraphQL query per 100
referenced issues for their states, and one per 25 claims for their
activity, so a run costs a handful of requests. GraphQL needs a token, so
without one the states stay unresolved and stale claims are not checked.

## Parameters

### repo

`string`

`owner/name`.

### token

`string` \| `undefined`

A GitHub token, or undefined to read anonymously.

### fetchImpl?

`FetchLike` = `...`

The `fetch` to use; injected by tests.

### now?

`Date` = `...`

The time stale claims are judged at; injected by tests.

## Returns

`Promise`\<[`TrackerReport`](../interfaces/TrackerReport.md)\>

The built report.
