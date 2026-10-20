[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/usdm-v4-types](../README.md) / UsdmV4Encounter

# Interface: UsdmV4Encounter

A planned contact with the subject (a visit).

## Extends

- [`UsdmV4Named`](UsdmV4Named.md)

## Properties

### contactModes?

> `optional` **contactModes?**: [`UsdmV4Code`](UsdmV4Code.md)[]

***

### description?

> `optional` **description?**: `string` \| `null`

#### Inherited from

[`UsdmV4Named`](UsdmV4Named.md).[`description`](UsdmV4Named.md#description)

***

### environmentalSettings?

> `optional` **environmentalSettings?**: [`UsdmV4Code`](UsdmV4Code.md)[]

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

> **instanceType**: `"Encounter"`

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

### scheduledAtId?

> `optional` **scheduledAtId?**: `string` \| `null`

***

### type

> **type**: [`UsdmV4Code`](UsdmV4Code.md)
