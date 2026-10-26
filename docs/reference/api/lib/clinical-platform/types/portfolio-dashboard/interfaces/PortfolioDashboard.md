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

### swimlane

> `readonly` **swimlane**: [`PortfolioSwimlane`](PortfolioSwimlane.md)
