[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/study-data/internal/define/model](../README.md) / DefineDocument

# Interface: DefineDocument

A Define-XML 2.1 document for one layer of a pipeline run.

## Properties

### codeLists

> `readonly` **codeLists**: readonly [`DefineCodeList`](DefineCodeList.md)[]

***

### commentOid

> `readonly` **commentOid**: `string`

The comment on the whole metadata version.

***

### comments

> `readonly` **comments**: readonly [`DefineComment`](DefineComment.md)[]

***

### context

> `readonly` **context**: `"Other"`

***

### createdAt

> `readonly` **createdAt**: `string`

***

### defineVersion

> `readonly` **defineVersion**: `string`

`def:DefineVersion`, matching the vendored 2.1.0 schema.

***

### fileOid

> `readonly` **fileOid**: `string`

***

### itemGroups

> `readonly` **itemGroups**: readonly [`DefineItemGroup`](DefineItemGroup.md)[]

***

### items

> `readonly` **items**: readonly [`DefineItem`](DefineItem.md)[]

***

### layer

> `readonly` **layer**: [`DefineLayer`](../type-aliases/DefineLayer.md)

***

### metaDataVersionDescription

> `readonly` **metaDataVersionDescription**: `string`

***

### metaDataVersionName

> `readonly` **metaDataVersionName**: `string`

***

### metaDataVersionOid

> `readonly` **metaDataVersionOid**: `string`

***

### methods

> `readonly` **methods**: readonly [`DefineMethod`](DefineMethod.md)[]

***

### notice

> `readonly` **notice**: `string`

The synthetic-data notice.

***

### originator

> `readonly` **originator**: `string`

***

### protocolName

> `readonly` **protocolName**: `string`

***

### sourceSystem

> `readonly` **sourceSystem**: `string`

***

### sourceSystemVersion

> `readonly` **sourceSystemVersion**: `string`

***

### standards

> `readonly` **standards**: readonly [`DefineStandard`](DefineStandard.md)[]

***

### studyDescription

> `readonly` **studyDescription**: `string`

***

### studyId

> `readonly` **studyId**: `string`

***

### studyName

> `readonly` **studyName**: `string`

***

### studyOid

> `readonly` **studyOid**: `string`

***

### valueLists

> `readonly` **valueLists**: readonly [`DefineValueList`](DefineValueList.md)[]

***

### whereClauses

> `readonly` **whereClauses**: readonly [`DefineWhereClause`](DefineWhereClause.md)[]
