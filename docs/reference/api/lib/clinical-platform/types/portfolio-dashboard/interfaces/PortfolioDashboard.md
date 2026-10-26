[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/portfolio-dashboard](../README.md) / PortfolioDashboard

# Interface: PortfolioDashboard

The /platform/portfolio dashboard over one warehouse (#2911).

## Properties

### benchmarks

> `readonly` **benchmarks**: readonly [`PortfolioBenchmark`](PortfolioBenchmark.md)[]

Start-up, enrollment and close-out cycle times, in study order.

***

### dataCut

> `readonly` **dataCut**: `string`

ISO 8601 data cut of the warehouse.

***

### finance

> `readonly` **finance**: [`PortfolioFinance`](PortfolioFinance.md)

Budget, actual and forecast at completion (#2912).

***

### forecasts

> `readonly` **forecasts**: readonly [`PortfolioForecast`](PortfolioForecast.md)[]

The baseline enrollment forecast of every study still enrolling: first
subject in, last subject not yet in. In study id order (#2913).

***

### risk

> `readonly` **risk**: [`PortfolioRiskHeatmap`](PortfolioRiskHeatmap.md)

Schedule, budget and quality for every study (#2914).

***

### swimlane

> `readonly` **swimlane**: [`PortfolioSwimlane`](PortfolioSwimlane.md)
