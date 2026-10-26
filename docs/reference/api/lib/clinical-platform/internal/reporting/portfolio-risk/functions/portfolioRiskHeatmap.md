[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/clinical-platform/internal/reporting/portfolio-risk](../README.md) / portfolioRiskHeatmap

# Function: portfolioRiskHeatmap()

> **portfolioRiskHeatmap**(`warehouse`, `swimlane`, `forecasts`): [`PortfolioRiskHeatmap`](../../../../types/portfolio-dashboard/interfaces/PortfolioRiskHeatmap.md)

The risk heatmap over one warehouse.

## Parameters

### warehouse

[`Warehouse`](../../../../types/platform/interfaces/Warehouse.md)

A warehouse from `buildWarehouse`.

### swimlane

[`PortfolioSwimlane`](../../../../types/portfolio-dashboard/interfaces/PortfolioSwimlane.md)

The dashboard's milestone swimlane.

### forecasts

readonly [`PortfolioForecast`](../../../../types/portfolio-dashboard/interfaces/PortfolioForecast.md)[]

The dashboard's baseline enrollment forecasts.

## Returns

[`PortfolioRiskHeatmap`](../../../../types/portfolio-dashboard/interfaces/PortfolioRiskHeatmap.md)

Every study rated on schedule, budget and quality, with each column's rule.
