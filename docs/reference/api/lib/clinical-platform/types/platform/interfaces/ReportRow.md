[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/platform](../README.md) / ReportRow

# Interface: ReportRow

One row of a built report: a group and one cell per metric.

## Properties

### cells

> `readonly` **cells**: readonly [`ReportCell`](ReportCell.md)[]

One cell per metric, in the spec's metric order.

***

### key

> `readonly` **key**: `string`

Stable row key: the dimension values joined.

***

### labels

> `readonly` **labels**: readonly `string`[]

Value of each grouped dimension, in the spec's dimension order.
