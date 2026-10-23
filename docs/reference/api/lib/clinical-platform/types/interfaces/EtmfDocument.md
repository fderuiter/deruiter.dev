[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-platform/types](../README.md) / EtmfDocument

# Interface: EtmfDocument

eTMF expected document, filed against the TMF Reference Model.

## Extends

- [`BronzeRecord`](BronzeRecord.md)

## Properties

### artifact

> `readonly` **artifact**: `string`

Artifact name.

***

### documentId

> `readonly` **documentId**: `string`

Document id.

***

### dueOn

> `readonly` **dueOn**: `string`

ISO 8601 date the document is due.

***

### filedOn

> `readonly` **filedOn**: `string` \| `null`

ISO 8601 filing date, or `null`.

***

### siteId

> `readonly` **siteId**: `string` \| `null`

Site id, or `null` for a trial-level document.

***

### source

> `readonly` **source**: [`SourceSystem`](../type-aliases/SourceSystem.md)

Source system the record was received from.

#### Inherited from

[`BronzeRecord`](BronzeRecord.md).[`source`](BronzeRecord.md#source)

***

### status

> `readonly` **status**: `"filed"` \| `"missing"` \| `"expected"`

State at the data cut: filed, overdue and missing, or not yet due.

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

***

### zone

> `readonly` **zone**: `string`

TMF Reference Model zone.
