[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/portfolio-dashboard](../README.md) / PortfolioOverrun

# Interface: PortfolioOverrun

One study or vendor forecast to overrun its budget at completion (#2912).

## Properties

### name

> `readonly` **name**: `string`

Study id, or vendor name.

***

### shareText

> `readonly` **shareText**: `string`

Forecast as a share of budget at completion, formatted.

***

### variance

> `readonly` **variance**: `number`

Forecast minus budget at completion, US dollars; above 0.

***

### varianceText

> `readonly` **varianceText**: `string`

The variance, formatted as the metric shows it.
