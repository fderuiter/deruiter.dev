[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-platform/types](../README.md) / DqIssue

# Interface: DqIssue

A data quality issue as its log entries leave it (#2636).

## Properties

### detectedOn

> `readonly` **detectedOn**: `string`

ISO 8601 date the issue was detected.

***

### fixedOn

> `readonly` **fixedOn**: `string` \| `null`

ISO 8601 date the fix landed, or `null` while the defect is in the data.

***

### history

> `readonly` **history**: readonly [`DqIssueEvent`](DqIssueEvent.md)[]

The issue's log entries, oldest first.

***

### issueId

> `readonly` **issueId**: `string`

***

### ruleIds

> `readonly` **ruleIds**: readonly `string`[]

***

### scenarioId

> `readonly` **scenarioId**: `string`

***

### status

> `readonly` **status**: [`DqIssueStatus`](../type-aliases/DqIssueStatus.md)

Status of the latest entry.
