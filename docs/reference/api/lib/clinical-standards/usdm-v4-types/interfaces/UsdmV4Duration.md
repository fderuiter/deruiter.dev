[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-standards/usdm-v4-types](../README.md) / UsdmV4Duration

# Interface: UsdmV4Duration

A planned length of time, which may vary from subject to subject.

## Extends

- [`UsdmV4Base`](UsdmV4Base.md)

## Properties

### durationWillVary

> **durationWillVary**: `boolean`

***

### extensionAttributes?

> `optional` **extensionAttributes?**: [`UsdmV4ExtensionAttribute`](UsdmV4ExtensionAttribute.md)[]

#### Inherited from

[`UsdmV4Base`](UsdmV4Base.md).[`extensionAttributes`](UsdmV4Base.md#extensionattributes)

***

### id

> **id**: `string`

#### Inherited from

[`UsdmV4Base`](UsdmV4Base.md).[`id`](UsdmV4Base.md#id)

***

### instanceType

> **instanceType**: `"Duration"`

***

### quantity?

> `optional` **quantity?**: [`UsdmV4Quantity`](UsdmV4Quantity.md) \| [`UsdmV4Range`](UsdmV4Range.md) \| `null`

***

### reasonDurationWillVary?

> `optional` **reasonDurationWillVary?**: `string` \| `null`

***

### text?

> `optional` **text?**: `string` \| `null`
