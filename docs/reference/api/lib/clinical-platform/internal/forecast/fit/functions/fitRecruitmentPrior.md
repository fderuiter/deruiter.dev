[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/forecast/fit](../README.md) / fitRecruitmentPrior

# Function: fitRecruitmentPrior()

> **fitRecruitmentPrior**(`sites`): [`RecruitmentRate`](../../../../types/forecast/interfaces/RecruitmentRate.md)

Fits the study's gamma prior of site recruitment rates by maximum
likelihood: the shape by golden-section search on log α over [10⁻³, 10⁵],
with the rate profiled out for each shape. Sites that recruit at one
common rate drive the shape to the top of the range, where the gamma is
all but a single rate.

## Parameters

### sites

readonly [`SiteExposure`](../interfaces/SiteExposure.md)[]

Each site's enrollment and days recruiting; at least 2, and at least one with a subject.

## Returns

[`RecruitmentRate`](../../../../types/forecast/interfaces/RecruitmentRate.md)

The fitted prior, in subjects per site-day.

## Throws

RangeError when the sites cannot identify a prior.
