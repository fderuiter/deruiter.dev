[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-platform/types](../README.md) / ReportFinding

# Interface: ReportFinding

A broken report rule, as found by `checkReportSpec`.

## Properties

### message

> `readonly` **message**: `string`

What is wrong, in one sentence.

***

### reportId

> `readonly` **reportId**: `string`

Report the finding is about.

***

### rule

> `readonly` **rule**: `"spec"` \| `"metric"` \| `"visual"` \| `"tier"`

Rule family: the spec's own fields, its use of metrics, its visual, or
its tier's sign-off.
