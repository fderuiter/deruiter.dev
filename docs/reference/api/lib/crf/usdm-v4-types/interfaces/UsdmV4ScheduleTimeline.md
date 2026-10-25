[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/usdm-v4-types](../README.md) / UsdmV4ScheduleTimeline

# Interface: UsdmV4ScheduleTimeline

A schedule of activities.

## Extends

- [`UsdmV4Named`](UsdmV4Named.md)

## Properties

### description?

> `optional` **description?**: `string` \| `null`

#### Inherited from

[`UsdmV4Named`](UsdmV4Named.md).[`description`](UsdmV4Named.md#description)

***

### entryCondition

> **entryCondition**: `string`

***

### entryId

> **entryId**: `string`

***

### exits?

> `optional` **exits?**: [`UsdmV4ScheduleTimelineExit`](UsdmV4ScheduleTimelineExit.md)[]

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

### instances?

> `optional` **instances?**: [`UsdmV4ScheduledActivityInstance`](UsdmV4ScheduledActivityInstance.md)[]

***

### instanceType

> **instanceType**: `"ScheduleTimeline"`

***

### label?

> `optional` **label?**: `string` \| `null`

#### Inherited from

[`UsdmV4Named`](UsdmV4Named.md).[`label`](UsdmV4Named.md#label)

***

### mainTimeline

> **mainTimeline**: `boolean`

***

### name

> **name**: `string`

#### Inherited from

[`UsdmV4Named`](UsdmV4Named.md).[`name`](UsdmV4Named.md#name)

***

### plannedDuration?

> `optional` **plannedDuration?**: [`UsdmV4Duration`](UsdmV4Duration.md) \| `null`

***

### timings?

> `optional` **timings?**: [`UsdmV4Timing`](UsdmV4Timing.md)[]
