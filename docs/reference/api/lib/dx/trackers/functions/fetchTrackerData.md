[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dx/trackers](../README.md) / fetchTrackerData

# Function: fetchTrackerData()

> **fetchTrackerData**(`repo`, `token`, `fetchImpl?`): `Promise`\<[`TrackerReport`](../interfaces/TrackerReport.md)\>

Reads the epics, the states of the issues they name, and the open claims.

Uses the REST API for the two label lists and one GraphQL query per 100
referenced issues for their states, so a run costs a handful of requests.
GraphQL needs a token, so without one the states stay unresolved.

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

## Returns

`Promise`\<[`TrackerReport`](../interfaces/TrackerReport.md)\>

The built report.
