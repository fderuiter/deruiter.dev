[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-platform/types](../README.md) / CtmsMilestone

# Interface: CtmsMilestone

CTMS study milestone, planned and actual.

## Extends

- [`BronzeRecord`](BronzeRecord.md)

## Properties

### actualOn

> `readonly` **actualOn**: `string` \| `null`

ISO 8601 actual date, or `null` when not yet reached.

***

### kind

> `readonly` **kind**: [`MilestoneKind`](../type-aliases/MilestoneKind.md)

Milestone kind.

***

### label

> `readonly` **label**: `string`

Display label in the study's own vocabulary (drug or device).

***

### plannedOn

> `readonly` **plannedOn**: `string`

ISO 8601 planned date.

***

### source

> `readonly` **source**: [`SourceSystem`](../type-aliases/SourceSystem.md)

Source system the record was received from.

#### Inherited from

[`BronzeRecord`](BronzeRecord.md).[`source`](BronzeRecord.md#source)

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
