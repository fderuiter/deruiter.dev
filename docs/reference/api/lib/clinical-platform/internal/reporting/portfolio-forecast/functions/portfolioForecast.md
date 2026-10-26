[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/reporting/portfolio-forecast](../README.md) / portfolioForecast

# Function: portfolioForecast()

> **portfolioForecast**(`warehouse`, `studyId`, `whatIf?`): [`PortfolioForecast`](../../../../types/portfolio-dashboard/interfaces/PortfolioForecast.md)

One study's enrollment forecast as the portfolio page shows it.

## Parameters

### warehouse

[`Warehouse`](../../../../types/platform/interfaces/Warehouse.md)

A warehouse from `buildWarehouse`.

### studyId

`string`

A study still enrolling at the warehouse's data cut.

### whatIf?

[`EnrollmentWhatIf`](../../../../types/forecast/interfaces/EnrollmentWhatIf.md) \| `null` = `null`

Sites to add, or `null` for the baseline.

## Returns

[`PortfolioForecast`](../../../../types/portfolio-dashboard/interfaces/PortfolioForecast.md)

The forecast from `forecastEnrollment` with its default runs and
seed, the chance of meeting the plan in words, and the countries a
what-if can open sites in.

## Throws

What `forecastEnrollment` throws: Error for an unknown study or
one that is not enrolling, RangeError for a what-if outside its bounds.
