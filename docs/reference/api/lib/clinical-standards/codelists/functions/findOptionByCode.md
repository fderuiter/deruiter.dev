[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-standards/codelists](../README.md) / findOptionByCode

# Function: findOptionByCode()

> **findOptionByCode**(`codelist`, `code`, `codelists?`): [`CodelistOption`](../interfaces/CodelistOption.md) \| `undefined`

Finds an option within a codelist by its submission code (e.g. "Y", "M", "MILD").

## Parameters

### codelist

`string` \| [`CodelistDefinition`](../interfaces/CodelistDefinition.md)

### code

`string`

### codelists?

[`CodelistDefinition`](../interfaces/CodelistDefinition.md)[] = `STANDARD_CODELISTS`

## Returns

[`CodelistOption`](../interfaces/CodelistOption.md) \| `undefined`
