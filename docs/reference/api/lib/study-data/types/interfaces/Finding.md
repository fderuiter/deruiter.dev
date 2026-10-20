[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-data/types](../README.md) / Finding

# Interface: Finding

One conformance finding, citing the published rule it models.

## Properties

### citation?

> `readonly` `optional` **citation?**: `string`

Citation of the published rule or guide section the rule models.

***

### dataset?

> `readonly` `optional` **dataset?**: `string`

Dataset name, when the finding concerns one dataset.

***

### layer

> `readonly` **layer**: [`DataLayer`](../type-aliases/DataLayer.md)

Layer the finding was raised in.

***

### message

> `readonly` **message**: `string`

Plain-language explanation.

***

### row?

> `readonly` `optional` **row?**: `number`

Zero-based row index, when the finding concerns one record.

***

### ruleId

> `readonly` **ruleId**: `string`

Stable rule id, for example `SD0002`.

***

### severity

> `readonly` **severity**: [`FindingSeverity`](../type-aliases/FindingSeverity.md)

Finding severity.

***

### variable?

> `readonly` `optional` **variable?**: `string`

Variable name, when the finding concerns one variable.
