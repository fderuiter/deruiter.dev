[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-platform/types](../README.md) / IrtKit

# Interface: IrtKit

IRT investigational product kit.

## Extends

- [`BronzeRecord`](BronzeRecord.md)

## Properties

### dispensedOn

> `readonly` **dispensedOn**: `string` \| `null`

ISO 8601 dispensing date, or `null`.

***

### expiresOn

> `readonly` **expiresOn**: `string`

ISO 8601 expiry date.

***

### kitId

> `readonly` **kitId**: `string`

Kit number.

***

### receivedOn

> `readonly` **receivedOn**: `string`

ISO 8601 date the site received the kit.

***

### siteId

> `readonly` **siteId**: `string`

Site id holding the kit.

***

### source

> `readonly` **source**: [`SourceSystem`](../type-aliases/SourceSystem.md)

Source system the record was received from.

#### Inherited from

[`BronzeRecord`](BronzeRecord.md).[`source`](BronzeRecord.md#source)

***

### status

> `readonly` **status**: `"available"` \| `"dispensed"` \| `"expired"`

State at the data cut.

***

### studyId

> `readonly` **studyId**: `string`

Study id.

***

### subjectId

> `readonly` **subjectId**: `string` \| `null`

Subject the kit was dispensed to, or `null`.

***

### synthetic

> `readonly` **synthetic**: `true`

Always `true`: the record is synthetic and describes nothing real.

#### Inherited from

[`BronzeRecord`](BronzeRecord.md).[`synthetic`](BronzeRecord.md#synthetic)
