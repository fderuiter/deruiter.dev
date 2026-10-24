[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-platform/types](../README.md) / OperationsSource

# Interface: OperationsSource

A data product the dashboard's numbers read, with the freshness its data
contract promises (#2626).

## Properties

### contractVersion

> `readonly` **contractVersion**: `string`

Version of the contract in force.

***

### freshnessHours

> `readonly` **freshnessHours**: `number`

Longest gap between loads the product's contract allows, in hours.

***

### name

> `readonly` **name**: `string`

Product name.

***

### productId

> `readonly` **productId**: `string`

Data product id: the qualified gold table, for example `gold.fct_query`.
