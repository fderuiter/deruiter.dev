[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/conformance/rules](../README.md) / ConformanceRule

# Interface: ConformanceRule

## Properties

### check

> `readonly` **check**: (`dataset`, `datasets`) => readonly [`RuleIssue`](RuleIssue.md)[]

#### Parameters

##### dataset

[`Dataset`](../../../../types/interfaces/Dataset.md)

##### datasets

readonly [`Dataset`](../../../../types/interfaces/Dataset.md)[]

#### Returns

readonly [`RuleIssue`](RuleIssue.md)[]

***

### citation

> `readonly` **citation**: `string`

***

### id

> `readonly` **id**: `string`

***

### kind

> `readonly` **kind**: `"baseline"` \| `"required"` \| `"visit"` \| `"adam"` \| `"unique"` \| `"iso"` \| `"ct"` \| `"study-day"` \| `"epoch"` \| `"exception"`

***

### scope

> `readonly` **scope**: `object`

#### class?

> `readonly` `optional` **class?**: `string`

#### domain

> `readonly` **domain**: `string`

#### layer

> `readonly` **layer**: `"adam"` \| `"sdtm"`

***

### severity

> `readonly` **severity**: [`FindingSeverity`](../../../../types/type-aliases/FindingSeverity.md)

***

### variable?

> `readonly` `optional` **variable?**: `string`
