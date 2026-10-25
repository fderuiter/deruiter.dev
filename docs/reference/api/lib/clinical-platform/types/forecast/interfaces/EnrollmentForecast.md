[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/forecast](../README.md) / EnrollmentForecast

# Interface: EnrollmentForecast

A Monte Carlo enrollment forecast for one study at a data cut (#2632).

## Properties

### curve

> `readonly` **curve**: readonly [`EnrollmentForecastPoint`](EnrollmentForecastPoint.md)[]

Share of runs complete by each week from the data cut until 99% are.

***

### dataCut

> `readonly` **dataCut**: `string`

ISO 8601 data cut of the warehouse.

***

### enrolled

> `readonly` **enrolled**: `number`

Subjects enrolled up to the data cut.

***

### plannedLastSubjectIn

> `readonly` **plannedLastSubjectIn**: `string`

ISO 8601 planned last-subject-in date, from the study's milestones.

***

### prior

> `readonly` **prior**: [`RecruitmentRate`](RecruitmentRate.md)

The study's prior, fitted to its sites by maximum likelihood.

***

### probabilityByPlan

> `readonly` **probabilityByPlan**: `number`

Share of runs that enroll the last subject on or before the planned date.

***

### quantiles

> `readonly` **quantiles**: `object`

ISO 8601 dates by which 10%, 50% and 90% of runs are complete.

#### p10

> `readonly` **p10**: `string`

#### p50

> `readonly` **p50**: `string`

#### p90

> `readonly` **p90**: `string`

***

### runs

> `readonly` **runs**: `number`

***

### seed

> `readonly` **seed**: `number`

***

### sites

> `readonly` **sites**: readonly [`SiteRecruitment`](SiteRecruitment.md)[]

Recruiting sites at the data cut, in id order.

***

### studyId

> `readonly` **studyId**: `string`

***

### target

> `readonly` **target**: `number`

Enrollment target of the study.

***

### whatIf

> `readonly` **whatIf**: [`EnrollmentWhatIf`](EnrollmentWhatIf.md) \| `null`

The what-if applied, or `null` for the baseline.

***

### whatIfSiteRate

> `readonly` **whatIfSiteRate**: [`RecruitmentRate`](RecruitmentRate.md) \| `null`

Rate a new site in the what-if's country recruits at, or `null` without a what-if.
