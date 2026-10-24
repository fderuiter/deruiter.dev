[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-platform/types](../README.md) / MetricFormat

# Interface: MetricFormat

How a metric's value is displayed.

## Properties

### decimals

> `readonly` **decimals**: `number`

Decimal places shown, from 0 to 4.

***

### style

> `readonly` **style**: `"number"` \| `"percent"` \| `"currency"`

`percent` values are fractions shown times 100 with a percent sign;
`currency` values are US dollars; `number` values are shown as they are.
