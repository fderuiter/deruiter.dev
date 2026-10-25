[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dx/trackers](../README.md) / ClaimActivityNodes

# Interface: ClaimActivityNodes

The GraphQL fields [fetchTrackerData](../functions/fetchTrackerData.md) reads for one claim.

## Properties

### issue?

> `optional` **issue?**: \{ `closedByPullRequestsReferences?`: \{ `nodes?`: (`PullRequestNode` \| `null`)[]; \}; `comments?`: \{ `nodes?`: (\{ `createdAt?`: `string`; \} \| `null`)[]; \}; `timelineItems?`: \{ `nodes?`: (\{ `source?`: `PullRequestNode` \| `null`; `subject?`: `PullRequestNode` \| `null`; \} \| `null`)[]; \}; \} \| `null`

***

### refs?

> `optional` **refs?**: \{ `nodes?`: (\{ `name?`: `string`; `target?`: \{ `committedDate?`: `string`; \} \| `null`; \} \| `null`)[]; \} \| `null`
