[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-platform/types](../README.md) / CecAdjudication

# Interface: CecAdjudication

Clinical events committee adjudication of one site-reported event.

## Extends

- [`BronzeRecord`](BronzeRecord.md)

## Properties

### adjudicatedOn

> `readonly` **adjudicatedOn**: `string` \| `null`

ISO 8601 adjudication date, or `null` while pending.

***

### cecDeviceRelated

> `readonly` **cecDeviceRelated**: `boolean` \| `null`

Whether the committee judged the event device-related, or `null`.

***

### cecEventType

> `readonly` **cecEventType**: `string` \| `null`

Event type as adjudicated, or `null` while pending.

***

### eventId

> `readonly` **eventId**: `string`

Event id.

***

### occurredOn

> `readonly` **occurredOn**: `string`

ISO 8601 date the event occurred.

***

### reportedOn

> `readonly` **reportedOn**: `string`

ISO 8601 date the site reported the event.

***

### siteDeviceRelated

> `readonly` **siteDeviceRelated**: `boolean`

Whether the site judged the event device-related.

***

### siteEventType

> `readonly` **siteEventType**: `string`

Event type as reported by the site.

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
