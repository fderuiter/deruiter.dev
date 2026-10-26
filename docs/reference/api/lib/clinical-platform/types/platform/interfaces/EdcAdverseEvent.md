[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/platform](../README.md) / EdcAdverseEvent

# Interface: EdcAdverseEvent

An adverse event as the site records it in EDC, on the visit at which it
was reported (#2956). Portfolio studies carry these; DEMO-301's adverse
events stay in its Study Data Pipeline run.

## Extends

- [`BronzeRecord`](BronzeRecord.md)

## Properties

### aeId

> `readonly` **aeId**: `string`

Adverse event id.

***

### onsetOn

> `readonly` **onsetOn**: `string`

ISO 8601 date the event began.

***

### reportedOn

> `readonly` **reportedOn**: `string`

ISO 8601 date the site reported it: the day it entered the visit's data.

***

### serious

> `readonly` **serious**: `boolean`

Whether the event is serious, as ICH E2A defines it.

***

### severity

> `readonly` **severity**: [`AdverseEventSeverity`](../type-aliases/AdverseEventSeverity.md)

Severity.

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

### term

> `readonly` **term**: `string`

Reported term, from a short fictional list such as `Headache`.

***

### visitId

> `readonly` **visitId**: `string`

Visit record id the event was reported at.
