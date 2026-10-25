[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dx/trackers](../README.md) / toClaimActivity

# Function: toClaimActivity()

> **toClaimActivity**(`issueNumber`, `nodes`): [`ClaimActivity`](../interfaces/ClaimActivity.md)

Reads one claim's activity from its GraphQL fields.

GitHub's ref search matches substrings, so only branches where the number
stands alone (`fix/foo-2830`, not `fix/foo-28301`) count as pushes. The
push time is the branch head's commit time, which is the closest the API
offers to when the branch was last pushed.

## Parameters

### issueNumber

`number`

The claimed issue.

### nodes

[`ClaimActivityNodes`](../interfaces/ClaimActivityNodes.md)

The issue's comments, linked PRs and timeline, and the
  branches whose names matched the number.

## Returns

[`ClaimActivity`](../interfaces/ClaimActivity.md)

The claim's activity.
