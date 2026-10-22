[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/usdm-v4-types](../README.md) / UsdmV4Study

# Interface: UsdmV4Study

The study, holding one or more versions.

## Properties

### description?

> `optional` **description?**: `string` \| `null`

***

### extensionAttributes?

> `optional` **extensionAttributes?**: [`UsdmV4ExtensionAttribute`](UsdmV4ExtensionAttribute.md)[]

***

### id?

> `optional` **id?**: `string` \| `null`

A UUID, or `null`: the USDM v4 schema accepts nothing else here.

***

### instanceType

> **instanceType**: `"Study"`

***

### label?

> `optional` **label?**: `string` \| `null`

***

### name

> **name**: `string`

***

### versions?

> `optional` **versions?**: [`UsdmV4StudyVersion`](UsdmV4StudyVersion.md)[]
