[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/platform](../README.md) / CtmsMonitoringVisit

# Interface: CtmsMonitoringVisit

CTMS monitoring visit, with source data verification counts.

## Extends

- [`BronzeRecord`](BronzeRecord.md)

## Properties

### actionItems

> `readonly` **actionItems**: `number`

Action items raised.

***

### mode

> `readonly` **mode**: `"on-site"` \| `"remote"`

On-site or remote.

***

### monitoringVisitId

> `readonly` **monitoringVisitId**: `string`

Monitoring visit id.

***

### reportFinalOn

> `readonly` **reportFinalOn**: `string` \| `null`

ISO 8601 date the visit report was finalised, or `null`.

***

### sdvPagesDue

> `readonly` **sdvPagesDue**: `number`

CRF pages due for source data verification at the visit.

***

### sdvPagesVerified

> `readonly` **sdvPagesVerified**: `number`

CRF pages source-verified at the visit.

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

### synthetic

> `readonly` **synthetic**: `true`

Always `true`: the record is synthetic and describes nothing real.

#### Inherited from

[`BronzeRecord`](BronzeRecord.md).[`synthetic`](BronzeRecord.md#synthetic)

***

### type

> `readonly` **type**: `"SIV"` \| `"IMV"` \| `"COV"`

Visit type: site initiation, interim monitoring or close-out.

***

### visitDate

> `readonly` **visitDate**: `string`

ISO 8601 visit date.
