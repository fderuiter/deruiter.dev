[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/platform](../README.md) / ProtocolDeviation

# Interface: ProtocolDeviation

Protocol deviation, as logged in CTMS.

## Extends

- [`BronzeRecord`](BronzeRecord.md)

## Properties

### category

> `readonly` **category**: `string`

Deviation category.

***

### deviationId

> `readonly` **deviationId**: `string`

Deviation id.

***

### identifiedOn

> `readonly` **identifiedOn**: `string`

ISO 8601 date the deviation was identified.

***

### importance

> `readonly` **importance**: [`DeviationImportance`](../type-aliases/DeviationImportance.md)

Importance per ICH E3.

***

### occurredOn

> `readonly` **occurredOn**: `string`

ISO 8601 date the deviation occurred.

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
