[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-standards/bom](../README.md) / StandardBomEntry

# Interface: StandardBomEntry

A standard's entry with its pinned and newest published version.

## Extends

- [`StandardBomSpec`](StandardBomSpec.md)

## Properties

### artifactType

> `readonly` **artifactType**: [`StandardArtifactType`](../type-aliases/StandardArtifactType.md)

#### Inherited from

[`StandardBomSpec`](StandardBomSpec.md).[`artifactType`](StandardBomSpec.md#artifacttype)

***

### capabilities

> `readonly` **capabilities**: `Readonly`\<`Partial`\<`Record`\<[`StandardCapability`](../type-aliases/StandardCapability.md), [`CapabilitySupport`](CapabilitySupport.md)\>\>\>

What the site does with it; a capability left out is `no`.

#### Inherited from

[`StandardBomSpec`](StandardBomSpec.md).[`capabilities`](StandardBomSpec.md#capabilities)

***

### checks

> `readonly` **checks**: readonly [`StandardCheck`](StandardCheck.md)[]

#### Inherited from

[`StandardBomSpec`](StandardBomSpec.md).[`checks`](StandardBomSpec.md#checks)

***

### coverage

> `readonly` **coverage**: `string`

What part of the standard the site covers, and what it does not.

#### Inherited from

[`StandardBomSpec`](StandardBomSpec.md).[`coverage`](StandardBomSpec.md#coverage)

***

### dependsOn

> `readonly` **dependsOn**: readonly [`ProfileStandard`](../../profile/type-aliases/ProfileStandard.md)[]

Other pinned standards this one is built on or applies to.

#### Inherited from

[`StandardBomSpec`](StandardBomSpec.md).[`dependsOn`](StandardBomSpec.md#dependson)

***

### family

> `readonly` **family**: [`StandardFamily`](../type-aliases/StandardFamily.md)

#### Inherited from

[`StandardBomSpec`](StandardBomSpec.md).[`family`](StandardBomSpec.md#family)

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

### lifecycle

> `readonly` **lifecycle**: [`StandardLifecycle`](../type-aliases/StandardLifecycle.md)

#### Inherited from

[`StandardBomSpec`](StandardBomSpec.md).[`lifecycle`](StandardBomSpec.md#lifecycle)

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

### publisher

> `readonly` **publisher**: `"CDISC"`

Every standard in the profile is published by CDISC.

#### Inherited from

[`StandardBomSpec`](StandardBomSpec.md).[`publisher`](StandardBomSpec.md#publisher)

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
