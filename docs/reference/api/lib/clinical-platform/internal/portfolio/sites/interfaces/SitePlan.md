[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/portfolio/sites](../README.md) / SitePlan

# Interface: SitePlan

A site with the hidden traits that drive its operational data.

## Properties

### activationDay

> `readonly` **activationDay**: `number` \| `null`

Activation day number, or `null` when not activated by the data cut.

***

### country

> `readonly` **country**: `string`

***

### entryLagDays

> `readonly` **entryLagDays**: `number`

Mean days from visit to data entry.

***

### id

> `readonly` **id**: `string`

***

### integrity

> `readonly` **integrity**: `boolean`

Planted data integrity signal.

***

### name

> `readonly` **name**: `string`

***

### plannedActivationDay

> `readonly` **plannedActivationDay**: `number`

Day the site is planned to activate, even after the data cut.

***

### plannedEnrollment

> `readonly` **plannedEnrollment**: `number`

***

### siteNumber

> `readonly` **siteNumber**: `string`

***

### slow

> `readonly` **slow**: `boolean`

Planted slow-enrolling site.

***

### speed

> `readonly` **speed**: `number`

Multiplier on the planned screening rate.

***

### studyId

> `readonly` **studyId**: `string`
