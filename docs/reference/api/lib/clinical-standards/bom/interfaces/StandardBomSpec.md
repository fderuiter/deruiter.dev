[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-standards/bom](../README.md) / StandardBomSpec

# Interface: StandardBomSpec

A standard's entry, before the pinned and published versions are added.

## Extended by

- [`StandardBomEntry`](StandardBomEntry.md)

## Properties

### checks

> `readonly` **checks**: readonly [`StandardCheck`](StandardCheck.md)[]

***

### feed

> `readonly` **feed**: [`StandardFeed`](../type-aliases/StandardFeed.md)

***

### hold?

> `readonly` `optional` **hold?**: `string`

Why the site stays on the pinned version although a newer one is
published. Absent: a newer published version is an upgrade to make.

***

### name

> `readonly` **name**: `string`

The standard's full name.

***

### source

> `readonly` **source**: `string`

The official page a reader can check.

***

### standard

> `readonly` **standard**: [`ProfileStandard`](../../profile/type-aliases/ProfileStandard.md)
