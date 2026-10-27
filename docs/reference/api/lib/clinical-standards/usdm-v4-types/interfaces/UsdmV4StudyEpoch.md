[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-standards/usdm-v4-types](../README.md) / UsdmV4StudyEpoch

# Interface: UsdmV4StudyEpoch

A protocol epoch, ordered through `previousId` / `nextId`.

## Extends

- [`UsdmV4Named`](UsdmV4Named.md)

## Properties

### description?

> `optional` **description?**: `string` \| `null`

#### Inherited from

[`UsdmV4Named`](UsdmV4Named.md).[`description`](UsdmV4Named.md#description)

***

### extensionAttributes?

> `optional` **extensionAttributes?**: [`UsdmV4ExtensionAttribute`](UsdmV4ExtensionAttribute.md)[]

#### Inherited from

[`UsdmV4Named`](UsdmV4Named.md).[`extensionAttributes`](UsdmV4Named.md#extensionattributes)

***

### id

> **id**: `string`

#### Inherited from

[`UsdmV4Named`](UsdmV4Named.md).[`id`](UsdmV4Named.md#id)

***

### instanceType

> **instanceType**: `"StudyEpoch"`

***

### label?

> `optional` **label?**: `string` \| `null`

#### Inherited from

[`UsdmV4Named`](UsdmV4Named.md).[`label`](UsdmV4Named.md#label)

***

### name

> **name**: `string`

#### Inherited from

[`UsdmV4Named`](UsdmV4Named.md).[`name`](UsdmV4Named.md#name)

***

### nextId?

> `optional` **nextId?**: `string` \| `null`

***

### previousId?

> `optional` **previousId?**: `string` \| `null`

***

### type

> **type**: [`UsdmV4Code`](UsdmV4Code.md)
