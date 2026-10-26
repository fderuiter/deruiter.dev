[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/portfolio-dashboard](../README.md) / PortfolioRiskHeatmap

# Interface: PortfolioRiskHeatmap

Schedule, budget and quality for every study, rated by stated rules (#2914).

## Properties

### rows

> `readonly` **rows**: readonly [`PortfolioRiskRow`](PortfolioRiskRow.md)[]

One row per study, in study id order.

***

### rules

> `readonly` **rules**: readonly [`PortfolioRiskRule`](PortfolioRiskRule.md)[]

The rule of each column, in column order.
