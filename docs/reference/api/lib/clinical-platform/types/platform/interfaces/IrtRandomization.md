[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/platform](../README.md) / IrtRandomization

# Interface: IrtRandomization

IRT randomisation record.

## Extends

- [`BronzeRecord`](BronzeRecord.md)

## Properties

### arm

> `readonly` **arm**: `string`

Assigned arm. Blinded consumers must not read it.

***

### randomizationId

> `readonly` **randomizationId**: `string`

Randomisation number.

***

### randomizedAt

> `readonly` **randomizedAt**: `string`

ISO 8601 randomisation timestamp.

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
