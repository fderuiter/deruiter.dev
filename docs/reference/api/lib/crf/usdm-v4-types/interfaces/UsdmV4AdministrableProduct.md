[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/usdm-v4-types](../README.md) / UsdmV4AdministrableProduct

# Interface: UsdmV4AdministrableProduct

A product administered in the study: its dose form, whether it is an
investigational product, and its pharmacologic class (MED-RT).

## Extends

- [`UsdmV4Named`](UsdmV4Named.md)

## Properties

### administrableDoseForm

> **administrableDoseForm**: [`UsdmV4AliasCode`](UsdmV4AliasCode.md)

***

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

> **instanceType**: `"AdministrableProduct"`

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

### pharmacologicClass?

> `optional` **pharmacologicClass?**: [`UsdmV4Code`](UsdmV4Code.md) \| `null`

***

### productDesignation

> **productDesignation**: [`UsdmV4Code`](UsdmV4Code.md)
