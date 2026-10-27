[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-standards/bom](../README.md) / StandardBomEntry

# Interface: StandardBomEntry

A standard's entry with its pinned and newest published version.

## Extends

- [`StandardBomSpec`](StandardBomSpec.md)

## Properties

### checks

> `readonly` **checks**: readonly [`StandardCheck`](StandardCheck.md)[]

#### Inherited from

[`StandardBomSpec`](StandardBomSpec.md).[`checks`](StandardBomSpec.md#checks)

***

### feed

> `readonly` **feed**: [`StandardFeed`](../type-aliases/StandardFeed.md)

#### Inherited from

[`StandardBomSpec`](StandardBomSpec.md).[`feed`](StandardBomSpec.md#feed)

***

### hold?

> `readonly` `optional` **hold?**: `string`

Why the site stays on the pinned version although a newer one is
published. Absent: a newer published version is an upgrade to make.

#### Inherited from

[`StandardBomSpec`](StandardBomSpec.md).[`hold`](StandardBomSpec.md#hold)

***

### name

> `readonly` **name**: `string`

The standard's full name.

#### Inherited from

[`StandardBomSpec`](StandardBomSpec.md).[`name`](StandardBomSpec.md#name)

***

### pinned

> `readonly` **pinned**: `string`

***

### published

> `readonly` **published**: `string`

***

### source

> `readonly` **source**: `string`

The official page a reader can check.

#### Inherited from

[`StandardBomSpec`](StandardBomSpec.md).[`source`](StandardBomSpec.md#source)

***

### standard

> `readonly` **standard**: [`ProfileStandard`](../../profile/type-aliases/ProfileStandard.md)

#### Inherited from

[`StandardBomSpec`](StandardBomSpec.md).[`standard`](StandardBomSpec.md#standard)

***

### status

> `readonly` **status**: [`StandardStatus`](../type-aliases/StandardStatus.md)
