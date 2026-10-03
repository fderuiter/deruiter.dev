[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/dx/setup/types](../README.md) / DatabaseStepRecord

# Interface: DatabaseStepRecord

Record of one database step and how to recover it if it did not finish.

## Properties

### detail

> **detail**: `string`

***

### recovery?

> `optional` **recovery?**: `string`

Command a person runs to finish or repair the step by hand.

***

### status

> **status**: [`DatabaseStepStatus`](../type-aliases/DatabaseStepStatus.md)
