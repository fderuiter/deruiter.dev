[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dx/trackers](../README.md) / countClaims

# Function: countClaims()

> **countClaims**(`issues`): [`ClaimCount`](../interfaces/ClaimCount.md)[]

Counts open `status:in-progress` claims per holder.

A claim counts once for each assignee and once for each `lane:` label, so
a WIP limit reads at a glance either way. A claim with neither is counted
under "unassigned".

## Parameters

### issues

readonly `Pick`\<[`TrackerIssue`](../interfaces/TrackerIssue.md), `"number"` \| `"labels"` \| `"assignees"`\>[]

Open issues carrying the in-progress label.

## Returns

[`ClaimCount`](../interfaces/ClaimCount.md)[]

Holders with the most claims first, then by name.
