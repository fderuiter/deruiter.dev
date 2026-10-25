[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/forecast/fit](../README.md) / posteriorRate

# Function: posteriorRate()

> **posteriorRate**(`prior`, `site`): [`RecruitmentRate`](../../../../types/forecast/interfaces/RecruitmentRate.md)

A site's rate given the prior and its own enrollment: the gamma posterior
Gamma(α + n, β + τ). A site with no days recruiting yet keeps the prior.

## Parameters

### prior

[`RecruitmentRate`](../../../../types/forecast/interfaces/RecruitmentRate.md)

The study's prior.

### site

[`SiteExposure`](../interfaces/SiteExposure.md)

The site's enrollment and days recruiting, 0 or more.

## Returns

[`RecruitmentRate`](../../../../types/forecast/interfaces/RecruitmentRate.md)

The posterior rate.
