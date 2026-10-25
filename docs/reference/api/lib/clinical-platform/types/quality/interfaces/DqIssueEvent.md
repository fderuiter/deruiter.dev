[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/quality](../README.md) / DqIssueEvent

# Interface: DqIssueEvent

One entry in the append-only data quality issue log (#2636).

## Properties

### actor

> `readonly` **actor**: `string`

Role that made the entry.

***

### issueId

> `readonly` **issueId**: `string`

Issue id, for example `DQI-001`.

***

### note

> `readonly` **note**: `string`

***

### on

> `readonly` **on**: `string`

ISO 8601 date.

***

### ruleIds

> `readonly` **ruleIds**: readonly `string`[]

Rules that raised the issue; set on the `detected` entry and empty after it.

***

### scenarioId

> `readonly` **scenarioId**: `string` \| `null`

Defect the issue records; set on the `detected` entry and `null` after it.

***

### status

> `readonly` **status**: [`DqIssueStatus`](../type-aliases/DqIssueStatus.md)
