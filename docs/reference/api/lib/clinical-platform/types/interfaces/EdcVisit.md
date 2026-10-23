[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-platform/types](../README.md) / EdcVisit

# Interface: EdcVisit

EDC visit record, with its data entry time.

## Extends

- [`BronzeRecord`](BronzeRecord.md)

## Properties

### dataEnteredAt

> `readonly` **dataEnteredAt**: `string` \| `null`

ISO 8601 timestamp the site entered the visit's data, or `null`.

***

### dayOffset

> `readonly` **dayOffset**: `number` \| `null`

Actual minus planned day; `null` for a missed visit.

***

### plannedVisitId

> `readonly` **plannedVisitId**: `string`

Planned visit id from the study schedule.

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

> `readonly` **status**: `"entered"` \| `"pending-entry"` \| `"missed"`

Entry state at the data cut.

***

### studyId

> `readonly` **studyId**: `string`

Study id.

***

### subjectId

> `readonly` **subjectId**: `string`

Subject id.

***

### synthetic

> `readonly` **synthetic**: `true`

Always `true`: the record is synthetic and describes nothing real.

#### Inherited from

[`BronzeRecord`](BronzeRecord.md).[`synthetic`](BronzeRecord.md#synthetic)

***

### visitDate

> `readonly` **visitDate**: `string` \| `null`

ISO 8601 visit date, or `null` for a missed visit.

***

### visitId

> `readonly` **visitId**: `string`

Visit record id.
