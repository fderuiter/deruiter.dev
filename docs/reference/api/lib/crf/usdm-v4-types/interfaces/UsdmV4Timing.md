[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/usdm-v4-types](../README.md) / UsdmV4Timing

# Interface: UsdmV4Timing

The timing of one scheduled instance relative to another.

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

> **instanceType**: `"Timing"`

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

### relativeFromScheduledInstanceId

> **relativeFromScheduledInstanceId**: `string`

***

### relativeToFrom

> **relativeToFrom**: [`UsdmV4Code`](UsdmV4Code.md)

***

### relativeToScheduledInstanceId?

> `optional` **relativeToScheduledInstanceId?**: `string` \| `null`

***

### type

> **type**: [`UsdmV4Code`](UsdmV4Code.md)

***

### value

> **value**: `string`

ISO 8601 duration, e.g. `P14D`.

***

### valueLabel

> **valueLabel**: `string`

***

### windowLabel?

> `optional` **windowLabel?**: `string` \| `null`

***

### windowLower?

> `optional` **windowLower?**: `string` \| `null`

ISO 8601 duration the visit may fall before its target.

***

### windowUpper?

> `optional` **windowUpper?**: `string` \| `null`

ISO 8601 duration the visit may fall after its target.
