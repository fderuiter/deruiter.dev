[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/forecast/enrollment](../README.md) / forecastEnrollment

# Function: forecastEnrollment()

> **forecastEnrollment**(`warehouse`, `studyId`, `options?`): [`EnrollmentForecast`](../../../../types/interfaces/EnrollmentForecast.md)

Forecasts when a study enrolls its last subject.

## Parameters

### warehouse

[`Warehouse`](../../../../types/interfaces/Warehouse.md)

A warehouse from `buildWarehouse`.

### studyId

`string`

A study still enrolling at the warehouse's data cut.

### options?

`whatIf` sites to add; `runs` (default 2000) and `seed` (default 2632).

#### runs?

`number`

#### seed?

`number`

#### whatIf?

[`EnrollmentWhatIf`](../../../../types/interfaces/EnrollmentWhatIf.md) \| `null`

## Returns

[`EnrollmentForecast`](../../../../types/interfaces/EnrollmentForecast.md)

The forecast: the fitted prior, each site's posterior, the chance of meeting the planned date, quantiles and a weekly curve.

## Throws

Error for an unknown study or one that is not enrolling; RangeError for options outside their domain.
