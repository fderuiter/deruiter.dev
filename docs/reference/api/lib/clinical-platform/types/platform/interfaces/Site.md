[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/platform](../README.md) / Site

# Interface: Site

One investigator site in one study.

## Extends

- [`SyntheticRecord`](SyntheticRecord.md)

## Properties

### activatedOn

> `readonly` **activatedOn**: `string` \| `null`

ISO 8601 activation date, or `null` before activation.

***

### contractedOn

> `readonly` **contractedOn**: `string` \| `null`

ISO 8601 date the clinical trial agreement was executed, or `null` before then.

***

### country

> `readonly` **country**: `string`

ISO 3166-1 alpha-2 country code.

***

### id

> `readonly` **id**: `string`

Stable site id, unique within the portfolio.

***

### irbApprovedOn

> `readonly` **irbApprovedOn**: `string` \| `null`

ISO 8601 date the IRB or ethics committee approved the study at the site, or `null` before then.

***

### name

> `readonly` **name**: `string`

Fictional site name.

***

### plannedEnrollment

> `readonly` **plannedEnrollment**: `number`

Enrollment target for this site.

***

### selectedOn

> `readonly` **selectedOn**: `string` \| `null`

ISO 8601 date the sponsor selected the site, or `null` before then (#2880).

***

### siteNumber

> `readonly` **siteNumber**: `string`

Site number within the study, as printed on the site's documents.

***

### studyId

> `readonly` **studyId**: `string`

Id of the study the site belongs to.

***

### synthetic

> `readonly` **synthetic**: `true`

Always `true`: the record is synthetic and describes nothing real.

#### Inherited from

[`SyntheticRecord`](SyntheticRecord.md).[`synthetic`](SyntheticRecord.md#synthetic)
