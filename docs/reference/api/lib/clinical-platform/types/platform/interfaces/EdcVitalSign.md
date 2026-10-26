[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/platform](../README.md) / EdcVitalSign

# Interface: EdcVitalSign

One vital sign reading as the site records it in EDC at a visit (#2957).
Portfolio studies carry these; DEMO-301's vital signs stay in its Study
Data Pipeline run.

## Extends

- [`BronzeRecord`](BronzeRecord.md)

## Properties

### measuredOn

> `readonly` **measuredOn**: `string`

ISO 8601 date of the visit the reading was taken at.

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

### test

> `readonly` **test**: [`VitalSignTest`](../type-aliases/VitalSignTest.md)

What was measured.

***

### unit

> `readonly` **unit**: `string`

Unit: `mmHg`, `beats/min` or `kg`.

***

### value

> `readonly` **value**: `number`

The reading: whole mmHg or beats per minute, or kilograms to 0.1.

***

### visitId

> `readonly` **visitId**: `string`

Visit record id the reading was taken at.

***

### vitalSignId

> `readonly` **vitalSignId**: `string`

Reading id: the visit record id and the test code.
