[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/portfolio-dashboard](../README.md) / PortfolioRiskCell

# Interface: PortfolioRiskCell

One cell of the risk heatmap: a study's rating on one dimension (#2914).

## Properties

### dimension

> `readonly` **dimension**: [`PortfolioRiskDimension`](../type-aliases/PortfolioRiskDimension.md)

***

### rating

> `readonly` **rating**: [`PortfolioRiskRating`](../type-aliases/PortfolioRiskRating.md)

***

### reason

> `readonly` **reason**: `string`

Why, in words: the values the rule read against its thresholds.
