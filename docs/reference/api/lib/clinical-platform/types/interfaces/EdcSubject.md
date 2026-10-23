[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-platform/types](../README.md) / EdcSubject

# Interface: EdcSubject

EDC subject record: screening, enrollment and disposition.

## Extends

- [`BronzeRecord`](BronzeRecord.md)

## Properties

### completedOn

> `readonly` **completedOn**: `string` \| `null`

ISO 8601 date the subject completed the study, or `null`.

***

### discontinuedOn

> `readonly` **discontinuedOn**: `string` \| `null`

ISO 8601 date the subject discontinued, or `null`.

***

### enrolledOn

> `readonly` **enrolledOn**: `string` \| `null`

ISO 8601 enrollment date, or `null` when not enrolled.

***

### screenedOn

> `readonly` **screenedOn**: `string`

ISO 8601 date of the screening visit.

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

### status

> `readonly` **status**: [`SubjectStatus`](../type-aliases/SubjectStatus.md)

Status at the data cut.

***

### studyId

> `readonly` **studyId**: `string`

Study id.

***

### subjectId

> `readonly` **subjectId**: `string`

Subject id, unique within the portfolio.

***

### synthetic

> `readonly` **synthetic**: `true`

Always `true`: the record is synthetic and describes nothing real.

#### Inherited from

[`BronzeRecord`](BronzeRecord.md).[`synthetic`](BronzeRecord.md#synthetic)
