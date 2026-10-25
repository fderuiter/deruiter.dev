[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-platform/types](../README.md) / CsmResult

# Interface: CsmResult

One test at one site.

## Properties

### detail

> `readonly` **detail**: `string`

The site's value and its peers', in plain words.

***

### flagged

> `readonly` **flagged**: `boolean`

Whether the q-value is at most the configured false discovery rate.

***

### n

> `readonly` **n**: `number`

Observations at the site the test used.

***

### pValue

> `readonly` **pValue**: `number`

One-sided p-value.

***

### qValue

> `readonly` **qValue**: `number`

Benjamini-Hochberg adjusted p-value across the study's tests.

***

### siteId

> `readonly` **siteId**: `string`

***

### statistic

> `readonly` **statistic**: `number`

Test statistic.

***

### testId

> `readonly` **testId**: `string`
