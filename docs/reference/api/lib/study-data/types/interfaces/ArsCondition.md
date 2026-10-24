[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-data/types](../README.md) / ArsCondition

# Interface: ArsCondition

One condition, `dataset.variable comparator value`. Dataset and variable
names are the ones the Dataset-JSON files and `itemOid` use.

## Properties

### comparator

> `readonly` **comparator**: [`ArsComparator`](../type-aliases/ArsComparator.md)

How the variable is compared.

***

### dataset

> `readonly` **dataset**: `string`

Dataset name, for example `ADSL`.

***

### value

> `readonly` **value**: readonly `string`[]

Values to compare against, as text. A numeric variable compares
numerically. A missing value matches only `NE` and `NOTIN`.

***

### variable

> `readonly` **variable**: `string`

Variable name, for example `SAFFL`.
