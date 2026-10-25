[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/clinical-platform/types/reporting](../README.md) / OperationsKri

# Interface: OperationsKri

A key risk indicator across the sites in scope.

## Properties

### cells

> `readonly` **cells**: readonly [`OperationsKriCell`](OperationsKriCell.md)[]

One cell per site in scope, in site order.

***

### id

> `readonly` **id**: `string`

***

### metricId

> `readonly` **metricId**: `string`

The registry metric it evaluates.

***

### minimum

> `readonly` **minimum**: `string`

Fewest observations a site needs before it is assessed, in words.

***

### name

> `readonly` **name**: `string`

***

### reason

> `readonly` **reason**: `string`

Why those thresholds.

***

### thresholds

> `readonly` **thresholds**: `string`

Where it turns amber and red, in words and the metric's unit.
