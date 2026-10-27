[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-standards/bom](../README.md) / StandardBomSpec

# Interface: StandardBomSpec

A standard's entry, before the pinned and published versions are added.

## Extended by

- [`StandardBomEntry`](StandardBomEntry.md)

## Properties

### artifactType

> `readonly` **artifactType**: [`StandardArtifactType`](../type-aliases/StandardArtifactType.md)

***

### capabilities

> `readonly` **capabilities**: `Readonly`\<`Partial`\<`Record`\<[`StandardCapability`](../type-aliases/StandardCapability.md), [`CapabilitySupport`](CapabilitySupport.md)\>\>\>

What the site does with it; a capability left out is `no`.

***

### checks

> `readonly` **checks**: readonly [`StandardCheck`](StandardCheck.md)[]

***

### coverage

> `readonly` **coverage**: `string`

What part of the standard the site covers, and what it does not.

***

### dependsOn

> `readonly` **dependsOn**: readonly [`ProfileStandard`](../../profile/type-aliases/ProfileStandard.md)[]

Other pinned standards this one is built on or applies to.

***

### family

> `readonly` **family**: [`StandardFamily`](../type-aliases/StandardFamily.md)

***

### feed

> `readonly` **feed**: [`StandardFeed`](../type-aliases/StandardFeed.md)

***

### hold?

> `readonly` `optional` **hold?**: `string`

Why the site stays on the pinned version although a newer one is
published. Absent: a newer published version is an upgrade to make.

***

### lifecycle

> `readonly` **lifecycle**: [`StandardLifecycle`](../type-aliases/StandardLifecycle.md)

***

### name

> `readonly` **name**: `string`

The standard's full name.

***

### publisher

> `readonly` **publisher**: `"CDISC"`

Every standard in the profile is published by CDISC.

***

### source

> `readonly` **source**: `string`

The official page a reader can check.

***

### standard

> `readonly` **standard**: [`ProfileStandard`](../../profile/type-aliases/ProfileStandard.md)
