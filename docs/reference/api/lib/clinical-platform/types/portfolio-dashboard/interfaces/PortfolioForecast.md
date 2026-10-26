[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/portfolio-dashboard](../README.md) / PortfolioForecast

# Interface: PortfolioForecast

One study's enrollment forecast as the portfolio page shows it (#2913).

## Properties

### countries

> `readonly` **countries**: readonly [`PortfolioForecastCountry`](PortfolioForecastCountry.md)[]

Every country with a site in the portfolio, by name: the countries a
what-if can open sites in.

***

### forecast

> `readonly` **forecast**: [`EnrollmentForecast`](../../forecast/interfaces/EnrollmentForecast.md)

The forecast from `forecastEnrollment`, with the what-if if one was asked.

***

### planPassed

> `readonly` **planPassed**: `boolean`

Whether the planned last-subject-in date is on or before the data cut,
so no run can meet it.

***

### probabilityText

> `readonly` **probabilityText**: `string`

The chance of meeting the planned date, or "Planned date passed".

***

### runsByPlan

> `readonly` **runsByPlan**: `number`

Runs that enroll the last subject by the planned date.

***

### studyId

> `readonly` **studyId**: `string`

***

### title

> `readonly` **title**: `string`
