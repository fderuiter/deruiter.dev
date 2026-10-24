[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-platform/types](../README.md) / MetricContract

# Interface: MetricContract

The part of a metric definition that decides its values. Two releases of a
certified metric with different contracts need different major versions.

## Properties

### allowedDimensions

> `readonly` **allowedDimensions**: readonly [`MetricDimensionId`](../type-aliases/MetricDimensionId.md)[]

Allowed dimensions. Adding one is a minor change; removing one is breaking.

***

### defaultFilters

> `readonly` **defaultFilters**: readonly [`MetricFilter`](MetricFilter.md)[]

Default filters.

***

### formula

> `readonly` **formula**: [`MetricFormula`](../type-aliases/MetricFormula.md)

Formula.

***

### grain

> `readonly` **grain**: [`MetricGrain`](../type-aliases/MetricGrain.md)

Grain.

***

### unit

> `readonly` **unit**: `string`

Unit.
