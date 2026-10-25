[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-platform/types](../README.md) / SiteRecruitment

# Interface: SiteRecruitment

One recruiting site at the data cut, with its posterior rate (#2632).

## Properties

### countryCode

> `readonly` **countryCode**: `string`

***

### enrolled

> `readonly` **enrolled**: `number`

Subjects enrolled at the site up to the data cut.

***

### exposureDays

> `readonly` **exposureDays**: `number`

Days from the site's activation to the data cut.

***

### posterior

> `readonly` **posterior**: [`RecruitmentRate`](RecruitmentRate.md)

The site's rate given the study's prior and its own enrollment.

***

### siteId

> `readonly` **siteId**: `string`
