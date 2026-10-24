[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/define/model](../README.md) / DefineCodeList

# Interface: DefineCodeList

One `CodeList`.

## Properties

### dataType

> `readonly` **dataType**: `"text"`

***

### decoded

> `readonly` **decoded**: `boolean`

True when every term has a decode (`CodeListItem`), else `EnumeratedItem`.

***

### extensible?

> `readonly` `optional` **extensible?**: `boolean`

Whether a CDISC codelist is extensible.

***

### id

> `readonly` **id**: `string`

Codelist id in the local terminology subset.

***

### name

> `readonly` **name**: `string`

***

### nciCode?

> `readonly` `optional` **nciCode?**: `string`

NCI code, for CDISC codelists.

***

### oid

> `readonly` **oid**: `string`

***

### standardOid?

> `readonly` `optional` **standardOid?**: `string`

The CT standard a CDISC codelist comes from.

***

### terms

> `readonly` **terms**: readonly [`DefineCodeListTerm`](DefineCodeListTerm.md)[]
