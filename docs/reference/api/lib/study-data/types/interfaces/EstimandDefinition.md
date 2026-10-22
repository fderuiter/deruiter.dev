[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-data/types](../README.md) / EstimandDefinition

# Interface: EstimandDefinition

An ICH E9(R1) estimand.

## Properties

### analysisPopulationId

> `readonly` **analysisPopulationId**: `string`

Analysis population id.

***

### endpointId

> `readonly` **endpointId**: `string`

Endpoint id the estimand's variable of interest is.

***

### id

> `readonly` **id**: `string`

USDM estimand id.

***

### intercurrentEvents

> `readonly` **intercurrentEvents**: readonly [`IntercurrentEventDefinition`](IntercurrentEventDefinition.md)[]

Intercurrent events and their strategies.

***

### name

> `readonly` **name**: `string`

Estimand name.

***

### populationSummary

> `readonly` **populationSummary**: `string`

Population-level summary, for example a difference in means.
