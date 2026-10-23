[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-platform/types](../README.md) / EdcQuery

# Interface: EdcQuery

EDC data query, with its open, answer and close times.

## Extends

- [`BronzeRecord`](BronzeRecord.md)

## Properties

### answeredAt

> `readonly` **answeredAt**: `string` \| `null`

ISO 8601 timestamp the site answered, or `null`.

***

### closedAt

> `readonly` **closedAt**: `string` \| `null`

ISO 8601 timestamp the query was closed, or `null`.

***

### field

> `readonly` **field**: `string`

Queried field, as `DOMAIN.VARIABLE`.

***

### openedAt

> `readonly` **openedAt**: `string`

ISO 8601 timestamp the query was opened.

***

### origin

> `readonly` **origin**: `"edit-check"` \| `"manual"`

How the query was raised.

***

### queryId

> `readonly` **queryId**: `string`

Query id.

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

> `readonly` **status**: `"closed"` \| `"open"` \| `"answered"`

State at the data cut.

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

### visitId

> `readonly` **visitId**: `string`

Visit record id the query is raised on.
