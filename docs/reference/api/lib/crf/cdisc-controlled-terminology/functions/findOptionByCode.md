[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/crf/cdisc-controlled-terminology](../README.md) / findOptionByCode

# Function: findOptionByCode()

> **findOptionByCode**(`codelist`, `code`, `codelists?`): [`CodelistOption`](../../types/interfaces/CodelistOption.md) \| `undefined`

Finds an option within a codelist by its submission code (e.g. "Y", "M", "MILD").

## Parameters

### codelist

`string` \| [`CodelistDefinition`](../../types/interfaces/CodelistDefinition.md)

### code

`string`

### codelists?

[`CodelistDefinition`](../../types/interfaces/CodelistDefinition.md)[] = `STANDARD_CODELISTS`

## Returns

[`CodelistOption`](../../types/interfaces/CodelistOption.md) \| `undefined`
