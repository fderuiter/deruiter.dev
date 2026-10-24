[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/define/model](../README.md) / DefineItemGroup

# Interface: DefineItemGroup

One `ItemGroupDef`: a dataset.

## Properties

### className

> `readonly` **className**: `string`

Define-XML class name, for example `FINDINGS`.

***

### domain?

> `readonly` `optional` **domain?**: `string`

SDTM domain, for tabulation datasets.

***

### isReferenceData

> `readonly` **isReferenceData**: `boolean`

***

### itemRefs

> `readonly` **itemRefs**: readonly [`DefineItemRef`](DefineItemRef.md)[]

***

### keys

> `readonly` **keys**: readonly `string`[]

Key variables, in sort order.

***

### label

> `readonly` **label**: `string`

***

### leaf

> `readonly` **leaf**: [`DefineLeaf`](DefineLeaf.md)

***

### name

> `readonly` **name**: `string`

***

### oid

> `readonly` **oid**: `string`

***

### purpose

> `readonly` **purpose**: `"Tabulation"` \| `"Analysis"`

***

### records

> `readonly` **records**: `number`

Number of records, for the HTML view. Define-XML does not carry it.

***

### repeating

> `readonly` **repeating**: `boolean`

***

### standardOid

> `readonly` **standardOid**: `string`

***

### structure

> `readonly` **structure**: `string`

***

### subClassName?

> `readonly` `optional` **subClassName?**: `string`

Define-XML subclass name, for example `TIME-TO-EVENT`.
