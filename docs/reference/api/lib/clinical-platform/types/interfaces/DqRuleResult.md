[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-platform/types](../README.md) / DqRuleResult

# Interface: DqRuleResult

One rule's result over one warehouse and pipeline run (#2636).

## Properties

### checked

> `readonly` **checked**: `number`

Rows, or groups of rows for a reconciliation, the rule checked.

***

### failed

> `readonly` **failed**: `number`

***

### passRate

> `readonly` **passRate**: `number` \| `null`

Share of checked rows that pass, or `null` when nothing was checked.

***

### ruleId

> `readonly` **ruleId**: `string`

***

### sample

> `readonly` **sample**: readonly `string`[]

Keys of up to five failing rows, in key order.

***

### status

> `readonly` **status**: [`DqStatus`](../type-aliases/DqStatus.md)

`pass` at or above the threshold, `fail` below it, `not-applicable` when
nothing was checked. An ingested rule takes the pipeline gate's status,
where `warn` is a finding to review rather than a defect.
