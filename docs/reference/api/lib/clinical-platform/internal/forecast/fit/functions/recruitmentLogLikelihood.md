[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/forecast/fit](../README.md) / recruitmentLogLikelihood

# Function: recruitmentLogLikelihood()

> **recruitmentLogLikelihood**(`sites`, `prior`): `number`

Log-likelihood of a gamma prior given the sites, less the term that
depends on neither parameter. Each site's count is negative binomial:
Γ(α + n) / Γ(α) · (β / (β + τ))^α · (τ / (β + τ))^n.

## Parameters

### sites

readonly [`SiteExposure`](../interfaces/SiteExposure.md)[]

### prior

[`RecruitmentRate`](../../../../types/forecast/interfaces/RecruitmentRate.md)

## Returns

`number`
