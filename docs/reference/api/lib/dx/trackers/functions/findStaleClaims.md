[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dx/trackers](../README.md) / findStaleClaims

# Function: findStaleClaims()

> **findStaleClaims**(`claims`, `activity`, `now`, `windowMs?`): [`StaleClaim`](../interfaces/StaleClaim.md)[]

Finds the claims that nobody appears to be working.

A claim is stale when no open pull request is linked to it and neither a
push to a branch named after it nor a comment on it falls inside the
window. A claim with no activity entry was not read and is skipped.

## Parameters

### claims

readonly `Pick`\<[`TrackerIssue`](../interfaces/TrackerIssue.md), `"number"` \| `"title"` \| `"labels"` \| `"assignees"`\>[]

Open issues carrying the in-progress label.

### activity

`ReadonlyMap`\<`number`, [`ClaimActivity`](../interfaces/ClaimActivity.md)\>

What GitHub shows for each claim, by issue number.

### now

`Date`

The time to measure the window back from.

### windowMs?

`number` = `STALE_CLAIM_WINDOW_MS`

How long a claim may go quiet; defaults to 24 hours.

## Returns

[`StaleClaim`](../interfaces/StaleClaim.md)[]

The stale claims, longest quiet first.
