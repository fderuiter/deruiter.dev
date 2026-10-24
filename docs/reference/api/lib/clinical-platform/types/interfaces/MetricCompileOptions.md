[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-platform/types](../README.md) / MetricCompileOptions

# Interface: MetricCompileOptions

Options for the metric compilers.

## Properties

### dataCut?

> `readonly` `optional` **dataCut?**: `string`

ISO 8601 data cut, written into metrics that measure age at the cut,
such as query aging. Required when a compiled metric uses it.
