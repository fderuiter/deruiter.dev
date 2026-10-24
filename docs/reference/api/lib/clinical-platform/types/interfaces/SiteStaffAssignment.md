[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-platform/types](../README.md) / SiteStaffAssignment

# Interface: SiteStaffAssignment

One principal investigator assignment at one site, as CTMS holds it. The
feed comes from `siteStaffFeed`, not from `generatePortfolio`.

## Extends

- [`BronzeRecord`](BronzeRecord.md)

## Properties

### assignmentId

> `readonly` **assignmentId**: `string`

Assignment id.

***

### endOn

> `readonly` **endOn**: `string` \| `null`

ISO 8601 last day in the role, or `null` while still in it.

***

### investigatorId

> `readonly` **investigatorId**: `string`

Fictional investigator id.

***

### role

> `readonly` **role**: `"principal-investigator"`

Staff role. Only principal investigators are tracked.

***

### siteId

> `readonly` **siteId**: `string`

Site id.

***

### source

> `readonly` **source**: [`SourceSystem`](../type-aliases/SourceSystem.md)

Source system the record was received from.

#### Inherited from

[`BronzeRecord`](BronzeRecord.md).[`source`](BronzeRecord.md#source)

***

### startOn

> `readonly` **startOn**: `string`

ISO 8601 first day in the role.

***

### studyId

> `readonly` **studyId**: `string`

Study id.

***

### synthetic

> `readonly` **synthetic**: `true`

Always `true`: the record is synthetic and describes nothing real.

#### Inherited from

[`BronzeRecord`](BronzeRecord.md).[`synthetic`](BronzeRecord.md#synthetic)
