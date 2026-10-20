[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-platform/types](../README.md) / Site

# Interface: Site

One investigator site in one study.

## Properties

### activatedOn

> `readonly` **activatedOn**: `string` \| `null`

ISO 8601 activation date, or `null` before activation.

***

### country

> `readonly` **country**: `string`

ISO 3166-1 alpha-2 country code.

***

### id

> `readonly` **id**: `string`

Stable site id, unique within the portfolio.

***

### name

> `readonly` **name**: `string`

Fictional site name.

***

### plannedEnrollment

> `readonly` **plannedEnrollment**: `number`

Enrollment target for this site.

***

### studyId

> `readonly` **studyId**: `string`

Id of the study the site belongs to.
